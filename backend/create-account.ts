// Create a single real account with a password you choose.
// Usage:
//   npx tsx create-account.ts <username> <password> <role> "<Full Name>" [email]
//
// <role> must be one of: Dept | Staff | PPO | President | Finance
//
// Examples:
//   npx tsx create-account.ts academic.affairs "S0meRealPassword!" Dept "Academic Affairs Office"
//   npx tsx create-account.ts j.delacruz "AnotherRealPin123" Staff "Juan Dela Cruz"
//   npx tsx create-account.ts ppo.head "StrongAdminKey!2026" PPO "Engr. Lilibeth P. Gauma" luiza@cosca.edu.ph

import bcrypt from "bcryptjs";
import { pool } from "./db";

const VALID_ROLES = ["Dept", "Staff", "PPO", "President", "Finance"];
const SALT_ROUNDS = 12;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9._-]+$/;

async function main() {
  const [, , username, password, role, fullName, email] = process.argv;

  if (!username || !password || !role || !fullName) {
    console.error('Usage: npx tsx create-account.ts <username> <password> <role> "<Full Name>" [email]');
    console.error(`<role> must be one of: ${VALID_ROLES.join(", ")}`);
    process.exit(1);
  }

  const cleanUsername = username.trim().toLowerCase();

  if (!USERNAME_REGEX.test(cleanUsername)) {
    console.error("Invalid username format. Usernames should only contain alphanumeric characters, dots, underscores, or hyphens.");
    process.exit(1);
  }

  if (!VALID_ROLES.includes(role)) {
    console.error(`Invalid role "${role}". Must be one of: ${VALID_ROLES.join(", ")}`);
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Security Error: Password must be at least 8 characters long.");
    process.exit(1);
  }

  if (email && !EMAIL_REGEX.test(email.trim())) {
    console.error("Security Error: Invalid email address format.");
    process.exit(1);
  }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const cleanEmail = email ? email.trim().toLowerCase() : null;
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role, full_name, email)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             role = EXCLUDED.role,
             full_name = EXCLUDED.full_name,
             email = EXCLUDED.email
       RETURNING id, username, role, full_name, email`,
      [cleanUsername, passwordHash, role, fullName.trim(), cleanEmail]
    );
    console.log("✅ Account securely created/updated:", result.rows[0]);
  } catch (err: any) {
    console.error("❌ Failed to create account:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();