import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import { pool, testConnection, mapJobOrderRow, mapStaffRow, mapLogRow, mapNotificationRow } from "./db";
import { sendOtpEmail, sendTaskDispatchEmail, sendGenericNotificationEmail } from "./sendOtpEmail";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();
app.use(helmet());
// FRONTEND_URL can be a comma-separated list, e.g.
// FRONTEND_URL=http://jors.cosca.local:5173,http://192.168.1.23:5173
// so the dev machine's own hostname AND its LAN IP (used by phones/other
// laptops on the same WiFi) are both accepted.
function sanitizeOrigin(raw: string): string {
  let url = raw.trim().replace(/\/+$/, "");
  if (url && !/^https?:\/\//i.test(url)) {
    console.warn(`[JORS] FRONTEND_URL origin missing http:// — auto-fixing "${url}" → "http://${url}"`);
    url = `http://${url}`;
  }
  if (url && /^https?:\/\/[^/]+$/.test(url) && !/:(\d+)$/.test(url)) {
    console.warn(`[JORS] FRONTEND_URL origin missing port — auto-fixing "${url}" → "${url}:5173"`);
    url = `${url}:5173`;
  }
  return url;
}
const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((s) => sanitizeOrigin(s))
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // No Origin header (curl, server-to-server, some mobile webviews) — allow.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
}));
// Default express.json() limit is 100kb — far too small for a base64-encoded
// photo attached to a job order submission (a phone camera photo alone can be
// several MB once base64-encoded). 10mb covers a reasonably compressed photo
// with headroom; tighten later if you move to real file uploads + storage
// instead of inline base64 data URLs (see the photo pipeline notes elsewhere).
app.use(express.json({ limit: "10mb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many requests, please try again later." },
});

const PORT = Number(process.env.PORT) || 4000;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET is missing from .env. Generate one with:");
  console.error("  node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"");
  process.exit(1);
}
const JWT_EXPIRES_IN = "8h";

// Initialize Gemini client (optional — falls back to rule-based analysis if absent)
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { headers: { "User-Agent": "jors-cosca-backend" } },
  });
}

// ---------------------------------------------------------------
// AUTH: bcrypt + JWT + brute-force lockout
// ---------------------------------------------------------------
const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8k1eO5EqYy9J0xM3TgN9k2XxL3vZDe";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; lockedUntil: number | null }>();

function getLockStatus(username: string) {
  const rec = loginAttempts.get(username);
  if (!rec) return { locked: false, attemptsRemaining: MAX_ATTEMPTS };
  if (rec.lockedUntil && rec.lockedUntil > Date.now()) {
    return { locked: true, retryAfterMs: rec.lockedUntil - Date.now() };
  }
  if (rec.lockedUntil && rec.lockedUntil <= Date.now()) {
    loginAttempts.delete(username);
    return { locked: false, attemptsRemaining: MAX_ATTEMPTS };
  }
  return { locked: false, attemptsRemaining: MAX_ATTEMPTS - rec.count };
}
function recordFailedAttempt(username: string) {
  const rec = loginAttempts.get(username) || { count: 0, lockedUntil: null };
  rec.count += 1;
  if (rec.count >= MAX_ATTEMPTS) rec.lockedUntil = Date.now() + LOCKOUT_MS;
  loginAttempts.set(username, rec);
  return rec;
}
function clearAttempts(username: string) {
  loginAttempts.delete(username);
}

interface AuthedRequest extends express.Request {
  user?: { sub: number; username: string; role: string; fullName: string };
}

function authenticateToken(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access token required." });

  jwt.verify(token, JWT_SECRET as string, (err: any, payload: any) => {
    if (err) return res.status(403).json({ error: "Invalid or expired session. Please log in again." });
    req.user = payload;
    next();
  });
}

function requireRole(...allowedRoles: string[]) {
  return (req: AuthedRequest, res: express.Response, next: express.NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission to perform this action." });
    }
    next();
  };
}

app.post("/api/auth/login", authLimiter, async (req, res) => {
  const { username, password, portal, department, selectedRole } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username or Email and password are required." });
  }

  const lock = getLockStatus(username);
  if (lock.locked) {
    return res.status(429).json({
      error: "This account is temporarily locked due to repeated failed attempts.",
      retryAfterMs: lock.retryAfterMs,
    });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)",
      [username.trim()]
    );
    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

    if (!user || !passwordMatches) {
      const rec = recordFailedAttempt(username);
      return res.status(401).json({
        error: "Invalid username/email or password.",
        attemptsRemaining: Math.max(0, MAX_ATTEMPTS - rec.count),
      });
    }

    const portalRoleMap: Record<string, string[]> = {
      Dept: ["Dept"],
      Staff: ["Staff"],
      Admin: ["PPO", "President", "Finance"],
    };
    if (portal && portalRoleMap[portal] && !portalRoleMap[portal].includes(user.role)) {
      return res.status(403).json({ error: "This account is not registered for that portal." });
    }

    // Dept portal: the office picked in the "Department Office" dropdown
    // must match the office this account is actually assigned to. Enforced
    // here (not just in the UI) so a valid username/password pair can't be
    // used to log in under the wrong office — treated the same as a wrong
    // password for lockout purposes, so it can't be used to fish for an
    // account's real office either.
    // NEW
    if (portal === "Dept" && department) {
      if (!user.department) {
        const rec = recordFailedAttempt(username);
        return res.status(401).json({
          error: "This account has no department office assigned yet. Please contact the PPO administrator.",
          attemptsRemaining: Math.max(0, MAX_ATTEMPTS - rec.count),
        });
      }
      if (user.department !== department) {
        const rec = recordFailedAttempt(username);
        return res.status(401).json({
          error: "The selected department office does not match this account.",
          attemptsRemaining: Math.max(0, MAX_ATTEMPTS - rec.count),
        });
      }
    }

    // Admin portal: same idea for the "Designated Executive Role" dropdown
    // (PPO / President / Finance) — picking the wrong one for a real
    // account must fail, not silently log in under the account's real role.
    if (portal === "Admin" && selectedRole && user.role !== selectedRole) {
      const rec = recordFailedAttempt(username);
      return res.status(401).json({
        error: "The selected executive role does not match this account.",
        attemptsRemaining: Math.max(0, MAX_ATTEMPTS - rec.count),
      });
    }

    clearAttempts(username);

    const token = jwt.sign(
      { sub: user.id, username: user.username, role: user.role, fullName: user.full_name },
      JWT_SECRET as string,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role, fullName: user.full_name, email: user.email, department: user.department },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error during login." });
  }
});

// Endpoint: Request Password Reset Verification Code (OTP)
app.post("/api/auth/forgot-password", authLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Please enter your registered Gmail or email address." });
  }

  const normalized = email.trim().toLowerCase();
  try {
    const result = await pool.query(
      "SELECT id, username, email, full_name FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1",
      [normalized]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "No account found associated with that email. Please check your address or contact PPO Admin."
      });
    }

    const user = result.rows[0];
    const accountEmail = (user.email || normalized).toLowerCase();

    // Basic resend cooldown: block spamming the same account with new codes.
    const recent = await pool.query(
      `SELECT id FROM password_resets
       WHERE LOWER(email) = $1 AND used = FALSE AND created_at > NOW() - INTERVAL '60 seconds'
       ORDER BY created_at DESC LIMIT 1`,
      [accountEmail]
    );
    if (recent.rows.length > 0) {
      return res.status(429).json({ error: "Please wait about a minute before requesting another code." });
    }

    // Generate secure 6-digit OTP, store only its bcrypt hash — never the raw code.
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await pool.query(
      `INSERT INTO password_resets (email, otp_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [accountEmail, otpHash, expiresAt]
    );

    if (!user.email) {
      return res.status(400).json({
        error: "This account does not have an email address on file. Please contact your PPO administrator to reset your password.",
      });
    }

    try {
      await sendOtpEmail(user.email, otp);
      console.log(`[AUTH RECOVERY] OTP emailed to ${user.email} for ${user.username}`);
    } catch (err) {
      console.error(`[AUTH RECOVERY] Failed to email OTP to ${user.email}:`, err);
      return res.status(502).json({
        error: "Could not send the verification email right now. Please try again later or contact your PPO administrator.",
      });
    }

    // Mask the email for privacy (e.g. "jm***@gmail.com")
    const [localPart, domain] = user.email.split("@");
    const masked = localPart.length > 2
      ? localPart.slice(0, 2) + "***@" + domain
      : localPart[0] + "***@" + domain;

    res.json({
      ok: true,
      message: `A 6-digit verification code has been sent to ${masked}. Please check your inbox (and spam folder).`,
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Could not process password recovery." });
  }
});

// Endpoint: Reset Password with OTP Verification Code
app.post("/api/auth/reset-password", authLimiter, async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: "Email, verification code, and new password are required." });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters long." });
  }

  const normalized = email.trim().toLowerCase();

  try {
    const resetResult = await pool.query(
      `SELECT id, otp_hash, expires_at, attempts FROM password_resets
       WHERE LOWER(email) = $1 AND used = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [normalized]
    );

    if (resetResult.rows.length === 0) {
      return res.status(400).json({ error: "No pending reset request for this email. Please request a new code." });
    }

    const record = resetResult.rows[0];

    if (new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ error: "Verification code has expired (15 min limit). Please request a new code." });
    }
    if (record.attempts >= 5) {
      return res.status(429).json({ error: "Too many incorrect attempts. Please request a new code." });
    }

    const otpMatches = await bcrypt.compare(otp.trim(), record.otp_hash);
    if (!otpMatches) {
      await pool.query("UPDATE password_resets SET attempts = attempts + 1 WHERE id = $1", [record.id]);
      return res.status(400).json({ error: "Invalid verification code. Please check your email and try again." });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    const result = await pool.query(
      `UPDATE users
       SET password_hash = $1
       WHERE LOWER(email) = $2 OR LOWER(username) = $2
       RETURNING username, full_name`,
      [newHash, normalized]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User account could not be found to update password." });
    }

    await pool.query("UPDATE password_resets SET used = TRUE WHERE id = $1", [record.id]);
    clearAttempts(result.rows[0].username);

    res.json({
      ok: true,
      message: `Password successfully updated for ${result.rows[0].full_name || result.rows[0].username}! You may now log in.`
    });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Failed to update password." });
  }
});

app.get("/api/auth/me", authenticateToken, async (req: AuthedRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, role, full_name as "fullName", email, department FROM users WHERE id = $1`,
      [req.user!.sub]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "Account no longer exists." });
    res.json({ user });
  } catch (err) {
    console.error("Error fetching current user:", err);
    res.status(500).json({ error: "Failed to load session." });
  }
});

// Self-service profile edit — any logged-in role can update their own
// display name and email (never their own username, role, or department;
// those stay locked down the same way they are for PPO-driven edits via
// PATCH /api/users/:id).
app.patch("/api/auth/me", authenticateToken, async (req: AuthedRequest, res) => {
  try {
    const { fullName, email } = req.body;
    if (!fullName || !String(fullName).trim()) {
      return res.status(400).json({ error: "Full name is required." });
    }

    let cleanEmail: string | null = null;
    if (email && String(email).trim()) {
      cleanEmail = String(email).trim().toLowerCase();
      if (!EMAIL_REGEX.test(cleanEmail)) {
        return res.status(400).json({ error: "Invalid email format." });
      }
    }

    const result = await pool.query(
      `UPDATE users SET full_name = $1, email = $2 WHERE id = $3
       RETURNING id, username, role, full_name as "fullName", email, department`,
      [String(fullName).trim(), cleanEmail, req.user!.sub]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Account no longer exists." });
    }

    // Staff accounts have a mirrored name in `staff` — keep it in sync so
    // Worker Rules and job-order assignment lists don't go stale.
    if (req.user!.role === "Staff") {
      await pool.query("UPDATE staff SET name = $1 WHERE user_id = $2", [
        String(fullName).trim(), req.user!.sub,
      ]);
    }

    await pool.query("INSERT INTO logs (message) VALUES ($1)", [
      `Account profile updated by ${req.user?.username}.`,
    ]);

    res.json({ ok: true, user: result.rows[0] });
  } catch (err: any) {
    console.error("Error updating own profile:", err);
    res.status(500).json({ error: "Failed to update profile." });
  }
});

// NOTE: Self-service password changes go through the same OTP-via-email
// flow as the login page's "Forgot Access Key" (POST /api/auth/forgot-password
// + POST /api/auth/reset-password above) rather than a separate
// current-password-based endpoint, so there's only one password-reset code
// path to keep secure and test.



// ---------------------------------------------------------------
// PUBLIC: Tells the frontend whether real AI parsing is active right
// now (a Gemini key is configured) or every job order/report is
// currently running through the local rule-based fallback instead.
// No auth required — this only reveals a boolean, nothing sensitive.
// ---------------------------------------------------------------
app.get("/api/system/ai-status", async (req, res) => {
  res.json({ aiEnabled: ai !== null });
});

// ---------------------------------------------------------------
// PUBLIC: Department list for the login page dropdown.
// ---------------------------------------------------------------
// USER MANAGEMENT ENDPOINTS (PPO / Admin only)
// ---------------------------------------------------------------
const VALID_ROLES = ["Dept", "Staff", "PPO", "President", "Finance"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9._-]+$/;

// Offices used to be a hardcoded array/map here (VALID_DEPARTMENTS /
// DEPT_LABEL_BY_VALUE). They're now rows in the `departments` table so the
// PPO can add/remove offices from Settings without a code deploy. Kept as
// an in-memory cache (loaded on boot, refreshed after every add/remove)
// rather than a DB query on every lookup, since this list changes rarely
// and is read on almost every job-order/account request.
let departmentCache: { value: string; name: string }[] = [];

async function loadDepartmentCache() {
  const result = await pool.query(
    "SELECT value, name FROM departments WHERE value IS NOT NULL ORDER BY name ASC"
  );
  departmentCache = result.rows.map((r) => ({ value: String(r.value), name: String(r.name) }));
}

function isValidDepartmentValue(value: string): boolean {
  return departmentCache.some((d) => d.value === value);
}

// job_orders.office stores the FULL label text (that's what the Dept
// dashboard submits as `office`), while users.department only stores the
// short value — this is what lets /api/job-orders translate a logged-in
// Dept user's `department` into the office label to filter by.
function getDeptLabelByValue(value: string): string | undefined {
  return departmentCache.find((d) => d.value === value)?.name;
}

app.get("/api/users", authenticateToken, requireRole("PPO"), async (req: AuthedRequest, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username, role, full_name as \"fullName\", email, department, created_at as \"createdAt\" FROM users ORDER BY created_at DESC"
    );
    res.json({ users: result.rows });
  } catch (err: any) {
    console.error("Error fetching user accounts:", err);
    res.status(500).json({ error: "Failed to retrieve user accounts." });
  }
});

app.post("/api/users", authenticateToken, requireRole("PPO"), async (req: AuthedRequest, res) => {
  try {
    const { username, password, role, fullName, email, department } = req.body;

    if (!username || !password || !role || !fullName) {
      return res.status(400).json({ error: "Username, password, role, and full name are required." });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    if (!USERNAME_REGEX.test(cleanUsername)) {
      return res.status(400).json({ error: "Username may only contain letters, numbers, dots, underscores, or hyphens." });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `Invalid role "${role}". Allowed roles: ${VALID_ROLES.join(", ")}.` });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long for security compliance." });
    }

    let cleanEmail: string | null = null;
    if (email && String(email).trim()) {
      cleanEmail = String(email).trim().toLowerCase();
      if (!EMAIL_REGEX.test(cleanEmail)) {
        return res.status(400).json({ error: "Invalid email format." });
      }
    }

    // Dept accounts must be locked to a real, known office — this is what the
    // login route later checks the "Department Office" dropdown against.
    let cleanDepartment: string | null = null;
    if (role === "Dept") {
      if (!department || !isValidDepartmentValue(department)) {
        return res.status(400).json({ error: "Please select a valid department office for this account." });
      }
      cleanDepartment = department;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role, full_name, email, department)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (username) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             role = EXCLUDED.role,
             full_name = EXCLUDED.full_name,
             email = EXCLUDED.email,
             department = EXCLUDED.department
       RETURNING id, username, role, full_name as "fullName", email, department, created_at as "createdAt"`,
      [cleanUsername, passwordHash, role, String(fullName).trim(), cleanEmail, cleanDepartment]
    );

    const createdUser = result.rows[0];

    // If a Maintenance Staff member account was created, auto-sync with staff table
    if (role === "Staff") {
      await pool.query(
        `INSERT INTO staff (name, specialty, tags, workload, user_id)
         VALUES ($1, 'Maintenance Specialist', ARRAY['General'], 0, $2)
         ON CONFLICT (name) DO UPDATE SET user_id = EXCLUDED.user_id`,
        [createdUser.fullName, createdUser.id]
      );
    }

    await pool.query("INSERT INTO logs (message) VALUES ($1)", [
      `User account "${createdUser.username}" (${createdUser.role}) created/updated by PPO Admin (${req.user?.username}).`
    ]);

    res.status(201).json({ ok: true, user: createdUser });
  } catch (err: any) {
    console.error("Error creating user account:", err);
    res.status(500).json({ error: err.message || "Failed to create user account." });
  }
});

app.patch("/api/users/:id", authenticateToken, requireRole("PPO"), async (req: AuthedRequest, res) => {
  try {
    const userId = Number(req.params.id);
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID." });
    }

    const { fullName, email, department } = req.body;
    if (!fullName || !String(fullName).trim()) {
      return res.status(400).json({ error: "Full name is required." });
    }

    let cleanEmail: string | null = null;
    if (email && String(email).trim()) {
      cleanEmail = String(email).trim().toLowerCase();
      if (!EMAIL_REGEX.test(cleanEmail)) {
        return res.status(400).json({ error: "Invalid email format." });
      }
    }

    const check = await pool.query("SELECT username, role, department FROM users WHERE id = $1", [userId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: "User account not found." });
    }
    const targetUser = check.rows[0];

    // Only touch department for Dept-role accounts, and only if a value was
    // actually provided — otherwise leave whatever is already stored alone.
    let cleanDepartment: string | null = targetUser.department;
    if (targetUser.role === "Dept" && department !== undefined) {
      if (!department || !isValidDepartmentValue(department)) {
        return res.status(400).json({ error: "Please select a valid department office for this account." });
      }
      cleanDepartment = department;
    }

    const result = await pool.query(
      `UPDATE users
       SET full_name = $1, email = $2, department = $3
       WHERE id = $4
       RETURNING id, username, role, full_name as "fullName", email, department, created_at as "createdAt"`,
      [String(fullName).trim(), cleanEmail, cleanDepartment, userId]
    );

    await pool.query("INSERT INTO logs (message) VALUES ($1)", [
      `User account "${targetUser.username}" (${targetUser.role}) name/email updated by PPO Admin (${req.user?.username}).`
    ]);

    res.json({ ok: true, user: result.rows[0] });
  } catch (err: any) {
    console.error("Error updating user account:", err);
    res.status(500).json({ error: err.message || "Failed to update user account." });
  }
});

app.delete("/api/users/:id", authenticateToken, requireRole("PPO"), async (req: AuthedRequest, res) => {
  const client = await pool.connect();
  try {
    const userId = Number(req.params.id);
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID." });
    }

    if (req.user?.sub === userId) {
      return res.status(400).json({ error: "You cannot delete your own active administrator session." });
    }

    const check = await client.query("SELECT username, role FROM users WHERE id = $1", [userId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: "User account not found." });
    }
    const targetUser = check.rows[0];

    await client.query("BEGIN");

    // Maintenance Staff accounts have a linked row in `staff` (staff.user_id
    // -> users.id). That FK blocks a plain DELETE on `users`, which is why
    // staff accounts (e.g. Delfin Ramirez) failed to delete while non-staff
    // accounts didn't. Clean up the staff side first, in the same
    // transaction, so both sides stay consistent. job_orders.assignedStaff
    // is stored as plain text, so existing job order history is unaffected.
    const linkedStaff = await client.query("SELECT id FROM staff WHERE user_id = $1", [userId]);
    for (const staffRow of linkedStaff.rows) {
      // job_orders.assigned_staff_id is a real FK to staff(id) — separate
      // from the plain-text assigned_staff name column. Unlink it before
      // deleting the staff row; the text name (and full order history)
      // is untouched, only the FK reference is cleared.
      await client.query("UPDATE job_orders SET assigned_staff_id = NULL WHERE assigned_staff_id = $1", [staffRow.id]);
      await client.query("DELETE FROM staff_skills WHERE staff_id = $1", [staffRow.id]);
      await client.query("DELETE FROM staff WHERE id = $1", [staffRow.id]);
    }

    await client.query("DELETE FROM users WHERE id = $1", [userId]);

    await client.query("INSERT INTO logs (message) VALUES ($1)", [
      `User account "${targetUser.username}" (${targetUser.role}) removed by PPO Admin (${req.user?.username}).`
    ]);

    await client.query("COMMIT");

    res.json({ ok: true, message: `Account "${targetUser.username}" removed.` });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Error deleting user account:", err);
    res.status(500).json({ error: "Failed to remove user account." });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------
// OFFICE / DEPARTMENT MANAGEMENT (PPO / Admin only for add & remove) —
// backs the "Office List Management" section of Settings. Reading the list
// is open to any authenticated role since Dept-account creation, and any
// PPO/Finance/President submitting a job order on another office's behalf,
// both need the current office list.
// ---------------------------------------------------------------
app.get("/api/departments", authenticateToken, async (req, res) => {
  try {
    // Always read fresh here rather than the in-memory cache — this
    // endpoint feeds account-creation and job-order dropdowns directly,
    // so it should reflect an add/remove from a moment ago even across
    // multiple server instances, not just this process's cached copy.
    const result = await pool.query(
      "SELECT value, name FROM departments WHERE value IS NOT NULL ORDER BY name ASC"
    );
    res.json({ departments: result.rows });
  } catch (err: any) {
    console.error("Error fetching departments:", err);
    res.status(500).json({ error: "Failed to retrieve office list." });
  }
});

app.post("/api/departments", authenticateToken, requireRole("PPO"), async (req: AuthedRequest, res) => {
  try {
    const { value, name } = req.body;
    if (!value || !String(value).trim() || !name || !String(name).trim()) {
      return res.status(400).json({ error: "Both a short value and a full office name are required." });
    }

    // Same slug shape as every existing office value (e.g. "vpaa",
    // "finance-accounting") — lowercase letters, numbers, and hyphens only.
    const cleanValue = String(value).trim().toLowerCase().replace(/\s+/g, "-");
    if (!/^[a-z0-9-]+$/.test(cleanValue)) {
      return res.status(400).json({ error: "Office value can only contain lowercase letters, numbers, and hyphens." });
    }
    const cleanName = String(name).trim();

    const result = await pool.query(
      `INSERT INTO departments (value, name) VALUES ($1, $2)
       ON CONFLICT (value) DO UPDATE SET name = EXCLUDED.name
       RETURNING value, name`,
      [cleanValue, cleanName]
    );

    await loadDepartmentCache();
    await pool.query("INSERT INTO logs (message) VALUES ($1)", [
      `Office "${cleanName}" (${cleanValue}) added by PPO Admin (${req.user?.username}).`,
    ]);

    res.status(201).json({ ok: true, department: result.rows[0] });
  } catch (err: any) {
    console.error("Error adding office:", err);
    if (err.code === "23505") {
      return res.status(409).json({ error: "An office with that full name already exists." });
    }
    res.status(500).json({ error: "Failed to add office." });
  }
});

app.delete("/api/departments/:value", authenticateToken, requireRole("PPO"), async (req: AuthedRequest, res) => {
  try {
    const value = req.params.value;
    const existing = await pool.query("SELECT value, name FROM departments WHERE value = $1", [value]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Office not found." });
    }
    const office = existing.rows[0];

    // Guard against removing an office that's still actually in use —
    // either a Dept account is locked to it, or it has job order history —
    // so deleting it here can never orphan an account or silently hide
    // existing tickets from their Dept dashboard.
    const accountsUsing = await pool.query("SELECT COUNT(*)::int AS count FROM users WHERE department = $1", [value]);
    if (accountsUsing.rows[0].count > 0) {
      return res.status(409).json({
        error: `Cannot remove "${office.name}" — ${accountsUsing.rows[0].count} account(s) are still assigned to this office. Reassign or remove those accounts first.`,
      });
    }
    const ticketsUsing = await pool.query("SELECT COUNT(*)::int AS count FROM job_orders WHERE office = $1", [office.name]);
    if (ticketsUsing.rows[0].count > 0) {
      return res.status(409).json({
        error: `Cannot remove "${office.name}" — it has ${ticketsUsing.rows[0].count} job order(s) on record. Offices with history can't be deleted.`,
      });
    }

    await pool.query("DELETE FROM departments WHERE value = $1", [value]);
    await loadDepartmentCache();
    await pool.query("INSERT INTO logs (message) VALUES ($1)", [
      `Office "${office.name}" (${value}) removed by PPO Admin (${req.user?.username}).`,
    ]);

    res.json({ ok: true, message: `Office "${office.name}" removed.` });
  } catch (err: any) {
    console.error("Error removing office:", err);
    res.status(500).json({ error: "Failed to remove office." });
  }
});
function calculatePriorityScore(factors: {
  safetyRisk: number;
  operationalImpact: number;
  urgency: number;
  peopleAffected: number;
  resourceCost: number;
}) {
  const score =
    factors.safetyRisk * 6 +
    factors.operationalImpact * 5 +
    factors.urgency * 4 +
    factors.peopleAffected * 3 +
    factors.resourceCost * 2;
  return Math.min(100, Math.max(10, score));
}

function ruleBasedParse(description: string): any {
  const descLower = description.toLowerCase();
  let jobType = "General";
  let safetyRisk = 1;
  let operationalImpact = 1;
  let urgency = 1;
  let peopleAffected = 2;
  let resourceCost = 1;

  if (descLower.includes("elect") || descLower.includes("wire") || descLower.includes("humming") || descLower.includes("flicker") || descLower.includes("outlet") || descLower.includes("power")) {
    jobType = "Electrical";
    safetyRisk = descLower.includes("exposed") || descLower.includes("shock") || descLower.includes("spark") ? 5 : 2;
    operationalImpact = 3;
    urgency = 3;
  } else if (descLower.includes("leak") || descLower.includes("water") || descLower.includes("pipe") || descLower.includes("dripping") || descLower.includes("plumb") || descLower.includes("clog")) {
    jobType = "Plumbing";
    safetyRisk = 2;
    operationalImpact = descLower.includes(" dean") || descLower.includes("server") ? 4 : 2;
    urgency = 4;
  } else if (descLower.includes("cool") || descLower.includes("chiller") || descLower.includes("aircon") || descLower.includes("ac ") || descLower.includes("hvac") || descLower.includes("compressor")) {
    jobType = "HVAC";
    safetyRisk = 2;
    operationalImpact = descLower.includes("server") || descLower.includes("datacenter") ? 5 : 3;
    urgency = descLower.includes("server") ? 5 : 3;
    resourceCost = descLower.includes("chiller") || descLower.includes("cooling tower") ? 5 : 2;
  } else if (descLower.includes("door") || descLower.includes("lock") || descLower.includes("key") || descLower.includes("cabinet") || descLower.includes("wood") || descLower.includes("hinge")) {
    jobType = "Carpentry";
    safetyRisk = descLower.includes("jammed") && descLower.includes("exit") ? 4 : 1;
    operationalImpact = 2;
    urgency = 2;
  } else if (descLower.includes("wall") || descLower.includes("cement") || descLower.includes("concrete") || descLower.includes("brick") || descLower.includes("tile")) {
    jobType = "Masonry";
    safetyRisk = descLower.includes("collapse") || descLower.includes("falling") ? 4 : 1;
    operationalImpact = 2;
    urgency = 2;
  }

  if (descLower.includes("server room") || descLower.includes("datacenter") || descLower.includes("network")) {
    operationalImpact = Math.max(operationalImpact, 5);
    urgency = Math.max(urgency, 5);
    peopleAffected = 5;
  }

  const priorityScore = calculatePriorityScore({ safetyRisk, operationalImpact, urgency, peopleAffected, resourceCost });

  // Build a plain-language paragraph (benefit / impact / risk) from the
  // computed factors, so a fallback-scored ticket reads the same way as
  // a Gemini-scored one in the UI. Local, rule-based control logic —
  // no model call — used when GEMINI_API_KEY is unset or the Gemini
  // request failed.
  const benefit = `Resolving this ${jobType.toLowerCase()} request restores normal use of the affected area for the requesting office.`;
  const impact =
    urgency >= 4
      ? "Left unresolved, it's likely to disrupt more people or worsen quickly the longer it waits."
      : "If it isn't addressed soon, it may cause ongoing inconvenience but isn't expected to escalate rapidly.";
  const risk =
    safetyRisk >= 4
      ? "It carries a real safety hazard and should be treated as a priority."
      : safetyRisk >= 2
        ? "There's a mild safety consideration worth keeping in mind, though it isn't acute."
        : "No significant safety risk is indicated by the description.";
  const explanation = `${benefit} ${impact} ${risk} (Analyzed using local rule-based control logic.)`;

  return { jobType, safetyRisk, operationalImpact, urgency, peopleAffected, resourceCost, priorityScore, explanation };
}

// ---------------------------------------------------------------
// WORKER TASK CAPACITY — the PPO-configurable "max active jobs per
// technician" limit. Persisted server-side in app_settings so it's
// shared across every session/device and can actually be enforced
// here, instead of living only in one browser's localStorage (which
// is where it used to live — the server never saw it and never
// checked it against anything).
// ---------------------------------------------------------------
async function getWorkerTaskLimit(): Promise<number> {
  const result = await pool.query("SELECT value FROM app_settings WHERE key = 'worker_task_limit'");
  const parsed = Number(result.rows[0]?.value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4;
}

// A staff member's real current load: how many OPEN (Pending or In
// Progress) job orders they're on right now — as lead OR as a team
// member — via job_order_staff. This is the team-aware replacement for
// counting assigned_staff_id alone: a technician added as a second/third
// set of hands on a job now counts toward their own capacity too.
async function getActiveTaskCountForStaffId(staffId: number): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS active_count
     FROM job_order_staff jos
     JOIN job_orders jo ON jo.id = jos.job_order_id
     WHERE jos.staff_id = $1 AND jo.status IN ('Pending', 'In Progress')`,
    [staffId]
  );
  return Number(result.rows[0]?.active_count) || 0;
}

// ---------------------------------------------------------------
// TEAM SIZE — how many technicians a request needs, decided the same
// way for every request (not just ones flagged emergency): PPO/AI weighs
// urgency, safety risk, and how many people are affected. A single
// leaking pipe needs one plumber; a major leak near the server room, or
// a safety-critical electrical fault affecting a whole building, needs
// more than one pair of hands working at once — this is what actually
// makes "we'll get someone right on it" true for something urgent.
//
// Deliberately conservative: capped at 3 so a single request never
// silently drains most of the roster, and only scales up when the
// factors that matter (danger, scale, time pressure) say so.
// ---------------------------------------------------------------
function decideTeamSize(factors: {
  safetyRisk: number;
  urgency: number;
  peopleAffected: number;
  isEmergency?: boolean;
}): number {
  let size = 1;

  // High safety risk (exposed wiring, structural, major leak near
  // equipment) — a second technician working alongside the first is
  // standard practice, not a luxury.
  if (factors.safetyRisk >= 4) size = Math.max(size, 2);

  // Time pressure alone (urgent but not necessarily dangerous) also
  // justifies more hands so the job gets done faster, not just sooner
  // in the queue.
  if (factors.urgency >= 4) size = Math.max(size, 2);

  // Large-scale impact (a whole building/campus affected) needs more
  // than two people to actually resolve quickly.
  if (factors.peopleAffected >= 4) size = Math.max(size, 2);

  // Emergency-flagged AND genuinely dangerous or urgent — the
  // combination that should reliably produce a 3-person dispatch.
  if (factors.isEmergency && (factors.safetyRisk >= 4 || factors.urgency >= 5)) {
    size = Math.max(size, 3);
  }

  return Math.min(3, Math.max(1, size));
}

// Selects up to `teamSize` distinct technicians for a job type, ranked
// the same way matchStaffForJobType() ranks a single pick (skill
// proficiency, years of experience, then real current team-aware
// workload), skipping anyone already at the capacity limit. Falls back
// to "Outsource" for whichever seats can't be filled internally rather
// than leaving the request unstaffed.
async function matchTeamForJobType(
  jobType: string,
  teamSize: number
): Promise<{
  team: { id: number; name: string; matchScore: number }[];
  outsourceSeats: number;
  note?: string;
}> {
  const limit = await getWorkerTaskLimit();

  const result = await pool.query(
    `SELECT s.id, s.name, ss.proficiency_level, ss.years_experience,
            COALESCE(active.active_count, 0) AS active_count
     FROM staff s
     JOIN staff_skills ss ON ss.staff_id = s.id
     JOIN skills sk ON sk.id = ss.skill_id
     JOIN job_type_skill_requirements r ON r.skill_id = sk.id
     JOIN job_types jt ON jt.id = r.job_type_id
     LEFT JOIN (
       SELECT jos.staff_id, COUNT(*) AS active_count
       FROM job_order_staff jos
       JOIN job_orders jo ON jo.id = jos.job_order_id
       WHERE jo.status IN ('Pending', 'In Progress')
       GROUP BY jos.staff_id
     ) active ON active.staff_id = s.id
     WHERE jt.name = $1 AND s.user_id IS NOT NULL
     ORDER BY ss.proficiency_level DESC, ss.years_experience DESC, active_count ASC
     LIMIT 20`,
    [jobType]
  );

  const candidates = result.rows.filter((row) => Number(row.active_count) < limit);

  if (result.rows.length === 0) {
    return {
      team: [],
      outsourceSeats: teamSize,
      note: `No internal staff member has a registered skill matching "${jobType}". Recommended to outsource.`,
    };
  }

  const team: { id: number; name: string; matchScore: number }[] = [];
  for (const row of candidates) {
    if (team.length >= teamSize) break;
    const activeLoadPct = Math.min(100, Number(row.active_count) * 20);
    const proficiencyComponent = (Number(row.proficiency_level) / 5) * 55;
    const experienceYears = Number(row.years_experience) || 0;
    const experienceComponent = (Math.min(experienceYears, 10) / 10) * 15;
    const availabilityComponent = ((100 - activeLoadPct) / 100) * 30;
    const matchScore = Math.round(
      Math.min(100, Math.max(0, proficiencyComponent + experienceComponent + availabilityComponent))
    );
    team.push({ id: row.id, name: row.name, matchScore });
  }

  const outsourceSeats = teamSize - team.length;
  const note =
    outsourceSeats > 0
      ? team.length === 0
        ? `Every internal staff member skilled in "${jobType}" is already at the ${limit}-task capacity limit. Recommended to outsource.`
        : `Only ${team.length} of ${teamSize} needed technicians were available under the ${limit}-task capacity limit; the remaining ${outsourceSeats} seat(s) are recommended for outsourcing.`
      : undefined;

  return { team, outsourceSeats, note };
}

// Persists every member of a team (including the lead) into
// job_order_staff. Call this once right after the job_orders row exists
// — on creation, and again whenever PPO adds/removes team members.
async function saveTeamForJobOrder(
  jobOrderId: string,
  team: { id: number; name: string; matchScore: number }[],
  leadStaffId: number | null
) {
  if (team.length === 0) return;
  const values: string[] = [];
  const params: any[] = [];
  team.forEach((member, i) => {
    const base = i * 4;
    values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
    params.push(jobOrderId, member.id, member.id === leadStaffId, member.matchScore);
  });
  await pool.query(
    `INSERT INTO job_order_staff (job_order_id, staff_id, is_lead, match_score)
     VALUES ${values.join(", ")}
     ON CONFLICT (job_order_id, staff_id) DO UPDATE SET is_lead = EXCLUDED.is_lead, match_score = EXCLUDED.match_score`,
    params
  );
}

// Fetches the full team for a set of job order ids in one query and
// returns a Map keyed by job_order_id, each value an array ordered lead
// first. Use this to enrich a list of mapped tickets with
// `assignedStaffList` without an N+1 query per ticket.
async function getTeamsForJobOrders(
  jobOrderIds: string[]
): Promise<Map<string, { id: number; name: string; matchScore: number; isLead: boolean }[]>> {
  const map = new Map<string, { id: number; name: string; matchScore: number; isLead: boolean }[]>();
  if (jobOrderIds.length === 0) return map;
  const result = await pool.query(
    `SELECT jos.job_order_id, jos.staff_id, jos.is_lead, jos.match_score, s.name
     FROM job_order_staff jos
     JOIN staff s ON s.id = jos.staff_id
     WHERE jos.job_order_id = ANY($1)
     ORDER BY jos.is_lead DESC, jos.match_score DESC`,
    [jobOrderIds]
  );
  for (const row of result.rows) {
    const list = map.get(row.job_order_id) || [];
    list.push({ id: row.staff_id, name: row.name, matchScore: row.match_score, isLead: row.is_lead });
    map.set(row.job_order_id, list);
  }
  return map;
}

// Attaches `assignedStaffList` (the full team, lead first) to an array of
// already-mapped tickets, in one batched query. Safe to call on an empty
// array. This is additive — every existing `assignedStaff` /
// `assignedStaffId` (lead) field on the ticket is untouched, so nothing
// that already reads those fields breaks.
async function attachTeams<T extends { id: string }>(tickets: T[]): Promise<(T & { assignedStaffList: any[] })[]> {
  const teams = await getTeamsForJobOrders(tickets.map((t) => t.id));
  return tickets.map((t) => ({ ...t, assignedStaffList: teams.get(t.id) || [] }));
}

async function getStaffIdByName(name: string | undefined | null): Promise<number | null> {
  if (!name || name === "Outsource") return null;
  const result = await pool.query("SELECT id FROM staff WHERE name = $1", [name]);
  return result.rows[0]?.id ?? null;
}

// ---------------------------------------------------------------
// STAFF MATCHING — queries the database (staff_skills + job_type_skill_requirements)
// instead of using hardcoded technician names. Works for the AI path AND the
// rule-based fallback path, and automatically adapts if staff are added/removed.
// ---------------------------------------------------------------
async function matchStaffForJobType(jobType: string): Promise<{ assignedStaff: string; assignedStaffId: number | null; matchScore: number; note?: string }> {
  const limit = await getWorkerTaskLimit();

  // staff.workload is set once at account creation and never updated again
  // anywhere in the app, so it can't reflect who's actually busy. Compute
  // real current load instead: how many of THIS staff member's tickets are
  // still open (Pending or In Progress) right now.
  //
  // NOTE: this previously only ever returned the single top-ranked row
  // (LIMIT 1) and used its active_count purely to influence the match
  // score. It never actually stopped an overloaded technician from being
  // picked — and since assigned_staff_id was never being written on ticket
  // creation (see below), active_count was silently always 0 anyway, so
  // the same top-skilled person kept getting assigned regardless of load.
  // We now pull a shortlist and pick the best-ranked candidate who is
  // still under the configured capacity limit.
  const result = await pool.query(
    `SELECT s.id, s.name, ss.proficiency_level, ss.years_experience,
            COALESCE(active.active_count, 0) AS active_count
     FROM staff s
     JOIN staff_skills ss ON ss.staff_id = s.id
     JOIN skills sk ON sk.id = ss.skill_id
     JOIN job_type_skill_requirements r ON r.skill_id = sk.id
     JOIN job_types jt ON jt.id = r.job_type_id
     LEFT JOIN (
       SELECT jos.staff_id, COUNT(*) AS active_count
       FROM job_order_staff jos
       JOIN job_orders jo ON jo.id = jos.job_order_id
       WHERE jo.status IN ('Pending', 'In Progress')
       GROUP BY jos.staff_id
     ) active ON active.staff_id = s.id
     WHERE jt.name = $1 AND s.user_id IS NOT NULL
     ORDER BY ss.proficiency_level DESC, ss.years_experience DESC, active_count ASC
     LIMIT 20`,
    [jobType]
  );

  if (result.rows.length === 0) {
    return {
      assignedStaff: "Outsource",
      assignedStaffId: null,
      matchScore: 0,
      note: `No internal staff member has a registered skill matching "${jobType}". Recommended to outsource.`,
    };
  }

  const best = result.rows.find((row) => Number(row.active_count) < limit);
  if (!best) {
    return {
      assignedStaff: "Outsource",
      assignedStaffId: null,
      matchScore: 0,
      note: `Every internal staff member skilled in "${jobType}" is already at the ${limit}-task capacity limit. Recommended to outsource.`,
    };
  }

  // Weighted match score: 55% skill proficiency (1-5 scale), 15% years of
  // hands-on experience in that specific skill (capped at 10 years = full
  // credit — beyond that, more years stop meaningfully changing fit), and
  // 30% current availability. Availability is derived from real open-ticket
  // count — each active ticket counts as 20% load, capped at 100% (5+ open
  // tickets). Proficiency was 70% before experience was tracked; experience
  // now takes 15 of those points since a self-rated proficiency level and
  // verified years on the job aren't the same signal.
  const activeLoadPct = Math.min(100, Number(best.active_count) * 20);
  const proficiencyComponent = (Number(best.proficiency_level) / 5) * 55;
  const experienceYears = Number(best.years_experience) || 0;
  const experienceComponent = (Math.min(experienceYears, 10) / 10) * 15;
  const availabilityComponent = ((100 - activeLoadPct) / 100) * 30;
  const matchScore = Math.round(
    Math.min(100, Math.max(0, proficiencyComponent + experienceComponent + availabilityComponent))
  );

  return { assignedStaff: best.name, assignedStaffId: best.id, matchScore };
}

// Looks up the registered email of a maintenance staff member by their
// display name (the same plain-text name stored on job_orders.assigned_staff),
// via their linked user account. Returns null if the name doesn't match a
// staff row, the row isn't linked to a user account yet, or that account
// has no email on file — any of which just means the dispatch email is
// silently skipped rather than the approval failing.
async function getStaffEmailByName(staffName: string): Promise<string | null> {
  if (!staffName || staffName === "Outsource") return null;
  const result = await pool.query(
    `SELECT u.email FROM staff s
     JOIN users u ON u.id = s.user_id
     WHERE s.name = $1`,
    [staffName]
  );
  const email = result.rows[0]?.email;
  return email ? String(email) : null;
}

// Best-effort dispatch email — logs failures instead of throwing, so a
// down/misconfigured email provider never blocks a PPO or Finance approval.
async function notifyStaffOfDispatch(ticket: ReturnType<typeof mapJobOrderRow>) {
  // Email every technician on the job, not just the lead — a team member
  // added purely for extra hands still needs to know they're dispatched.
  const teams = await getTeamsForJobOrders([ticket.id]);
  const team = teams.get(ticket.id) || [];
  const names = team.length > 0 ? team.map((m) => m.name) : [ticket.assignedStaff];

  for (const staffName of names) {
    try {
      const email = await getStaffEmailByName(staffName);
      if (!email) continue;
      await sendTaskDispatchEmail(email, staffName, {
        ticketId: ticket.id,
        office: ticket.office,
        jobType: ticket.jobType,
        description: ticket.description,
        isEmergency: Boolean(ticket.isEmergency),
        estimatedCost: ticket.estimatedCost,
      });
      console.log(`[DISPATCH EMAIL] Sent to ${email} for ${ticket.id} (${staffName})`);
    } catch (err) {
      console.error(`[DISPATCH EMAIL] Failed to email staff for ${ticket.id}:`, err);
    }
  }
}

// Every non-Dept, non-Staff notification role (PPO, President, Finance) can
// have more than one account holding that role at once, so a "notification"
// for that role means "email every user account with that role and an
// email on file" — not just one person.
async function getRoleEmails(role: string): Promise<string[]> {
  const result = await pool.query(
    "SELECT email FROM users WHERE role = $1 AND email IS NOT NULL AND email <> ''",
    [role]
  );
  return result.rows.map((r) => String(r.email));
}

// Dept accounts are locked to one office each (users.department, a short
// value like "vpaa"), while job_orders.office stores the full label
// ("Office of the Vice President for Academic Affairs (VPAA)"). Only the
// Dept account(s) for the SAME office as the ticket should be emailed —
// not every Dept account school-wide.
async function getDeptEmailsForOffice(officeLabel: string): Promise<string[]> {
  const result = await pool.query(
    "SELECT email, department FROM users WHERE role = 'Dept' AND email IS NOT NULL AND email <> ''"
  );
  return result.rows
    .filter((r) => getDeptLabelByValue(r.department) === officeLabel)
    .map((r) => String(r.email));
}

// Best-effort fan-out for a role-wide notification (PPO / President /
// Finance). Each recipient is emailed independently — one bad address
// never stops the rest from going out, and none of this ever throws back
// into the request handler.
async function notifyRoleByEmail(role: string, subject: string, message: string, ticketId: string) {
  try {
    const emails = await getRoleEmails(role);
    for (const email of emails) {
      try {
        await sendGenericNotificationEmail(email, subject, message, ticketId);
      } catch (err) {
        console.error(`[NOTIFICATION EMAIL] Failed to email ${role} account ${email} for ${ticketId}:`, err);
      }
    }
  } catch (err) {
    console.error(`[NOTIFICATION EMAIL] Failed to look up ${role} emails for ${ticketId}:`, err);
  }
}

// Same idea, scoped to the Dept account(s) tied to the ticket's office.
async function notifyDeptByEmail(officeLabel: string, subject: string, message: string, ticketId: string) {
  try {
    const emails = await getDeptEmailsForOffice(officeLabel);
    for (const email of emails) {
      try {
        await sendGenericNotificationEmail(email, subject, message, ticketId);
      } catch (err) {
        console.error(`[NOTIFICATION EMAIL] Failed to email Dept account ${email} for ${ticketId}:`, err);
      }
    }
  } catch (err) {
    console.error(`[NOTIFICATION EMAIL] Failed to look up Dept emails for ${officeLabel} / ${ticketId}:`, err);
  }
}

// ---------------------------------------------------------------
// SKILLS & STAFF-SKILL ASSIGNMENT — lets the PPO manage what each
// maintenance staff member is skilled in and how proficient they are
// (1-5). This is exactly what matchStaffForJobType() above reads from,
// so anything set here directly changes who gets assigned to incoming
// job orders. Registered once, at module scope — NOT inside
// matchStaffForJobType() — so these routes aren't re-registered on
// every job order submission.
// ---------------------------------------------------------------

app.get("/api/skills", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name FROM skills ORDER BY name ASC");
    res.json({ skills: result.rows });
  } catch (err: any) {
    console.error("Error fetching skills:", err);
    res.status(500).json({ error: "Failed to load skills list." });
  }
});

app.post("/api/skills", authenticateToken, requireRole("PPO"), async (req: AuthedRequest, res) => {
  try {
    const { name } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Skill name is required." });
    }
    const result = await pool.query(
      `INSERT INTO skills (name) VALUES ($1)
     ON CONFLICT (name) DO NOTHING
     RETURNING id, name`,
      [String(name).trim()]
    );
    if (result.rows.length === 0) {
      return res.status(409).json({ error: "That skill already exists." });
    }
    res.status(201).json({ skill: result.rows[0] });
  } catch (err: any) {
    console.error("Error creating skill:", err);
    res.status(500).json({ error: "Failed to create skill." });
  }
});

app.get("/api/staff", authenticateToken, requireRole("PPO"), async (req, res) => {
  try {
    // Only staff linked to a real, created account — filters out any
    // legacy/seeded rows with no user_id so the roster can't show
    // technicians nobody actually made an account for. workload is computed
    // live from open tickets (not the stale staff.workload column, which is
    // never updated after account creation) — same formula as the dispatch
    // matcher, so the roster and the dispatch score always agree.
    const staffResult = await pool.query(
      `SELECT s.id, s.name, s.specialty, s.tags, s.user_id, s.degree,
              LEAST(100, COALESCE(active.active_count, 0) * 20) AS workload
       FROM staff s
       LEFT JOIN (
         SELECT jos.staff_id, COUNT(*) AS active_count
         FROM job_order_staff jos
         JOIN job_orders jo ON jo.id = jos.job_order_id
         WHERE jo.status IN ('Pending', 'In Progress')
         GROUP BY jos.staff_id
       ) active ON active.staff_id = s.id
       WHERE s.user_id IS NOT NULL
       ORDER BY s.name ASC`
    );
    const skillsResult = await pool.query(
      `SELECT ss.staff_id, sk.id as skill_id, sk.name as skill_name, ss.proficiency_level, ss.years_experience
     FROM staff_skills ss JOIN skills sk ON sk.id = ss.skill_id`
    );
    const skillsByStaff: Record<number, any[]> = {};
    for (const row of skillsResult.rows) {
      (skillsByStaff[row.staff_id] ||= []).push({
        skillId: row.skill_id, skillName: row.skill_name, proficiency: row.proficiency_level,
        yearsExperience: Number(row.years_experience) || 0,
      });
    }
    res.json({
      staff: staffResult.rows.map((s) => ({
        id: s.id, name: s.name, specialty: s.specialty, tags: s.tags, degree: s.degree ?? undefined,
        workload: s.workload, userId: s.user_id, skills: skillsByStaff[s.id] || [],
      })),
    });
  } catch (err: any) {
    console.error("Error fetching staff roster:", err);
    res.status(500).json({ error: "Failed to load staff roster." });
  }
});

app.post("/api/staff/:id/skills", authenticateToken, requireRole("PPO"), async (req: AuthedRequest, res) => {
  try {
    const staffId = Number(req.params.id);
    const { skillId, proficiency, yearsExperience } = req.body;
    const level = Number(proficiency);
    if (!Number.isInteger(skillId)) return res.status(400).json({ error: "A valid skillId is required." });
    if (!Number.isInteger(level) || level < 1 || level > 5) {
      return res.status(400).json({ error: "Proficiency must be an integer from 1 to 5." });
    }
    // Years of hands-on experience in this specific skill. Optional — defaults
    // to 0 so existing callers that don't send it keep working. Capped at a
    // sane upper bound to keep bad input (e.g. a stray extra digit) from
    // silently dominating the match-score weighting in matchStaffForJobType().
    const experience = yearsExperience === undefined || yearsExperience === null || yearsExperience === ""
      ? 0
      : Number(yearsExperience);
    if (!Number.isFinite(experience) || experience < 0 || experience > 60) {
      return res.status(400).json({ error: "Years of experience must be a number from 0 to 60." });
    }
    const staffCheck = await pool.query("SELECT id, name FROM staff WHERE id = $1", [staffId]);
    if (staffCheck.rows.length === 0) return res.status(404).json({ error: "Staff member not found." });

    await pool.query(
      `INSERT INTO staff_skills (staff_id, skill_id, proficiency_level, years_experience)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (staff_id, skill_id) DO UPDATE SET proficiency_level = EXCLUDED.proficiency_level, years_experience = EXCLUDED.years_experience`,
      [staffId, skillId, level, experience]
    );
    await pool.query("INSERT INTO logs (message) VALUES ($1)", [
      `Skill proficiency updated for ${staffCheck.rows[0].name} by PPO Admin (${req.user?.username}).`,
    ]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error("Error assigning staff skill:", err);
    res.status(500).json({ error: "Failed to save skill assignment." });
  }
});

app.delete("/api/staff/:id/skills/:skillId", authenticateToken, requireRole("PPO"), async (req: AuthedRequest, res) => {
  try {
    await pool.query("DELETE FROM staff_skills WHERE staff_id = $1 AND skill_id = $2", [
      Number(req.params.id), Number(req.params.skillId),
    ]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error("Error removing staff skill:", err);
    res.status(500).json({ error: "Failed to remove skill." });
  }
});

// Sets a maintenance worker's highest relevant qualification (e.g. a TESDA
// NC II certificate, a vocational diploma, or a college degree tied to their
// trade). Free text rather than a fixed list — PPO offices in different
// schools will phrase these differently, and the accreditation names change
// over time. This is descriptive/record-keeping only (shown alongside the
// worker's profile) and is intentionally NOT folded into the dispatch match
// score: unlike proficiency and years_experience, there's no reliable way to
// rank one credential above another across trades, so scoring on it would
// just be guessing. Skill + experience remain the two competency signals
// matchStaffForJobType() actually weighs.
app.patch("/api/staff/:id/degree", authenticateToken, requireRole("PPO"), async (req: AuthedRequest, res) => {
  try {
    const staffId = Number(req.params.id);
    const { degree } = req.body;
    if (typeof degree !== "string") return res.status(400).json({ error: "A degree/qualification string is required." });
    const cleanDegree = degree.trim().slice(0, 150);

    const staffCheck = await pool.query("SELECT id, name FROM staff WHERE id = $1", [staffId]);
    if (staffCheck.rows.length === 0) return res.status(404).json({ error: "Staff member not found." });

    await pool.query("UPDATE staff SET degree = $1 WHERE id = $2", [cleanDegree || null, staffId]);
    await pool.query("INSERT INTO logs (message) VALUES ($1)", [
      `Qualification/degree updated for ${staffCheck.rows[0].name} by PPO Admin (${req.user?.username}).`,
    ]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error("Error updating staff degree:", err);
    res.status(500).json({ error: "Failed to update qualification." });
  }
});

// Removes an orphan/mock worker profile — a `staff` row with no linked login
// account (staff.user_id IS NULL). Real staff profiles are always created
// automatically alongside a "Staff" role user account (see POST /api/users)
// and must be removed by deleting that account instead, so DELETE /api/users/:id
// stays the single source of truth for anything tied to a real login. This
// route exists purely to clean up leftover/test worker rows that never had
// one, so the Worker Rules list reflects exactly the real accounts.
app.delete("/api/staff/:id", authenticateToken, requireRole("PPO"), async (req: AuthedRequest, res) => {
  const client = await pool.connect();
  try {
    const staffId = Number(req.params.id);
    if (!staffId || isNaN(staffId)) {
      return res.status(400).json({ error: "Invalid staff ID." });
    }

    const check = await client.query("SELECT id, name, user_id FROM staff WHERE id = $1", [staffId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: "Worker profile not found." });
    }
    const targetStaff = check.rows[0];

    if (targetStaff.user_id) {
      return res.status(400).json({
        error: "This worker has a linked login account. Delete that user account instead to remove both.",
      });
    }

    await client.query("BEGIN");
    await client.query("UPDATE job_orders SET assigned_staff_id = NULL WHERE assigned_staff_id = $1", [staffId]);
    await client.query("DELETE FROM staff_skills WHERE staff_id = $1", [staffId]);
    await client.query("DELETE FROM staff WHERE id = $1", [staffId]);
    await client.query("INSERT INTO logs (message) VALUES ($1)", [
      `Unlinked/mock worker profile "${targetStaff.name}" removed by PPO Admin (${req.user?.username}).`,
    ]);
    await client.query("COMMIT");

    res.json({ ok: true, message: `Worker profile "${targetStaff.name}" removed.` });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Error deleting staff profile:", err);
    res.status(500).json({ error: "Failed to remove worker profile." });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------
// JOB ORDERS — now reading/writing real Postgres, behind auth
// ---------------------------------------------------------------

app.get("/api/job-orders", authenticateToken, async (req: AuthedRequest, res) => {
  try {
    let ordersResult;

    if (req.user?.role === "Dept") {
      // Dept accounts must only ever see their OWN office's job orders —
      // never other departments' repair requests, costs, or requester
      // names. The JWT doesn't carry `department` (only sub/username/role/
      // fullName), so look it up fresh from the DB every time rather than
      // trusting anything the client could have sent.
      const userResult = await pool.query("SELECT department FROM users WHERE id = $1", [req.user.sub]);
      const deptValue = userResult.rows[0]?.department as string | undefined;
      const officeLabel = deptValue ? getDeptLabelByValue(deptValue) : undefined;

      if (!officeLabel) {
        // No department assigned to this account yet — fail closed (show
        // nothing) rather than accidentally falling through to "show all".
        return res.json({ jobOrders: [], staffRoster: [] });
      }

      ordersResult = await pool.query(
        "SELECT * FROM job_orders WHERE office = $1 ORDER BY priority_score DESC, date_submitted DESC",
        [officeLabel]
      );
    } else if (req.user?.role === "Staff") {
      // A maintenance technician should only ever see tickets actually
      // assigned to THEM — not every other technician's workload. Matches
      // either as the lead (legacy assigned_staff name, from the JWT) OR
      // as a teammate via job_order_staff — a request can now be dispatched
      // to more than one technician, and a teammate needs to see it on
      // their board too, not just the lead.
      ordersResult = await pool.query(
        `SELECT DISTINCT jo.* FROM job_orders jo
         LEFT JOIN job_order_staff jos ON jos.job_order_id = jo.id
         LEFT JOIN staff s ON s.id = jos.staff_id
         WHERE jo.assigned_staff = $1 OR s.name = $1
         ORDER BY jo.priority_score DESC, jo.date_submitted DESC`,
        [req.user.fullName]
      );
    } else {
      // PPO, Finance, and President all legitimately need visibility
      // across every office's requests to dispatch, approve, and audit.
      ordersResult = await pool.query("SELECT * FROM job_orders ORDER BY priority_score DESC, date_submitted DESC");
    }

    // workload computed live from open tickets, same as /api/staff and the
    // dispatch matcher — s.* still provides every other staff column, and
    // this computed column (added last) overrides the stale stored one.
    // active_task_count is the same figure as a raw number (not the 0-100
    // workload %), so the UI can compare it directly against the
    // PPO-configured limit (e.g. "4/4") regardless of what that limit is.
    const staffResult = await pool.query(
      `SELECT s.*, LEAST(100, COALESCE(active.active_count, 0) * 20) AS workload,
              COALESCE(active.active_count, 0) AS active_task_count
       FROM staff s
       LEFT JOIN (
         SELECT jos.staff_id, COUNT(*) AS active_count
         FROM job_order_staff jos
         JOIN job_orders jo ON jo.id = jos.job_order_id
         WHERE jo.status IN ('Pending', 'In Progress')
         GROUP BY jos.staff_id
       ) active ON active.staff_id = s.id
       WHERE s.user_id IS NOT NULL
       ORDER BY s.name ASC`
    );
    const workerTaskLimit = await getWorkerTaskLimit();
    const jobOrders = await attachTeams(ordersResult.rows.map(mapJobOrderRow));
    res.json({
      jobOrders,
      staffRoster: staffResult.rows.map((row) => ({ ...mapStaffRow(row), activeTaskCount: Number(row.active_task_count) })),
      workerTaskLimit,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/logs", authenticateToken, async (req: AuthedRequest, res) => {
  try {
    let logsResult;
    let notifResult;

    if (req.user?.role === "Dept") {
      // Same office-scoping as /api/job-orders: a Dept account should only
      // ever see logs/notifications tied to ITS OWN tickets — never another
      // office's activity. Logs/notifications with no ticket_id (e.g.
      // account-management events) are excluded entirely for this role.
      const userResult = await pool.query("SELECT department FROM users WHERE id = $1", [req.user.sub]);
      const deptValue = userResult.rows[0]?.department as string | undefined;
      const officeLabel = deptValue ? getDeptLabelByValue(deptValue) : undefined;

      if (!officeLabel) {
        return res.json({ logs: [], notifications: [] });
      }

      logsResult = await pool.query(
        `SELECT l.* FROM logs l
         JOIN job_orders jo ON l.ticket_id = jo.id
         WHERE jo.office = $1
         ORDER BY l."timestamp" DESC LIMIT 200`,
        [officeLabel]
      );
      notifResult = await pool.query(
        `SELECT n.* FROM notifications n
         JOIN job_orders jo ON n.ticket_id = jo.id
         WHERE jo.office = $1 AND n.role = 'Dept'
         ORDER BY n."timestamp" DESC LIMIT 200`,
        [officeLabel]
      );
    } else if (req.user?.role === "Staff") {
      // A Staff account should only see logs/notifications about tickets
      // actually assigned to them — not every technician's activity.
      const staffName = req.user.fullName;
      logsResult = await pool.query(
        `SELECT l.* FROM logs l
         JOIN job_orders jo ON l.ticket_id = jo.id
         WHERE jo.assigned_staff = $1
         ORDER BY l."timestamp" DESC LIMIT 200`,
        [staffName]
      );
      notifResult = await pool.query(
        `SELECT n.* FROM notifications n
         JOIN job_orders jo ON n.ticket_id = jo.id
         WHERE jo.assigned_staff = $1 AND n.role = 'Staff'
         ORDER BY n."timestamp" DESC LIMIT 200`,
        [staffName]
      );
    } else {
      // PPO, Finance, and President legitimately need full cross-office
      // visibility to dispatch, approve, and audit the whole system.
      logsResult = await pool.query('SELECT * FROM logs ORDER BY "timestamp" DESC LIMIT 200');
      notifResult = await pool.query('SELECT * FROM notifications ORDER BY "timestamp" DESC LIMIT 200');
    }

    res.json({
      logs: logsResult.rows.map(mapLogRow),
      notifications: notifResult.rows.map(mapNotificationRow),
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// =================================================================
// AI JOB ORDER PARSING — "Intelligence Control Room" (Requisition
// Details Sheet in the UI: Computed Priority Score + Control Room
// Variables card)
// =================================================================
// A Dept account submits a free-text description. This endpoint sends
// it to Gemini (model "gemini-3.5-flash") to classify jobType and score
// safetyRisk / operationalImpact / urgency / peopleAffected / resourceCost
// (1-5 each). calculatePriorityScore() then turns those into the 10-100
// priority_score used to sort the Pending queue, and matchStaffForJobType()
// picks a technician from real skill/workload data. If GEMINI_API_KEY is
// missing, or the Gemini call throws/returns bad JSON, it falls back to
// ruleBasedParse() (keyword matching) so the system keeps working offline.
//
// BENEFITS
//   - PPO no longer has to read every raw description and manually assign
//     a 1-5 score to 5 different risk dimensions before it can be queued.
//   - Descriptions in plain Filipino-English office language ("humming
//     sound sa outlet", "may tumutulo sa CR") get classified without the
//     requester needing to fill out a structured risk form themselves.
//   - Same scoring formula every time -> tickets are genuinely comparable
//     and the priority queue ordering (ORDER BY priority_score DESC) is
//     meaningful rather than "whoever wrote the scariest sentence."
//   - Graceful degradation: rule-based fallback means a Gemini outage or
//     missing API key never blocks new job orders from being created.
//
// IMPACT / CONSEQUENCES
//   - This single call effectively sets the ticket's place in line AND
//     its first-assigned technician — everything downstream (PPO
//     approve, Finance funding, School Head endorsement, staff workload)
//     builds on top of these five numbers.
//   - A `priorityScore > 75` auto-writes a "positioned high in the queue"
//     log entry, so a bad AI score doesn't just misfile a ticket, it can
//     also generate a misleading audit trail entry about why.
//   - Because matchStaffForJobType() runs off the AI's `jobType`, a wrong
//     classification (e.g. an electrical hazard classified as "General")
//     can send the ticket to the wrong specialist or to "Outsource".
//
// OBSTACLES / RISKS
//   - Prompt-only scoring: the model receives no photos, location context,
//     or ticket history, so scores rely entirely on how well the requester
//     described the problem in text.
//   - Silent fallback: when Gemini fails, `ruleBasedParse()` (plain
//     keyword matching) takes over with no indicator shown to PPO in the
//     UI that this ticket wasn't AI-scored — worth surfacing later.
//   - Cost/availability dependency: every submission is a live Gemini API
//     call; rate limits, quota, or an unset GEMINI_API_KEY change scoring
//     behavior without changing the UI.
//   - No confidence score is returned/stored, so PPO has no signal for
//     "this one is borderline, double-check it" vs. a clear-cut case.
//   - `explanation` from Gemini is stored directly into `notes` — treat
//     it as advisory text, not a substitute for PPO's own judgment,
//     especially on anything later marked `isEmergency`.
// =================================================================
// Submit a new job order with AI (or rule-based) analysis — Dept accounts only
app.post("/api/job-orders", authenticateToken, requireRole("Dept", "PPO", "President", "Finance"), async (req, res) => {
  try {
    const { office, description, requestedByName, isEmergency, photoUrl } = req.body;
    if (!description || !office) {
      return res.status(400).json({ error: "Office and Description are required fields." });
    }
    if (!requestedByName || !requestedByName.trim()) {
      return res.status(400).json({ error: "Please enter the full name of the department head making this request." });
    }

    let parsedResult: any;

    if (ai) {
      try {
        const prompt = `
          Analyze this facilities job order request description for Colegio de Santa Catalina de Alejandria:
          "${description}"

          Assign scores from 1 to 5 for the following variables:
          - safetyRisk: 1 (no risk) to 5 (dangerous, exposed wiring, major leak near equipment, structural instability)
          - operationalImpact: 1 (minor annoyance) to 5 (major server shutdown, network outage, classroom halt)
          - urgency: 1 (can wait weeks) to 5 (immediate attention needed)
          - peopleAffected: 1 (<5 people) to 5 (>100 people / entire campus)
          - resourceCost: 1 (very cheap/no materials) to 5 (very expensive parts/special tools)

          Choose a jobType from: "Electrical", "Plumbing", "HVAC", "Carpentry", "Masonry", "General".

          Then write "explanation" as a short natural paragraph (3-5 sentences,
          no headers/labels/bullets) that a PPO officer will read before approving
          this specific request. Weave in, in plain prose:
          - the benefit of acting on it (what fixing this restores or protects),
          - the impact of leaving it unresolved (who/what is affected, how it could
            worsen if delayed),
          - and any risk or obstacle worth flagging (e.g. safety hazard, needs a
            specialist, may require a shutdown, materials may be hard to source).
          Base all of this only on what the description actually says — do not
          invent details it doesn't support.
        `;

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                jobType: { type: Type.STRING },
                safetyRisk: { type: Type.INTEGER },
                operationalImpact: { type: Type.INTEGER },
                urgency: { type: Type.INTEGER },
                peopleAffected: { type: Type.INTEGER },
                resourceCost: { type: Type.INTEGER },
                explanation: { type: Type.STRING },
              },
              required: ["jobType", "safetyRisk", "operationalImpact", "urgency", "peopleAffected", "resourceCost", "explanation"],
            },
          },
        });

        const dataText = response.text ? response.text.trim() : "";
        const parsed = JSON.parse(dataText);

        const priorityScore = calculatePriorityScore({
          safetyRisk: Number(parsed.safetyRisk) || 1,
          operationalImpact: Number(parsed.operationalImpact) || 1,
          urgency: Number(parsed.urgency) || 1,
          peopleAffected: Number(parsed.peopleAffected) || 1,
          resourceCost: Number(parsed.resourceCost) || 1,
        });

        parsedResult = {
          jobType: parsed.jobType || "General",
          safetyRisk: Number(parsed.safetyRisk) || 1,
          operationalImpact: Number(parsed.operationalImpact) || 1,
          urgency: Number(parsed.urgency) || 1,
          peopleAffected: Number(parsed.peopleAffected) || 1,
          resourceCost: Number(parsed.resourceCost) || 1,
          priorityScore,
          explanation: parsed.explanation || "Parsed by Gemini 3.5 Flash with custom rules.",
        };
      } catch (geminiError) {
        console.error("Gemini parsing error, falling back to local parsing:", geminiError);
        parsedResult = ruleBasedParse(description);
      }
    } else {
      parsedResult = ruleBasedParse(description);
    }

    // Team size is decided for EVERY request the same way — not just ones
    // flagged emergency — from the same safetyRisk/urgency/peopleAffected
    // factors that came out of Gemini (or the rule-based fallback) above,
    // plus whether the requester flagged it emergency. A single normal
    // repair still gets one technician; a dangerous or large-scale one
    // gets a team, because a request like that genuinely isn't a one-person
    // job in practice.
    const teamSize = decideTeamSize({
      safetyRisk: parsedResult.safetyRisk,
      urgency: parsedResult.urgency,
      peopleAffected: parsedResult.peopleAffected,
      isEmergency: Boolean(isEmergency),
    });

    // Staff matching now ALWAYS runs against the real database — whether the
    // job type came from Gemini or the rule-based fallback — instead of being
    // baked into either parsing path. This is what makes the assignment
    // reflect real staff skills/workload instead of 4 hardcoded names.
    const matchedTeam = await matchTeamForJobType(parsedResult.jobType, teamSize);
    const lead = matchedTeam.team[0];
    parsedResult.assignedStaff = lead ? lead.name : "Outsource";
    parsedResult.assignedStaffId = lead ? lead.id : null;
    parsedResult.matchScore = lead ? lead.matchScore : 0;
    parsedResult.teamSize = teamSize;
    if (matchedTeam.note) {
      parsedResult.explanation = `${parsedResult.explanation} ${matchedTeam.note}`;
    } else if (teamSize > 1) {
      const teammates = matchedTeam.team.slice(1).map((m) => m.name).join(", ");
      parsedResult.explanation = `${parsedResult.explanation} Dispatched as a ${teamSize}-person team (${matchedTeam.team.map((m) => m.name).join(", ")}) given the urgency/safety factors above.`;
    }

    const ticketIdResult = await pool.query("SELECT nextval('job_orders_id_seq') as next_id");
    const ticketId = `JO-${new Date().getFullYear()}-0${ticketIdResult.rows[0].next_id}`;
    const insertResult = await pool.query(
      `INSERT INTO job_orders
        (id, office, description, job_type, safety_risk, operational_impact, urgency, people_affected, resource_cost, priority_score, status, assigned_staff, assigned_staff_id, match_score, notes, requested_by_name, is_emergency, photo_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Pending',$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        ticketId,
        office,
        description,
        parsedResult.jobType,
        parsedResult.safetyRisk,
        parsedResult.operationalImpact,
        parsedResult.urgency,
        parsedResult.peopleAffected,
        parsedResult.resourceCost,
        parsedResult.priorityScore,
        parsedResult.assignedStaff,
        parsedResult.assignedStaffId,
        parsedResult.matchScore,
        parsedResult.explanation,
        requestedByName.trim(),
        Boolean(isEmergency),
        photoUrl || null,
      ]
    );
    const newTicket = mapJobOrderRow(insertResult.rows[0]);

    // Persist the full team (lead + any teammates) now that the job_orders
    // row exists to reference. If matching came up empty (all internal
    // staff at capacity / no skill match), there's nothing to save here —
    // the ticket stays "Outsource" via assigned_staff, same as before.
    if (matchedTeam.team.length > 0) {
      await saveTeamForJobOrder(newTicket.id, matchedTeam.team, parsedResult.assignedStaffId);
    }

    if (parsedResult.priorityScore > 75) {
      await pool.query("INSERT INTO logs (message, ticket_id) VALUES ($1, $2)", [
        `${newTicket.id} positioned high in the queue due to a high safety risk or operational impact (Score ${parsedResult.priorityScore}).`,
        newTicket.id,
      ]);
    }

    const emergencyTag = newTicket.isEmergency ? "🚨 EMERGENCY REQUEST — " : "";
    const newSubmissionMsg = `${emergencyTag}New job order ${newTicket.id} submitted by ${newTicket.office} — awaiting PPO review.`;
    await pool.query("INSERT INTO notifications (id, message, role, ticket_id) VALUES ($1, $2, 'PPO', $3)", [
      `n_${Date.now()}_ppo_new`,
      newSubmissionMsg,
      newTicket.id,
    ]);
    void notifyRoleByEmail("PPO", `${emergencyTag}New Job Order Submitted — ${newTicket.id}`, newSubmissionMsg, newTicket.id);

    const [enrichedTicket] = await attachTeams([newTicket]);
    res.status(201).json(enrichedTicket);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Failed to process job order." });
  }
});

// ---------------------------------------------------------------
// DELETE a job order — PPO only. Intended for removing test/mock
// requests; cascades through every child table so no orphan rows
// are left behind. The deletion is logged for audit.
// ---------------------------------------------------------------
app.delete("/api/job-orders/:id", authenticateToken, requireRole("PPO"), async (req: AuthedRequest, res) => {
  const client = await pool.connect();
  try {
    const ticketId = req.params.id;
    if (!ticketId) {
      return res.status(400).json({ error: "Job order ID is required." });
    }

    const check = await client.query("SELECT id, office, description FROM job_orders WHERE id = $1", [ticketId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: `Job order "${ticketId}" not found.` });
    }
    const ticket = check.rows[0];

    await client.query("BEGIN");

    // Child tables with FK to job_orders(id) — most have ON DELETE CASCADE
    // in the schema, but we clean up explicitly in case cascade isn't set
    // on every deployment, and to keep the transaction predictable.
    await client.query("DELETE FROM job_order_staff WHERE job_order_id = $1", [ticketId]);
    await client.query("DELETE FROM job_order_provider_assignment WHERE job_order_id = $1", [ticketId]);
    await client.query("DELETE FROM approval_audit_log WHERE job_order_id = $1", [ticketId]);
    await client.query("DELETE FROM notifications WHERE ticket_id = $1", [ticketId]);
    await client.query("DELETE FROM logs WHERE ticket_id = $1", [ticketId]);

    await client.query("DELETE FROM job_orders WHERE id = $1", [ticketId]);

    await client.query("INSERT INTO logs (message) VALUES ($1)", [
      `Job order "${ticketId}" (${ticket.office}) deleted by PPO Admin (${req.user?.username}).`
    ]);

    await client.query("COMMIT");

    res.json({ ok: true, message: `Job order "${ticketId}" has been deleted.` });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Error deleting job order:", err);
    res.status(500).json({ error: "Failed to delete job order." });
  } finally {
    client.release();
  }
});

// Manual priority/staff override — PPO only
app.post("/api/job-orders/override", authenticateToken, requireRole("PPO"), async (req, res) => {
  try {
    // teamStaffIds (optional): full manual control over the team roster,
    // e.g. "add a second technician to this one" from the ticket detail
    // view. When omitted, behavior is unchanged — assignedStaff still only
    // reassigns the lead, exactly as before.
    const { id, assignedStaff, priorityScore, rationale, confirmOverride, teamStaffIds } = req.body;
    const existing = await pool.query("SELECT * FROM job_orders WHERE id = $1", [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: "Job order not found." });

    const ticket = existing.rows[0];
    const newStaff = assignedStaff || ticket.assigned_staff;
    const newScore = priorityScore !== undefined ? Number(priorityScore) : ticket.priority_score;

    // Soft-block on the PPO-configured worker task capacity limit: this is
    // the actual point where a specific technician gets assigned a ticket,
    // so it's the right place to warn. Only checked when the assignment is
    // actually changing to a different (non-Outsource) staff member —
    // re-saving the same assignee, or a priority-only edit, shouldn't warn
    // over a limit that isn't being newly exceeded. If the PPO has already
    // confirmed through the warning (confirmOverride: true), it proceeds
    // and gets logged distinctly so there's an audit trail of who
    // knowingly overloaded a technician and why.
    const isReassigning = newStaff && newStaff !== "Outsource" && newStaff !== ticket.assigned_staff;
    let newStaffId = ticket.assigned_staff_id;
    let capacityWarningAcknowledged = false;
    if (isReassigning) {
      newStaffId = await getStaffIdByName(newStaff);
      if (newStaffId) {
        const limit = await getWorkerTaskLimit();
        const currentLoad = await getActiveTaskCountForStaffId(newStaffId);
        if (currentLoad >= limit && !confirmOverride) {
          return res.status(409).json({
            warning: true,
            error: `${newStaff} is already at the ${limit}-active-task capacity limit (currently has ${currentLoad} active job orders). Assign anyway?`,
            currentLoad,
            limit,
          });
        }
        capacityWarningAcknowledged = currentLoad >= limit && Boolean(confirmOverride);
      }
    } else if (newStaff === "Outsource") {
      newStaffId = null;
    }

    const updateResult = await pool.query(
      "UPDATE job_orders SET assigned_staff = $2, assigned_staff_id = $3, priority_score = $4 WHERE id = $1 RETURNING *",
      [id, newStaff, newStaffId, newScore]
    );

    let logMsg = `Admin overrode ${id}: `;
    if (priorityScore !== undefined && ticket.priority_score !== newScore) logMsg += `Priority Score changed from ${ticket.priority_score} to ${newScore}. `;
    if (assignedStaff && ticket.assigned_staff !== assignedStaff) logMsg += `Staff reassigned from ${ticket.assigned_staff} to ${assignedStaff}. `;
    if (capacityWarningAcknowledged) logMsg += `⚠️ Assigned over the worker task capacity limit — PPO acknowledged the warning. `;

    // Manual team roster update — PPO explicitly set who's on the job.
    // Replaces the current job_order_staff rows for this ticket outright
    // (not additive), so removing someone from the team works too, not
    // just adding. The lead stays whichever staff id ended up in
    // assigned_staff_id above (either just-reassigned, or unchanged).
    if (Array.isArray(teamStaffIds) && teamStaffIds.length > 0) {
      const uniqueIds: number[] = [...new Set(teamStaffIds.map((n: any) => Number(n)).filter((n) => Number.isInteger(n)))];
      const staffRows = await pool.query("SELECT id, name FROM staff WHERE id = ANY($1)", [uniqueIds]);
      const team = uniqueIds
        .map((sid) => staffRows.rows.find((r) => r.id === sid))
        .filter(Boolean)
        .map((r: any) => ({ id: r.id, name: r.name, matchScore: 0 }));
      if (team.length > 0) {
        await pool.query("DELETE FROM job_order_staff WHERE job_order_id = $1", [id]);
        await saveTeamForJobOrder(id, team, newStaffId);
        logMsg += `Team set to: ${team.map((m) => m.name).join(", ")}. `;
      }
    }

    if (rationale) logMsg += `Rationale: "${rationale}"`;

    await pool.query("INSERT INTO logs (message, ticket_id) VALUES ($1, $2)", [logMsg, id]);
    await pool.query("INSERT INTO notifications (id, message, role, ticket_id) VALUES ($1, $2, 'PPO', $3)", [
      `n_${Date.now()}_ppo_ovr`,
      logMsg,
      id,
    ]);
    void notifyRoleByEmail("PPO", `Job Order Override — ${id}`, logMsg, id);

    const [enrichedTicket] = await attachTeams([mapJobOrderRow(updateResult.rows[0])]);
    res.json(enrichedTicket);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Worker task capacity limit — read by anyone logged in (Settings screen,
// dispatch views), changed by PPO only. Persisted in app_settings so the
// limit is shared across every user/device and can actually be enforced
// server-side, instead of living only in whichever browser last set it.
app.get("/api/settings/worker-limit", authenticateToken, async (req, res) => {
  try {
    const limit = await getWorkerTaskLimit();
    res.json({ workerTaskLimit: limit });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/settings/worker-limit", authenticateToken, requireRole("PPO"), async (req, res) => {
  try {
    const parsed = Number(req.body?.limit);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return res.status(400).json({ error: "Worker task limit must be a positive number." });
    }
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('worker_task_limit', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [String(Math.round(parsed))]
    );
    await pool.query("INSERT INTO logs (message) VALUES ($1)", [
      `Maintenance staff task capacity limit changed to ${Math.round(parsed)} active jobs per technician.`,
    ]);
    res.json({ workerTaskLimit: Math.round(parsed) });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Status change — Staff only
app.post("/api/job-orders/status", authenticateToken, requireRole("Staff"), async (req, res) => {
  try {
    const { id, status } = req.body;
    if (!status) {
      return res.status(400).json({ error: "A status value is required." });
    }
    const updateResult = await pool.query(
      `UPDATE job_orders
       SET status = $2::varchar, date_completed = CASE WHEN $2::varchar = 'Completed' THEN NOW() ELSE NULL END
       WHERE id = $1 RETURNING *`,
      [id, status]
    );
    if (updateResult.rows.length === 0) return res.status(404).json({ error: "Job Order not found." });
    const ticket = mapJobOrderRow(updateResult.rows[0]);

    await pool.query("INSERT INTO notifications (id, message, role, ticket_id) VALUES ($1, $2, 'Dept', $3)", [
      `n_${Date.now()}`,
      `Ticket ${id} status updated to ${String(status).toUpperCase()} (Assigned: ${ticket.assignedStaff}).`,
      id,
    ]);
    void notifyDeptByEmail(ticket.office, `Job Order Status Updated — ${id}`, `Ticket ${id} status updated to ${String(status).toUpperCase()} (Assigned: ${ticket.assignedStaff}).`, id);

    // When a technician marks the job Completed, the PPO (the desk that
    // owns the job order board) should hear about it too — previously only
    // the requesting Dept got notified, so a finished job could sit
    // invisible to PPO until someone happened to check the dashboard.
    if (status === "Completed") {
      await pool.query("INSERT INTO notifications (id, message, role, ticket_id) VALUES ($1, $2, 'PPO', $3)", [
        `n_${Date.now()}_ppo_done`,
        `Job Order ${id} (${ticket.office} — ${ticket.jobType}) has been marked COMPLETED by ${ticket.assignedStaff}.`,
        id,
      ]);
      void notifyRoleByEmail("PPO", `Job Order Completed — ${id}`, `Job Order ${id} (${ticket.office} — ${ticket.jobType}) has been marked COMPLETED by ${ticket.assignedStaff}.`, id);
    }

    res.json(ticket);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// School Head endorsement — President only
app.post("/api/job-orders/school-head-approve", authenticateToken, requireRole("President"), async (req, res) => {
  try {
    const { id } = req.body;
    const existing = await pool.query("SELECT * FROM job_orders WHERE id = $1", [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: "Job Order not found." });
    if (!existing.rows[0].ppo_approved) {
      return res.status(400).json({ error: "Job Order must be approved by the Physical Plant Officer (PPO) first." });
    }

    const updateResult = await pool.query("UPDATE job_orders SET school_head_approved = TRUE WHERE id = $1 RETURNING *", [id]);

    await pool.query("INSERT INTO logs (message, ticket_id) VALUES ($1, $2)", [
      `School Head endorsed and authorized Job Order ${id}. Forwarded to Finance Department Head for final funding approval.`,
      id,
    ]);
    await pool.query("INSERT INTO notifications (id, message, role, ticket_id) VALUES ($1, $2, 'Finance', $3)", [
      `n_${Date.now()}_sch`,
      `Job Order ${id} has been endorsed by the School Head. Ready for Finance funding allocation.`,
      id,
    ]);
    void notifyRoleByEmail("Finance", `Job Order Ready for Funding — ${id}`, `Job Order ${id} has been endorsed by the School Head. Ready for Finance funding allocation.`, id);
    await pool.query("INSERT INTO notifications (id, message, role, ticket_id) VALUES ($1, $2, 'Dept', $3)", [
      `n_${Date.now()}_dept_sch`,
      `Your request ${id} has been endorsed by the School Head and forwarded to the Finance Office.`,
      id,
    ]);
    void notifyDeptByEmail(existing.rows[0].office, `Your Request Endorsed by School Head — ${id}`, `Your request ${id} has been endorsed by the School Head and forwarded to the Finance Office.`, id);

    res.json(mapJobOrderRow(updateResult.rows[0]));
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PPO verify & approve — PPO only
app.post("/api/job-orders/ppo-approve", authenticateToken, requireRole("PPO"), async (req: AuthedRequest, res) => {
  try {
    const { id, estimatedCost, emergencyOverride, confirmOverride } = req.body;

    const existing = await pool.query("SELECT * FROM job_orders WHERE id = $1", [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: "Job Order not found." });

    // Capacity check happens here, not just at assignment time — approving
    // (either track) is the moment a ticket actually gets committed to a
    // technician's workload, and it's the step that was silently letting
    // overloaded staff keep stacking up: the emergency track never touches
    // assignment at all (it just approves whoever the ticket already has),
    // and even the normal track never re-verified the assignee was still
    // under capacity by the time someone got around to approving. Legacy
    // tickets created before assigned_staff_id was reliably populated are
    // covered too via the name fallback.
    const existingTicket = existing.rows[0];
    let approvalStaffId: number | null = existingTicket.assigned_staff_id ?? null;
    if (!approvalStaffId) {
      approvalStaffId = await getStaffIdByName(existingTicket.assigned_staff);
    }
    if (approvalStaffId) {
      const limit = await getWorkerTaskLimit();
      const otherActiveResult = await pool.query(
        `SELECT COUNT(*)::int AS c FROM job_orders
         WHERE assigned_staff_id = $1 AND status IN ('Pending', 'In Progress') AND id != $2`,
        [approvalStaffId, id]
      );
      const otherActiveCount = Number(otherActiveResult.rows[0]?.c) || 0;
      if (otherActiveCount >= limit && !confirmOverride) {
        return res.status(409).json({
          warning: true,
          error: `${existingTicket.assigned_staff} is already handling ${otherActiveCount} other active job orders — at or over the ${limit}-task capacity limit. Approve and dispatch this one anyway?`,
          currentLoad: otherActiveCount,
          limit,
        });
      }
    }

    // A request counts as an emergency if the Dept flagged it at submission,
    // OR the PPO is declaring it one now (e.g. Dept didn't tag it but PPO
    // recognizes it's urgent/safety-critical on review).
    const isEmergency = Boolean(existing.rows[0].is_emergency) || Boolean(emergencyOverride);

    if (isEmergency) {
      // Emergency track: PPO approval alone is sufficient. Skip School Head
      // and Finance sign-off, move straight to In Progress, and notify the
      // assigned Staff member immediately so they can act right away.
      const updateResult = await pool.query(
        `UPDATE job_orders
         SET ppo_approved = TRUE, school_head_approved = TRUE, finance_approved = TRUE,
             is_emergency = TRUE, emergency_bypassed = TRUE, status = 'In Progress',
             estimated_cost = COALESCE($2::numeric, estimated_cost)
         WHERE id = $1 RETURNING *`,
        [id, estimatedCost ?? null]
      );
      const ticket = mapJobOrderRow(updateResult.rows[0]);
      const costInfo = ticket.estimatedCost !== undefined ? ` with estimated material/labor cost of ₱${ticket.estimatedCost.toLocaleString()}` : "";
      const capacityNote = confirmOverride ? " ⚠️ Approved over the worker task capacity limit — PPO acknowledged the warning." : "";

      await pool.query("INSERT INTO logs (message, ticket_id) VALUES ($1, $2)", [
        `Physical Plant Officer approved EMERGENCY Job Order ${id}${costInfo}. School Head/Finance sign-off exempted due to urgency. Dispatched directly to ${ticket.assignedStaff}.${capacityNote}`,
        id,
      ]);

      // Real audit trail entry — this is what lets School Head/Finance (or
      // anyone auditing later) see exactly who bypassed their sign-off and why,
      // instead of only inferring it from three booleans flipping at once.
      await pool.query(
        `INSERT INTO approval_audit_log (job_order_id, actor_user_id, action, previous_value, new_value, reason, amount_php)
         VALUES ($1, $2, 'EMERGENCY_OVERRIDE', $3, $4, $5, $6)`,
        [
          id,
          req.user?.sub ?? null,
          "Pending School Head + Finance sign-off",
          "PPO-approved, School Head + Finance auto-set (bypassed)",
          emergencyOverride ? "PPO flagged as emergency at approval time" : "Requester flagged as emergency at submission",
          estimatedCost ?? null,
        ]
      );

      await pool.query("INSERT INTO notifications (id, message, role, ticket_id) VALUES ($1, $2, 'Staff', $3)", [
        `n_${Date.now()}_stf_emg`,
        `🚨 EMERGENCY dispatch: Job Order ${id} approved by PPO and requires immediate action.${costInfo}`,
        id,
      ]);
      await pool.query("INSERT INTO notifications (id, message, role, ticket_id) VALUES ($1, $2, 'Dept', $3)", [
        `n_${Date.now()}_dept_emg`,
        `Your request ${id} was approved as an EMERGENCY by PPO${costInfo} and dispatched immediately to ${ticket.assignedStaff}, bypassing standard School Head/Finance review.`,
        id,
      ]);
      void notifyDeptByEmail(
        ticket.office,
        `🚨 Emergency Job Order Approved — ${id}`,
        `Your request ${id} was approved as an EMERGENCY by PPO${costInfo} and dispatched immediately to ${ticket.assignedStaff}, bypassing standard School Head/Finance review.`,
        id
      );
      // Previously missing: School Head and Finance had no idea a request
      // bypassed them until they happened to notice it in their "already
      // handled" list. They now get the same real-time notification Dept/Staff do.
      await pool.query("INSERT INTO notifications (id, message, role, ticket_id) VALUES ($1, $2, 'President', $3)", [
        `n_${Date.now()}_head_emg`,
        `🚨 Job Order ${id} (${ticket.office}) was approved by PPO under the emergency track${costInfo} — your endorsement was bypassed. Dispatched directly to ${ticket.assignedStaff}.`,
        id,
      ]);
      void notifyRoleByEmail(
        "President",
        `🚨 Emergency Approval Bypassed Your Endorsement — ${id}`,
        `Job Order ${id} (${ticket.office}) was approved by PPO under the emergency track${costInfo} — your endorsement was bypassed. Dispatched directly to ${ticket.assignedStaff}.`,
        id
      );
      await pool.query("INSERT INTO notifications (id, message, role, ticket_id) VALUES ($1, $2, 'Finance', $3)", [
        `n_${Date.now()}_fin_emg`,
        `🚨 Job Order ${id} was approved by PPO under the emergency track${costInfo} — Finance sign-off was bypassed and funding was auto-released. Dispatched directly to ${ticket.assignedStaff}.`,
        id,
      ]);
      void notifyRoleByEmail(
        "Finance",
        `🚨 Emergency Approval Bypassed Finance Sign-off — ${id}`,
        `Job Order ${id} was approved by PPO under the emergency track${costInfo} — Finance sign-off was bypassed and funding was auto-released. Dispatched directly to ${ticket.assignedStaff}.`,
        id
      );

      // Fire-and-forget: don't await inline in the response path, so a slow
      // or unreachable email provider never delays the PPO's emergency approval.
      void notifyStaffOfDispatch(ticket);

      return res.json(ticket);
    }

    // Normal track: unchanged — PPO approval forwards to School Head, then Finance,
    // and Staff is only notified once Finance funds it.
    const updateResult = await pool.query(
      "UPDATE job_orders SET ppo_approved = TRUE, estimated_cost = COALESCE($2::numeric, estimated_cost) WHERE id = $1 RETURNING *",
      [id, estimatedCost ?? null]
    );
    const ticket = mapJobOrderRow(updateResult.rows[0]);

    const costInfo = ticket.estimatedCost !== undefined ? ` with estimated material/labor cost of ₱${ticket.estimatedCost.toLocaleString()}` : "";
    const capacityNote = confirmOverride ? " ⚠️ Approved over the worker task capacity limit — PPO acknowledged the warning." : "";
    await pool.query("INSERT INTO logs (message, ticket_id) VALUES ($1, $2)", [
      `Physical Plant Officer verified and approved Job Order ${id}${costInfo}. Forwarded to School Head for administrative endorsement.${capacityNote}`,
      id,
    ]);
    await pool.query("INSERT INTO notifications (id, message, role, ticket_id) VALUES ($1, $2, 'President', $3)", [
      `n_${Date.now()}_ppo`,
      `Job Order ${id} verified by PPO${costInfo}. Awaiting School Head endorsement.`,
      id,
    ]);
    void notifyRoleByEmail("President", `Job Order Ready for Your Endorsement — ${id}`, `Job Order ${id} verified by PPO${costInfo}. Awaiting School Head endorsement.`, id);
    await pool.query("INSERT INTO notifications (id, message, role, ticket_id) VALUES ($1, $2, 'Dept', $3)", [
      `n_${Date.now()}_dept`,
      `Your request ${id} has been verified & approved by PPO${costInfo}. Ready for School Head administrative endorsement.`,
      id,
    ]);
    void notifyDeptByEmail(ticket.office, `Your Request Approved by PPO — ${id}`, `Your request ${id} has been verified & approved by PPO${costInfo}. Ready for School Head administrative endorsement.`, id);

    res.json(ticket);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Finance approval & fund release — Finance only
app.post("/api/job-orders/finance-approve", authenticateToken, requireRole("Finance"), async (req, res) => {
  try {
    const { id, approvedAmount, estimatedCost, financeNotes } = req.body;
    const existing = await pool.query("SELECT * FROM job_orders WHERE id = $1", [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: "Job Order not found." });
    if (!existing.rows[0].ppo_approved || !existing.rows[0].school_head_approved) {
      return res.status(400).json({ error: "Job Order must be approved by the PPO and endorsed by the School Head first." });
    }

    const updateResult = await pool.query(
      `UPDATE job_orders
       SET finance_approved = TRUE, status = 'In Progress',
           approved_amount = COALESCE($2, approved_amount),
           estimated_cost = COALESCE($3, estimated_cost),
           finance_notes = COALESCE($4, finance_notes)
       WHERE id = $1 RETURNING *`,
      [id, approvedAmount ?? null, estimatedCost ?? null, financeNotes ?? null]
    );
    const ticket = mapJobOrderRow(updateResult.rows[0]);

    const approvedInfo = ticket.approvedAmount !== undefined ? ` ₱${ticket.approvedAmount.toLocaleString()}` : "";
    const estimatedInfo = ticket.estimatedCost !== undefined ? ` (Est. Cost was ₱${ticket.estimatedCost.toLocaleString()})` : "";
    const notesInfo = ticket.financeNotes ? ` Notes: "${ticket.financeNotes}"` : "";

    await pool.query("INSERT INTO logs (message, ticket_id) VALUES ($1, $2)", [
      `Finance Dept Head approved and allocated funding of${approvedInfo}${estimatedInfo} for Job Order ${id}.${notesInfo} Status set to IN PROGRESS.`,
      id,
    ]);
    await pool.query("INSERT INTO notifications (id, message, role, ticket_id) VALUES ($1, $2, 'Dept', $3)", [
      `n_${Date.now()}_fin`,
      `Job Order ${id} has been approved & funded with${approvedInfo} by Finance. Dispatch initiated to ${ticket.assignedStaff}.`,
      id,
    ]);
    void notifyDeptByEmail(ticket.office, `Your Request Funded — ${id}`, `Job Order ${id} has been approved & funded with${approvedInfo} by Finance. Dispatch initiated to ${ticket.assignedStaff}.`, id);
    await pool.query("INSERT INTO notifications (id, message, role, ticket_id) VALUES ($1, $2, 'Staff', $3)", [
      `n_${Date.now()}_stf`,
      `New funded job order dispatch: ${id} is now In Progress. Funded with${approvedInfo}.`,
      id,
    ]);

    // Fire-and-forget: don't await inline in the response path, so a slow
    // or unreachable email provider never delays Finance's approval.
    void notifyStaffOfDispatch(ticket);

    res.json(ticket);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// AI (or fallback) facilities report — PPO only
app.post("/api/reports/analyze", authenticateToken, requireRole("PPO"), async (req, res) => {
  try {
    const { promptType } = req.body;
    const ordersResult = await pool.query("SELECT * FROM job_orders ORDER BY priority_score DESC");
    const jobOrders = ordersResult.rows.map(mapJobOrderRow);

    let analysisFocus = "General Facilities Maintenance Analysis";
    if (promptType === "bottlenecks") analysisFocus = "Resource Bottlenecks, Staff Workload, and Capacity Planning";
    else if (promptType === "safety") analysisFocus = "Safety Risks, Urgency Levels, and Operational Impact Vulnerability Audit";
    else if (promptType === "balancing") analysisFocus = "Staff Specialty Match Accuracy, Workload Balancing, and Maintenance Speed Insights";

    if (!ai) {
      const pending = jobOrders.filter((j) => j.status === "Pending").length;
      const inProgress = jobOrders.filter((j) => j.status === "In Progress").length;
      const completed = jobOrders.filter((j) => j.status === "Completed").length;
      const critical = jobOrders.filter((j) => j.priorityScore > 75).map((t) => `${t.id} - ${t.office}`).join(", ") || "No critical backlog items detected.";

      return res.json({
        report: `## ${analysisFocus} (Local Fallback Analysis)

*Note: The intelligence core is currently running in fallback mode because no active Gemini API key is configured.*

- **Total Job Tickets**: ${jobOrders.length}
- **Pending/Backlog**: ${pending} tickets
- **Currently In Progress**: ${inProgress} tickets
- **Fully Resolved**: ${completed} tickets
- **Critical High Priority Backlog (Priority Score > 75)**: ${critical}`,
      });
    }

    const ticketsSummary = jobOrders.map((t) => ({
      id: t.id, office: t.office, description: t.description, jobType: t.jobType,
      safetyRisk: t.safetyRisk, operationalImpact: t.operationalImpact, urgency: t.urgency,
      peopleAffected: t.peopleAffected, priorityScore: t.priorityScore, status: t.status, assignedStaff: t.assignedStaff,
    }));

    const prompt = `
      You are the COSCA Facilities Intelligence Analyst Bot for Colegio de Santa Catalina de Alejandria.
      Perform an expert, data-driven analytical facilities audit report focused on: "${analysisFocus}".

      Here is the complete current dataset of Physical Plant Job Orders:
      ${JSON.stringify(ticketsSummary, null, 2)}

      Please structure your response as a highly professional, ready-made executive report using Markdown headers (##, ###), bold points, tables, and bulleted lists, including:
      1. EXECUTIVE SUMMARY
      2. KEY FINDINGS / DATA SUMMARY
      3. DETAILED DIAGNOSTIC (reference ticket IDs)
      4. ACTIONABLE RECOMMENDATIONS (3-4 specific steps)
      Be objective, precise, and professional.
    `;

    const response = await ai.models.generateContent({ model: "gemini-3.5-flash", contents: prompt });
    res.json({ report: response.text ? response.text.trim() : "No report content generated." });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Failed to generate AI report." });
  }
});

async function applySchemaMigrations() {
  try {
    const schemaPath = new URL("./schema.sql", import.meta.url);
    const schemaSql = await fs.readFile(schemaPath, "utf8");
    await pool.query(schemaSql);

    await pool.query("ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(12,2)");
    await pool.query("ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS approved_amount NUMERIC(12,2)");
    await pool.query("ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS finance_notes TEXT");
    await pool.query("ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS ppo_approved BOOLEAN DEFAULT FALSE");
    await pool.query("ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS finance_approved BOOLEAN DEFAULT FALSE");
    await pool.query("ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS school_head_approved BOOLEAN DEFAULT FALSE");
    await pool.query("ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN DEFAULT FALSE");
    await pool.query("ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS people_affected INT DEFAULT 1");
    await pool.query("ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS resource_cost INT DEFAULT 1");
    await pool.query("ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS priority_score INT DEFAULT 10");
    await pool.query("ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS requested_by_user_id INT REFERENCES users(id)");
    await pool.query("ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS requested_by_name VARCHAR(150)");
    await pool.query("ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS photo_url TEXT");
    await pool.query("ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS emergency_bypassed BOOLEAN DEFAULT FALSE");

    // Self-healing FK guardrail: deleting a staff/user account should never
    // be silently blocked by rows that still reference it elsewhere in the
    // schema. Rather than relying on every future feature to remember to
    // null these out in application code (the exact bug we just hit with
    // job_orders.assigned_staff_id), enforce it at the database level so
    // it can't be reintroduced. ON DELETE SET NULL keeps job order/history
    // rows intact — it only clears the now-dangling reference.
    await pool.query("ALTER TABLE job_orders DROP CONSTRAINT IF EXISTS job_orders_assigned_staff_id_fkey");
    await pool.query(
      "ALTER TABLE job_orders ADD CONSTRAINT job_orders_assigned_staff_id_fkey FOREIGN KEY (assigned_staff_id) REFERENCES staff(id) ON DELETE SET NULL"
    );
    await pool.query("ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_user_id_fkey");
    await pool.query(
      "ALTER TABLE staff ADD CONSTRAINT staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL"
    );

    // notifications.role once had a stricter CHECK constraint from an
    // earlier schema revision (Postgres auto-names it notifications_role_check)
    // that predates the current 5-role system and rejects legitimate values
    // like 'PPO' on any database created before this fix. Drop whatever's
    // there and reinstate one that actually matches every role the app
    // writes notifications for today.
    //
    // Old rows are cleaned up BEFORE the constraint is re-added, rather than
    // relying on NOT VALID to skip validation — some environments still hit
    // "constraint is violated by some row" even with NOT VALID (likely a
    // stale existing constraint left the table in a state where the DROP
    // above didn't fully clear before ADD ran, or the runtime's pg version
    // handles this differently). Normalizing the data first means the ADD
    // CONSTRAINT below always succeeds unconditionally, regardless of that.
    // Any row with a role outside the 5 valid values (or NULL) is old test/
    // leftover data — defaulting it to 'PPO' just means it surfaces in the
    // PPO notification feed instead of being lost; nothing user-facing
    // depends on these old rows' exact role.
    // Cordoned off in its own try/catch, separate from every other migration
    // above: this specific constraint has already caused two boot crashes
    // from unexpected pre-existing table state, and it is not critical to
    // startup — every code path that inserts a notification already hard-
    // codes one of the 5 valid role strings, so the DB-level CHECK is
    // defense-in-depth, not something the app depends on to function. If
    // this block fails for any reason on a given machine, log it and keep
    // booting rather than taking the entire backend down over it.
    try {
      await pool.query("ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_role_check");
      await pool.query(
        "UPDATE notifications SET role = 'PPO' WHERE role IS NULL OR role NOT IN ('Dept','Staff','PPO','President','Finance')"
      );
      await pool.query(
        "ALTER TABLE notifications ADD CONSTRAINT notifications_role_check CHECK (role IN ('Dept','Staff','PPO','President','Finance'))"
      );
    } catch (constraintErr: any) {
      console.warn("⚠️  Could not rebuild notifications_role_check (non-fatal, continuing boot):", constraintErr.message);
    }
  } catch (err: any) {
    console.error("Schema migration failed:", err);
    process.exit(1);
  }
}

// ---------------------------------------------------------------
// STATIC FILE SERVING — serve the built React frontend in production.
// In development, Vite's dev server handles this; in production
// (Render, Railway, VPS), Express serves the pre-built dist/ files
// directly so the entire app runs as a single service.
//
// IMPORTANT: This MUST come AFTER all /api/* routes above. Express
// processes routes in registration order, so API endpoints are
// matched first. The catch-all `*` only fires for non-API paths
// (e.g. `/`, `/dashboard`, `/settings`) and serves index.html so
// React Router handles client-side routing.
// ---------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.resolve(__dirname, "../Frontend/dist");

// Serve static assets (JS, CSS, images) from the built frontend
app.use(express.static(frontendDistPath));

// Any request that didn't match an /api/* route gets index.html
// so React Router can handle it client-side.
app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(frontendDistPath, "index.html"));
});

(async () => {
  await applySchemaMigrations();
  await loadDepartmentCache();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`JORS COSCA backend API running on http://0.0.0.0:${PORT}`);
    console.log(`  → Local:   http://localhost:${PORT}`);
    console.log(`  → Network: http://<your-lan-ip>:${PORT}`);
    testConnection();
  });
})();