// ============================================================
// JORS COSCA — Database Migration Script
// From: Render (expired) → To: Supabase (new)
// Run: node migrate-db.mjs
// ============================================================

import pg from "pg";
const { Client } = pg;

// ──────────────────────────────────────────────
// 🔴 STEP 1: Paste your Render (SOURCE) URL here
// ──────────────────────────────────────────────
const SOURCE_URL = "postgresql://jors_cosca_db_user:htfeBaHdymuu8G0UVhc64dos1neikedY@dpg-da7fpme7bikc73ajc98g-a.singapore-postgres.render.com/jors_cosca_db";

// ──────────────────────────────────────────────
// 🟢 STEP 2: Paste your Supabase (TARGET) URL here
// Get it from: Supabase Dashboard → Project Settings → Database → Connection String (URI)
// ──────────────────────────────────────────────
const TARGET_URL = postgresql://postgres:projectQHYiXovUYGD5mo71
@db.lufyjjcylwgwqckyhzts.supabase.co: 5432 / postgres
// ──────────────────────────────────────────────

const TABLES = [
  "users",
  "password_resets",
  "app_settings",
  "departments",
  "job_types",
  "skills",
  "staff",
  "staff_skills",
  "job_type_skill_requirements",
  "external_providers",
  "job_orders",
  "job_order_photos",
  "job_order_staff",
  "job_order_provider_assignment",
  "budget_allocations",
  "logs",
  "notifications",
  "approval_audit_log",
  "budget_requisition_items",
];

async function migrate() {
  if (TARGET_URL === "PASTE_YOUR_SUPABASE_URL_HERE") {
    console.error("❌ Please paste your Supabase URL in the TARGET_URL field first!");
    process.exit(1);
  }

  console.log("🔌 Connecting to SOURCE (Render)...");
  const source = new Client({ connectionString: SOURCE_URL, ssl: { rejectUnauthorized: false } });
  await source.connect();
  console.log("✅ Connected to Render!\n");

  console.log("🔌 Connecting to TARGET (Supabase)...");
  const target = new Client({ connectionString: TARGET_URL, ssl: { rejectUnauthorized: false } });
  await target.connect();
  console.log("✅ Connected to Supabase!\n");

  // Run schema on target first
  console.log("📋 Setting up schema on Supabase...");
  const { readFileSync } = await import("fs");
  const schema = readFileSync("./backend/schema.sql", "utf-8");
  try {
    await target.query(schema);
    console.log("✅ Schema created!\n");
  } catch (err) {
    console.log("⚠️  Schema already exists or partial error (continuing):", err.message, "\n");
  }

  // Disable triggers on target temporarily
  await target.query("SET session_replication_role = replica;");

  // Migrate each table
  for (const table of TABLES) {
    try {
      const { rows } = await source.query(`SELECT * FROM ${table}`);
      if (rows.length === 0) {
        console.log(`⏭️  ${table}: empty, skipping`);
        continue;
      }

      // Clear existing data in target
      await target.query(`DELETE FROM ${table}`);

      // Build INSERT
      const cols = Object.keys(rows[0]);
      const colList = cols.map(c => `"${c}"`).join(", ");

      let inserted = 0;
      for (const row of rows) {
        const vals = cols.map((_, i) => `$${i + 1}`).join(", ");
        const values = cols.map(c => row[c]);
        try {
          await target.query(
            `INSERT INTO ${table} (${colList}) VALUES (${vals}) ON CONFLICT DO NOTHING`,
            values
          );
          inserted++;
        } catch (e) {
          console.log(`  ⚠️  Skipped a row in ${table}: ${e.message}`);
        }
      }

      console.log(`✅ ${table}: ${inserted}/${rows.length} rows migrated`);
    } catch (err) {
      console.log(`❌ ${table}: ${err.message}`);
    }
  }

  // Re-enable triggers
  await target.query("SET session_replication_role = DEFAULT;");

  // Reset sequences so new inserts don't conflict
  console.log("\n🔄 Resetting sequences...");
  const seqTables = [
    { seq: "users_id_seq", table: "users" },
    { seq: "staff_id_seq", table: "staff" },
    { seq: "job_orders_id_seq", table: "job_orders" },
    { seq: "logs_id_seq", table: "logs" },
    { seq: "budget_requisition_items_id_seq", table: "budget_requisition_items" },
  ];
  for (const { seq, table } of seqTables) {
    try {
      await target.query(`SELECT setval('${seq}', COALESCE((SELECT MAX(id) FROM ${table}), 1))`);
      console.log(`  ✅ Reset ${seq}`);
    } catch (e) {
      console.log(`  ⚠️  Could not reset ${seq}: ${e.message}`);
    }
  }

  await source.end();
  await target.end();

  console.log("\n🎉 Migration complete! Your data is now in Supabase.");
  console.log("👉 Next step: Update your backend .env with the new Supabase DATABASE_URL");
}

migrate().catch(err => {
  console.error("❌ Migration failed:", err.message);
  process.exit(1);
});
