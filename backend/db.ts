import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

pool.on("error", (err: Error) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
});

export async function testConnection() {
  try {
    const client = await pool.connect();
    console.log("✅ Connected to PostgreSQL (jors_cosca)");
    client.release();
  } catch (err) {
    console.error("❌ Could not connect to PostgreSQL:", err);
  }
}

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

// qty * unit_cost is computed here rather than stored in the DB, so a
// changed unit_cost never leaves a stale `cost` value lying around.
export function mapBudgetItemRow(row: any) {
  const qty = Number(row.qty);
  const unitCost = Number(row.unit_cost);
  return {
    id: row.id,
    jobOrderId: row.job_order_id,
    itemNo: row.item_no,
    qty,
    unit: row.unit,
    description: row.description,
    unitCost,
    cost: qty * unitCost,
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