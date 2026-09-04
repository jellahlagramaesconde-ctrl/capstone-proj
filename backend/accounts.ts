import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { pool } from "./db";

const VALID_ROLES = ["Dept", "Staff", "PPO", "President", "Finance"] as const;
const SALT_ROUNDS = 12;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9._-]+$/;

interface AccountInput {
  username: string;
  password: string;
  role: string;
  fullName: string;
  email?: string | null;
}

async function upsertAccount(input: AccountInput) {
  const { username, password, role, fullName, email } = input;

  if (!username || !password || !role || !fullName) {
    throw new Error("username, password, role, and fullName are all required.");
  }
  const cleanUsername = username.trim().toLowerCase();
  if (!USERNAME_REGEX.test(cleanUsername)) {
    throw new Error(`Invalid username "${username}" — letters, numbers, dots, underscores, hyphens only.`);
  }
  if (!VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
    throw new Error(`Invalid role "${role}". Must be one of: ${VALID_ROLES.join(", ")}`);
  }
  if (password.length < 8) {
    throw new Error(`Password for "${username}" must be at least 8 characters long.`);
  }
  if (email && !EMAIL_REGEX.test(email.trim())) {
    throw new Error(`Invalid email address format for "${username}".`);
  }

  const cleanEmail = email ? email.trim().toLowerCase() : null;
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const result = await pool.query(
    `INSERT INTO users (username, password_hash, role, full_name, email)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (username) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role          = EXCLUDED.role,
           full_name     = EXCLUDED.full_name,
           email         = EXCLUDED.email
     RETURNING id, username, role, full_name, email`,
    [cleanUsername, passwordHash, role, fullName.trim(), cleanEmail]
  );

  return result.rows[0];
}

async function linkStaffAccounts(): Promise<string[]> {
  const result = await pool.query(
    `UPDATE staff s
     SET user_id = u.id
     FROM users u
     WHERE u.full_name = s.name AND u.role = 'Staff' AND s.user_id IS NULL
     RETURNING s.name`
  );
  return result.rows.map((r) => r.name as string);
}

async function runSingle(argv: string[]) {
  const [username, password, role, fullName, email] = argv;
  if (!username || !password || !role || !fullName) {
    console.error('Usage: npx tsx accounts.ts <username> <password> <role> "<Full Name>" [email]');
    console.error(`<role> must be one of: ${VALID_ROLES.join(", ")}`);
    console.error("\nOr for bulk setup:  npx tsx accounts.ts --bulk");
    process.exit(1);
  }

  const account = await upsertAccount({ username, password, role, fullName, email });
  console.log("✅ Account securely created/updated:", account);

  if (account.role === "Staff") {
    const linked = await linkStaffAccounts();
    if (linked.length) console.log(`🔗 Linked to staff table: ${linked.join(", ")}`);
  }
}

async function runBulk() {
  const configPath = path.resolve(process.cwd(), "accounts.config.json");

  console.log("═══════════════════════════════════════════════════");
  console.log("  JORS COSCA — Bulk Account Setup");
  console.log("═══════════════════════════════════════════════════\n");

  if (!fs.existsSync(configPath)) {
    console.error(`❌ Config file not found: ${configPath}\n`);
    console.error("   This file is gitignored on purpose (it holds real passwords).");
    console.error("   Create it first:\n");
    console.error("     cp accounts.config.example.json accounts.config.json\n");
    console.error("   Then edit it with real usernames/passwords and re-run.");
    process.exit(1);
  }

  const accounts: AccountInput[] = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  let ok = 0;
  let failed = 0;

  for (const account of accounts) {
    try {
      const result = await upsertAccount(account);
      console.log(`  ✅ [${result.role.padEnd(9)}] ${result.full_name.padEnd(45)} → ${result.username}`);
      ok++;
    } catch (err: any) {
      console.error(`  ❌ [${account.role ?? "?"}] ${account.username ?? "(unknown)"}: ${err.message}`);
      failed++;
    }
  }

  console.log("\n  🔗 Linking Staff accounts to the staff table...");
  const linked = await linkStaffAccounts();
  console.log(linked.length ? `     → Linked: ${linked.join(", ")}` : "     (already linked / no matches)");

  console.log(`\n  Done: ${ok} account(s) seeded${failed ? `, ${failed} error(s)` : ""}.\n`);
}

// ────────────────────────────────────────────────────────────────
// Entry point — picks the mode based on how you called this file
// ────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  try {
    if (args[0] === "--bulk") {
      await runBulk();
    } else {
      await runSingle(args);
    }
  } catch (err: any) {
    console.error("❌", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
