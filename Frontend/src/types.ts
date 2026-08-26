export interface JobOrder {
  id: string;
  office: string;
  description: string;
  jobType: string;
  safetyRisk: number;
  operationalImpact: number;
  urgency: number;
  peopleAffected: number;
  resourceCost: number;
  priorityScore: number;
  status: "Pending" | "In Progress" | "Completed";
  /** Lead technician's name — kept for backward compat with every existing
   * single-name display. When a request needs more than one technician,
   * check `assignedStaffList` (this same person is in there too, isLead: true). */
  assignedStaff: string;
  matchScore: number;
  /** Full dispatched team, lead first. 1 entry for a normal single-tech
   * request, 2-3 for ones PPO/AI decided needed more hands (high safety
   * risk, high urgency, or large people-affected — not just emergencies).
   * Optional so older cached tickets without it don't break anything that
   * reads it. */
  assignedStaffList?: { id: number; name: string; matchScore: number; isLead: boolean }[];
  dateSubmitted: string;
  dateCompleted: string | null;
  notes: string;
  ppoApproved?: boolean;
  financeApproved?: boolean;
  schoolHeadApproved?: boolean;
  isEmergency?: boolean;
  /** True only when PPO approved this via the emergency track, auto-setting
   * School Head and Finance sign-off rather than them genuinely reviewing it. */
  emergencyBypassed?: boolean;
  /** Base64 data URL (or hosted URL) of the photo attached at submission time. */
  photoUrl?: string;
  estimatedCost?: number;
  approvedAmount?: number;
  financeNotes?: string;
}

export interface Staff {
  name: string;
  specialty: string;
  tags: string[];
  workload: number;
}

export interface LogEntry {
  timestamp: string;
  message: string;
  ticketId: string;
}

export interface Notification {
  id: string;
  timestamp: string;
  message: string;
  role: "PPO" | "Dept" | "Staff" | "Finance" | "President";
}

export type Role = "Admin" | "Dept" | "Staff" | "Report" | "Finance" | "SchoolHead";
export type ThemeMode = "light" | "dark" | "system";