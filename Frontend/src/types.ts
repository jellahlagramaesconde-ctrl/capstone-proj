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
  assignedStaff: string;
  matchScore: number;
  assignedStaffList?: { id: number; name: string; matchScore: number; isLead: boolean }[];
  dateSubmitted: string;
  dateCompleted: string | null;
  notes: string;
  ppoApproved?: boolean;
  financeApproved?: boolean;
  schoolHeadApproved?: boolean;
  isEmergency?: boolean;
  emergencyBypassed?: boolean;
  photoUrl?: string;
  photoUrls?: string[];
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