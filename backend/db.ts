import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

// Reads DATABASE_URL from your .env file, e.g.:
// DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/jors_cosca"
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("error", (err: Error) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
});

// Quick helper to confirm the DB is reachable when the server boots
export async function testConnection() {
  try {
    const client = await pool.connect();
    console.log("✅ Connected to PostgreSQL (jors_cosca)");
    client.release();
  } catch (err) {
    console.error("❌ Could not connect to PostgreSQL:", err);
  }
}

// The DB uses snake_case columns; the frontend (types.ts) expects camelCase.
// These helpers translate between the two so nothing else in the app has to change.
export function mapJobOrderRow(row: any) {
  return {
    id: row.id,
    office: row.office,
    description: row.description,
    jobType: row.job_type,
    safetyRisk: row.safety_risk,
    operationalImpact: row.operational_impact,
    urgency: row.urgency,
    peopleAffected: row.people_affected,
    resourceCost: row.resource_cost,
    priorityScore: Number(row.priority_score),
    status: row.status,
    assignedStaff: row.assigned_staff,
    matchScore: row.match_score,
    dateSubmitted: row.date_submitted,
    dateCompleted: row.date_completed,
    notes: row.notes,
    ppoApproved: row.ppo_approved,
    financeApproved: row.finance_approved,
    schoolHeadApproved: row.school_head_approved,
    isEmergency: row.is_emergency,
    emergencyBypassed: row.emergency_bypassed,
    photoUrl: row.photo_url ?? undefined,
    estimatedCost: row.estimated_cost !== null && row.estimated_cost !== undefined ? Number(row.estimated_cost) : undefined,
    approvedAmount: row.approved_amount !== null && row.approved_amount !== undefined ? Number(row.approved_amount) : undefined,
    financeNotes: row.finance_notes ?? undefined,
  };
}

export function mapStaffRow(row: any) {
  return {
    name: row.name,
    specialty: row.specialty,
    tags: row.tags,
    workload: row.workload,
  };
}

export function mapLogRow(row: any) {
  return {
    timestamp: row.timestamp,
    message: row.message,
    ticketId: row.ticket_id,
  };
}

export function mapNotificationRow(row: any) {
  return {
    id: row.id,
    timestamp: row.timestamp,
    message: row.message,
    role: row.role,
  };
}