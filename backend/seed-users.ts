/**
 * JORS COSCA — Database Seed Script
 * Colegio de Santa Catalina de Alejandria (COSCA)
 *
 * Creates all system accounts with bcrypt-hashed passwords.
 * Safe to re-run: uses ON CONFLICT (username) DO UPDATE.
 *
 * Usage:
 *   npx tsx seed-users.ts
 *
 * Make sure your .env is configured before running.
 */

import bcrypt from "bcryptjs";
import { pool } from "./db";
import dotenv from "dotenv";

dotenv.config();

const SALT_ROUNDS = 12;

// ──────────────────────────────────────────────────────────────
// SYSTEM ACCOUNTS
// Change passwords before deploying to production!
// ──────────────────────────────────────────────────────────────
const ACCOUNTS = [

  // ─── PPO Admin Head ───────────────────────────────────────
  {
    username: "ppo.head",
    password: "ppo@cosca2026",
    role: "PPO",
    fullName: "Engr. Lilibeth P. Gauma",
    email: "ppo@cosca.edu.ph",
  },

  // ─── Finance Department Head ──────────────────────────────
  {
    username: "finance.head",
    password: "finance@cosca2026",
    role: "Finance",
    fullName: "Ms. Mary Magdalene Z. Villegas, CPA",
    email: "finance@cosca.edu.ph",
  },

  // ─── School President / Directress ────────────────────────
  {
    username: "president.head",
    password: "president@cosca2026",
    role: "President",
    fullName: "Sr. Ma. Assumpta A. Alinea, OSA, EdD",
    email: "president@cosca.edu.ph",
  },

  // ─── Maintenance Staff Accounts ───────────────────────────
  {
    username: "delfin.ramirez",
    password: "staff@cosca2026",
    role: "Staff",
    fullName: "Delfin Ramirez",
    email: "delfin@cosca.edu.ph",
  },
  {
    username: "roberto.santos",
    password: "staff@cosca2026",
    role: "Staff",
    fullName: "Roberto Santos",
    email: "roberto@cosca.edu.ph",
  },
  {
    username: "mariano.garcia",
    password: "staff@cosca2026",
    role: "Staff",
    fullName: "Mariano Garcia",
    email: "mariano@cosca.edu.ph",
  },
  {
    username: "esteban.cruz",
    password: "staff@cosca2026",
    role: "Staff",
    fullName: "Esteban Cruz",
    email: "esteban@cosca.edu.ph",
  },

  // ─── Requesting Department Accounts ───────────────────────
  {
    username: "academic.affairs",
    password: "dept@cosca2026",
    role: "Dept",
    fullName: "Academic Affairs Office",
    email: "academic@cosca.edu.ph",
  },
  {
    username: "guidance.office",
    password: "dept@cosca2026",
    role: "Dept",
    fullName: "Guidance and Counseling Office",
    email: "guidance@cosca.edu.ph",
  },
  {
    username: "registrar.office",
    password: "dept@cosca2026",
    role: "Dept",
    fullName: "Registrar's Office",
    email: "registrar@cosca.edu.ph",
  },
  {
    username: "library.office",
    password: "dept@cosca2026",
    role: "Dept",
    fullName: "Library",
    email: "library@cosca.edu.ph",
  },
  {
    username: "ict.office",
    password: "dept@cosca2026",
    role: "Dept",
    fullName: "ICT Office",
    email: "ict@cosca.edu.ph",
  },
  {
    username: "science.dept",
    password: "dept@cosca2026",
    role: "Dept",
    fullName: "Science Department",
    email: "science@cosca.edu.ph",
  },
  {
    username: "hrm.dept",
    password: "dept@cosca2026",
    role: "Dept",
    fullName: "HRM Department",
    email: "hrm@cosca.edu.ph",
  },
  {
    username: "campus.ministry",
    password: "dept@cosca2026",
    role: "Dept",
    fullName: "Campus Ministry",
    email: "ministry@cosca.edu.ph",
  },
];

// ──────────────────────────────────────────────────────────────
async function seed() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  JORS COSCA — Database Seeder");
  console.log("  Colegio de Santa Catalina de Alejandria (COSCA)");
  console.log("═══════════════════════════════════════════════════\n");

  let seededCount = 0;
  let errorCount = 0;

  for (const account of ACCOUNTS) {
    try {
      const passwordHash = await bcrypt.hash(account.password, SALT_ROUNDS);

      await pool.query(
        `INSERT INTO users (username, password_hash, role, full_name, email)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (username) DO UPDATE
           SET password_hash = EXCLUDED.password_hash,
               role          = EXCLUDED.role,
               full_name     = EXCLUDED.full_name,
               email         = EXCLUDED.email`,
        [account.username, passwordHash, account.role, account.fullName, account.email]
      );

      const roleLabel = account.role.padEnd(9);
      console.log(`  ✅ [${roleLabel}] ${account.fullName.padEnd(45)} → ${account.username}`);
      seededCount++;
    } catch (err: any) {
      console.error(`  ❌ [${account.role}] Failed to seed ${account.username}: ${err.message}`);
      errorCount++;
    }
  }

  // Link staff user accounts to staff table rows
  console.log("\n  🔗 Linking Staff user accounts to staff table...");
  try {
    const linkResult = await pool.query(
      `UPDATE staff s
       SET user_id = u.id
       FROM users u
       WHERE u.full_name = s.name AND u.role = 'Staff' AND s.user_id IS NULL
       RETURNING s.name`
    );
    if (linkResult.rowCount && linkResult.rowCount > 0) {
      linkResult.rows.forEach((r) => console.log(`     → Linked: ${r.name}`));
    } else {
      console.log("     (All staff already linked or no matches)");
    }
  } catch (err: any) {
    console.warn("  ⚠️  Could not link staff accounts:", err.message);
  }

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(
    `  Done: ${seededCount} account(s) seeded${errorCount ? `, ${errorCount} error(s)` : " successfully"}.`
  );
  console.log("═══════════════════════════════════════════════════\n");

  await pool.end();
}

seed().catch((err) => {
  console.error("Fatal seed error:", err);
  process.exit(1);
});
