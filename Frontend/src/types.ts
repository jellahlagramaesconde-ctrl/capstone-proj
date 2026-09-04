export interface BudgetItem {
  id: number;
  jobOrderId: string;
  itemNo: number;
  qty: number;
  unit?: string;
  description: string;
  unitCost: number;
  cost: number;
}

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
  // Itemized budget requisition breakdown — only present in API responses
  // for PPO/Finance/President (Dept/Staff never receive these fields, so
  // `undefined` here doubles as "you're not allowed to see this").
  budgetItems?: BudgetItem[];
  budgetItemsTotal?: number;
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