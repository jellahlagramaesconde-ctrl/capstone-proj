import React, { useState, useMemo } from "react";
import { JobOrder, Staff, LogEntry, Notification, StaffCandidate } from "../types";
import { TicketStub } from "./TicketStub";
import { TicketDetailsModal } from "./TicketDetailsModal";
import { NewJobOrderButton } from "./NewJobOrderButton";
import { AccountManagementModal, UserAccount } from "./AccountManagementModal";
import { formatPeso, sumJobOrderCosts } from "../priceUtils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { RefreshCw, Download, Sliders, Users, FileText, CheckCircle, ChevronDown, Check, GraduationCap, Inbox, Clock, Wallet, UserCheck, AlertTriangle, UserPlus, Plus, X, User } from "lucide-react";

interface AdminDashboardProps {
  tickets: JobOrder[];
  staffRoster: Staff[];
  logs: LogEntry[];
  userAccounts?: UserAccount[];
  onCreateUser?: (userData: { username: string; password: string; role: string; fullName: string; email?: string }) => Promise<{ ok: boolean; error?: string }>;
  onDeleteUser?: (id: number) => Promise<{ ok: boolean; error?: string }>;
  onDeleteJobOrder?: (ticketId: string) => Promise<{ ok: boolean; error?: string }>;
  onOverride: (id: string, assignedStaff: string, priorityScore: number, rationale: string, teamStaffIds?: number[]) => Promise<{ ok: boolean; error?: string }> | void;
  onApprove: (id: string, estimatedCost?: number, emergencyOverride?: boolean, confirmOverride?: boolean, requiresFunds?: boolean) => void;
  onUpdateStatus: (id: string, status: "Pending" | "In Progress" | "Completed") => void;
  onTicketClick?: (ticketId: string) => void;
  onSchoolHeadApprove: (id: string) => void;
  onFinanceApprove: (id: string, approvedAmount?: number, estimatedCost?: number, financeNotes?: string) => void;
  onPpoBypassPresident?: (id: string, reason: string) => Promise<void>;
  onSaveBudgetItems?: (ticketId: string, items: { qty: number; unit?: string; description: string; unitCost: number }[]) => Promise<void>;
  onExtendDeadline?: (ticketId: string, params: { extensionHours?: number; extensionDays?: number; newDeadline?: string; reason: string }) => Promise<{ ok: boolean; error?: string } | void>;
  onSubmitRequest?: (office: string, description: string, requestedByName: string, isEmergency: boolean, photoUrls?: string[], requiresFunds?: boolean) => Promise<void>;
  isSubmitting?: boolean;
  officeOptions?: string[];
  requestedByDefault?: string;
  aiEnabled?: boolean;
  notifications?: Notification[];
  readNotificationIds?: Set<string>;
  onMarkNotificationsRead?: (ids: string[]) => void;
  /** PPO-configured max active jobs per technician (app_settings.worker_task_limit),
   * passed down from App.tsx. Not yet displayed here — declared so App.tsx can
   * pass it through without a type error; wire it into the Staff Workload Roster
   * (e.g. "3/{maxWorkerTaskLimit} active") whenever that's wanted. */
  maxWorkerTaskLimit?: number;
  authedFetch?: (url: string, options?: RequestInit) => Promise<Response>;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  tickets,
  staffRoster,
  logs,
  userAccounts = [],
  onCreateUser,
  onDeleteUser,
  onDeleteJobOrder,
  onOverride,
  onApprove,
  onUpdateStatus,
  onTicketClick,
  onSchoolHeadApprove,
  onFinanceApprove,
  onPpoBypassPresident,
  onSaveBudgetItems,
  onExtendDeadline,
  onSubmitRequest,
  isSubmitting = false,
  officeOptions,
  requestedByDefault,
  notifications = [],
  readNotificationIds = new Set(),
  onMarkNotificationsRead = () => { },
  maxWorkerTaskLimit,
  authedFetch,
}) => {
  // Account Management Modal state
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  // Sorting & Filtering State
  const [filterType, setFilterType] = useState<string>("All");
  const [activeSubTab, setActiveSubTab] = useState<"president" | "ppo" | "finance" | "all">("ppo");
  const [selectedTicket, setSelectedTicket] = useState<JobOrder | null>(null);

  // Local PPO Cost Input State
  const [ppoCosts, setPpoCosts] = useState<Record<string, string>>({});

  // (Emergency override removed — emergency status is set by the Department at submission.
  //  All emergency requests follow the full 3-stage approval: PPO → President → Finance.)

  // (Finance cost inputs removed — Finance approves via their own portal, not here)

  // Dialog State for Override Modals
  const [overrideTicket, setOverrideTicket] = useState<JobOrder | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [customScore, setCustomScore] = useState<number>(50);
  const [overrideRationale, setOverrideRationale] = useState<string>("");
  const [overrideTeam, setOverrideTeam] = useState<{ id: number; name: string; matchScore: number; isLead: boolean }[]>([]);
  const [overrideCandidates, setOverrideCandidates] = useState<StaffCandidate[]>([]);
  const [isLoadingOverrideCandidates, setIsLoadingOverrideCandidates] = useState(false);
  const [selectedOverrideAddStaffId, setSelectedOverrideAddStaffId] = useState<string>("");

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // PPO Bypass President modal state
  const [bypassTicketId, setBypassTicketId] = useState<string | null>(null);
  const [bypassReason, setBypassReason] = useState("");
  const [bypassSubmitting, setBypassSubmitting] = useState(false);

  // Per-ticket requires_funds toggle (PPO sets this during approval)
  const [ppoRequiresFunds, setPpoRequiresFunds] = useState<Record<string, boolean>>({});

  // Workflow queue counts — President/Finance tabs only show funded-track tickets
  const { presidentCount, ppoCount, financeCount, allCount } = useMemo(() => {
    return {
      presidentCount: tickets.filter((t) => t.ppoApproved && !t.schoolHeadApproved && t.requiresFunds && t.status !== "Completed").length,
      ppoCount: tickets.filter((t) => !t.ppoApproved && t.status !== "Completed").length,
      financeCount: tickets.filter((t) => t.ppoApproved && t.schoolHeadApproved && !t.financeApproved && t.requiresFunds && t.status !== "Completed").length,
      allCount: tickets.length,
    };
  }, [tickets]);

  // Statistics calculation
  const stats = useMemo(() => {
    const pendingPPO = tickets.filter((t) => t.status === "Pending" && !t.ppoApproved).length;
    const pendingFinance = tickets.filter((t) => t.status === "Pending" && t.ppoApproved && !t.financeApproved).length;
    const inProgress = tickets.filter((t) => t.status === "In Progress").length;
    const completed = tickets.filter((t) => t.status === "Completed").length;
    const totalRegistryValue = sumJobOrderCosts(tickets);
    return { pendingPPO, pendingFinance, inProgress, completed, totalRegistryValue };
  }, [tickets]);

  // Priority Queue: Sort by priorityScore desc
  const filteredAndSortedTickets = useMemo(() => {
    let result = [...tickets];

    // 1. Job Type category filtering
    if (filterType !== "All") {
      result = result.filter((t) => t.jobType === filterType);
    }

    // 2. Workflow stage sub-tab filtering
    if (activeSubTab === "president") {
      // Only funded-track tickets need President endorsement
      result = result.filter((t) => t.ppoApproved && !t.schoolHeadApproved && t.requiresFunds && t.status !== "Completed");
    } else if (activeSubTab === "ppo") {
      result = result.filter((t) => !t.ppoApproved && t.status !== "Completed");
    } else if (activeSubTab === "finance") {
      // Only funded-track tickets need Finance approval
      result = result.filter((t) => t.ppoApproved && t.schoolHeadApproved && !t.financeApproved && t.requiresFunds && t.status !== "Completed");
    }

    return result.sort((a, b) => b.priorityScore - a.priorityScore);
  }, [tickets, filterType, activeSubTab]);

  // Recurring Issues: group unresolved tickets by office + jobType.
  // Any group with 3+ open tickets is flagged as a systemic/recurring problem.
  const recurringIssues = useMemo(() => {
    const groups: Record<string, { office: string; jobType: string; count: number; tickets: JobOrder[] }> = {};
    tickets
      .filter((t) => t.status !== "Completed")
      .forEach((t) => {
        const key = `${t.office}||${t.jobType}`;
        if (!groups[key]) {
          groups[key] = { office: t.office, jobType: t.jobType, count: 0, tickets: [] };
        }
        groups[key].count += 1;
        groups[key].tickets.push(t);
      });
    return Object.values(groups)
      .filter((g) => g.count >= 3)
      .sort((a, b) => b.count - a.count); // worst first
  }, [tickets]);

  const handleOpenOverride = async (ticket: JobOrder) => {
    setOverrideTicket(ticket);
    setSelectedStaff(ticket.assignedStaff);
    setCustomScore(ticket.priorityScore);
    setOverrideRationale("");
    setSelectedOverrideAddStaffId("");

    const initialTeam = ticket.assignedStaffList && ticket.assignedStaffList.length > 0
      ? ticket.assignedStaffList.map((m) => ({ ...m }))
      : [];
    if (initialTeam.length === 0 && ticket.assignedStaff && ticket.assignedStaff !== "Outsource") {
      const found = staffRoster.find((s) => s.name === ticket.assignedStaff);
      if (found && found.id) {
        initialTeam.push({ id: found.id, name: found.name, matchScore: ticket.matchScore || 0, isLead: true });
      }
    }
    setOverrideTeam(initialTeam);

    setIsLoadingOverrideCandidates(true);
    try {
      const token = localStorage.getItem("jors_token");
      const res = authedFetch
        ? await authedFetch(`/api/job-orders/${ticket.id}/staff-candidates`)
        : await fetch(`/api/job-orders/${ticket.id}/staff-candidates`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.candidates)) {
          const seen = new Set<number>();
          const deduped = data.candidates.filter((c: StaffCandidate) => {
            if (!c.id || seen.has(c.id)) return false;
            seen.add(c.id);
            return true;
          });
          setOverrideCandidates(deduped);
        }
      }
    } catch (err) {
      console.error("Failed to load staff candidates", err);
    } finally {
      setIsLoadingOverrideCandidates(false);
    }
  };

  const handleAddStaffToOverrideTeam = () => {
    if (!selectedOverrideAddStaffId) return;
    const staffId = Number(selectedOverrideAddStaffId);
    if (!staffId || overrideTeam.some((m) => m.id === staffId)) return;

    const cand = overrideCandidates.find((c) => c.id === staffId) || staffRoster.find((s) => s.id === staffId);
    if (!cand) return;

    const newMember = {
      id: staffId,
      name: cand.name,
      matchScore: (cand as StaffCandidate).matchScore ?? 0,
      isLead: overrideTeam.length === 0,
    };
    const updatedTeam = [...overrideTeam, newMember];
    setOverrideTeam(updatedTeam);
    setSelectedOverrideAddStaffId("");

    if (selectedStaff === "Outsource" || !selectedStaff) {
      setSelectedStaff(cand.name);
    }
  };

  const handleRemoveStaffFromOverrideTeam = (staffId: number) => {
    const updatedTeam = overrideTeam.filter((m) => m.id !== staffId);
    setOverrideTeam(updatedTeam);
    const removedMember = overrideTeam.find((m) => m.id === staffId);
    if (removedMember && removedMember.name === selectedStaff) {
      if (updatedTeam.length > 0) {
        updatedTeam[0].isLead = true;
        setSelectedStaff(updatedTeam[0].name);
      } else {
        setSelectedStaff("Outsource");
      }
    }
  };

  const handleSetOverrideLead = (staffName: string) => {
    setSelectedStaff(staffName);
    if (staffName === "Outsource") {
      setOverrideTeam([]);
    } else {
      const cand = overrideCandidates.find((c) => c.name === staffName) || staffRoster.find((s) => s.name === staffName);
      if (cand && cand.id) {
        let updatedTeam = overrideTeam.map((m) => ({ ...m, isLead: m.id === cand.id }));
        if (!updatedTeam.some((m) => m.id === cand.id)) {
          updatedTeam = [
            { id: cand.id, name: cand.name, matchScore: (cand as StaffCandidate).matchScore ?? 0, isLead: true },
            ...updatedTeam,
          ];
        }
        setOverrideTeam(updatedTeam);
      }
    }
  };

  const handleApplyOverride = async () => {
    if (!overrideTicket) return;
    const teamIds = selectedStaff === "Outsource" ? [] : overrideTeam.map((m) => m.id);
    await onOverride(overrideTicket.id, selectedStaff, customScore, overrideRationale, teamIds);

    setToastMessage(`Ticket ${overrideTicket.id} successfully overridden and reprioritized.`);
    setTimeout(() => setToastMessage(null), 3500);
    setOverrideTicket(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#F7F4F0] text-[#2B1210]">

      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#2A1518] border border-[#8C2331] text-white px-5 py-3 rounded-lg shadow-xl font-sans text-sm flex items-center gap-3 animate-toast-in">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-accent animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header + New Job Order Request Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h2 className="font-display font-bold text-xl text-[#241012]">Maintenance &amp; Repair Management</h2>
          <p className="text-sm text-slate-600 font-sans mt-0.5">View incoming repair requests, assign workers, and track job progress.</p>
        </div>
        {onSubmitRequest && (
          <NewJobOrderButton
            onSubmitRequest={onSubmitRequest}
            isSubmitting={isSubmitting}
            officeOptions={officeOptions}
            defaultRequestedBy={requestedByDefault}
          />
        )}
      </div>

      {/* Stats Cards Section */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-4">
        {/* Pending PPO Card */}
        <div className="bg-white border border-[#E6DDD3] rounded-lg p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-mono tracking-wider text-slate-700 uppercase font-bold">Needs PPO Review</span>
            <h4 className="text-2xl sm:text-3xl font-mono font-bold text-[#241012] mt-1.5 leading-none">
              {stats.pendingPPO}
            </h4>
            <p className="text-sm text-slate-600 mt-2 font-sans">Waiting for physical plant review</p>
          </div>
          <div className="w-11 h-11 rounded bg-[#6B1420]/10 border border-[#6B1420]/30 flex items-center justify-center text-[#6B1420] text-lg font-mono">
            {stats.pendingPPO}
          </div>
        </div>

        {/* Pending Finance Card */}
        <div className="bg-white border border-[#E6DDD3] rounded-lg p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-mono tracking-wider text-slate-700 uppercase font-bold">Needs Funding</span>
            <h4 className="text-2xl sm:text-3xl font-mono font-bold text-[#241012] mt-1.5 leading-none">
              {stats.pendingFinance}
            </h4>
            <p className="text-sm text-slate-600 mt-2 font-sans">Approved by PPO, waiting for finance</p>
          </div>
          <div className="w-11 h-11 rounded bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 text-lg font-mono">
            {stats.pendingFinance}
          </div>
        </div>

        {/* In Progress Card */}
        <div className="bg-white border border-[#E6DDD3] rounded-lg p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-mono tracking-wider text-slate-700 uppercase font-bold">Work In Progress</span>
            <h4 className="text-2xl sm:text-3xl font-mono font-bold text-[#241012] mt-1.5 leading-none">
              {stats.inProgress}
            </h4>
            <p className="text-sm text-slate-600 mt-2 font-sans">Workers are currently fixing this</p>
          </div>
          <div className="w-11 h-11 rounded bg-cyan-accent/10 border border-cyan-accent/30 flex items-center justify-center text-cyan-accent text-lg font-mono">
            {stats.inProgress}
          </div>
        </div>

        {/* Completed This Month */}
        <div className="bg-white border border-[#E6DDD3] rounded-lg p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-mono tracking-wider text-slate-700 uppercase font-bold">Completed Repairs</span>
            <h4 className="text-2xl sm:text-3xl font-mono font-bold text-[#241012] mt-1.5 leading-none">
              {stats.completed}
            </h4>
            <p className="text-sm text-slate-600 mt-2 font-sans">Finished and verified</p>
          </div>
          <div className="w-11 h-11 rounded bg-soft-green/10 border border-soft-green/30 flex items-center justify-center text-soft-green text-lg font-mono">
            {stats.completed}
          </div>
        </div>
      </section>

      {/* Total Registry Value banner */}
      <section className="mb-8">
        <div className="bg-white border border-[#E6DDD3] rounded-lg p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded bg-[#6B1420]/10 border border-[#6B1420]/30 flex items-center justify-center text-[#6B1420]">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-mono tracking-wider text-slate-700 uppercase font-bold">Total Cost of All Repairs</span>
              <p className="text-sm text-slate-600 font-sans mt-0.5">Sum of estimated and approved costs for all repair requests</p>
            </div>
          </div>
          <h4 className="text-2xl sm:text-3xl font-mono font-bold text-[#6B1420] leading-none shrink-0">
            {formatPeso(stats.totalRegistryValue)}
          </h4>
        </div>
      </section>

      {/* Main Grid: Priority Queue vs. Sidebar Staff/Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">

        {/* Left Column: Priority Queue (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-[#E6DDD3] rounded-lg p-4 sm:p-6 shadow-sm">

            {/* Header / Filter Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E6DDD3] mb-4">
              <div>
                <h3 className="font-display font-semibold text-lg text-[#241012]">Requests Ordered by Urgency</h3>
                <p className="text-sm text-slate-600 font-sans mt-0.5">
                  Requests automatically sorted by safety risk, urgency, and repair impact.
                </p>
              </div>

              {/* Toggles for Job Type Filtering */}
              <div className="flex flex-wrap items-center gap-1.5 bg-[#F0EAE4] p-1 border border-[#E6DDD3] rounded-lg text-xs font-mono">
                {["All", "Electrical", "Plumbing", "HVAC", "Carpentry"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${filterType === type
                      ? "bg-[#8C2331] text-[#1A0E10] font-bold shadow-sm"
                      : "text-slate-600 hover:text-[#241012]"
                      }`}
                  >
                    {type.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Queue Sub-Tabs */}
            <div className="flex border-b border-[#E6DDD3] p-1 gap-1 mb-6 overflow-x-auto whitespace-nowrap scrollbar-none">
              <button
                onClick={() => setActiveSubTab("ppo")}
                className={`px-3 py-1.5 rounded-md font-display font-medium text-xs cursor-pointer transition-all flex items-center gap-1.5 ${activeSubTab === "ppo"
                  ? "bg-[#8C2331]/15 text-[#6B1420] border border-[#8C2331]/20 font-bold"
                  : "text-slate-700 hover:text-[#241012]"
                  }`}
              >
                <Sliders className="w-4 h-4 text-[#6B1420]" />
                <span>Step 1: PPO Review</span>
                <span className="text-xs bg-[#6B1420]/20 text-[#6B1420] px-1.5 py-0.5 rounded font-mono font-bold">
                  {ppoCount}
                </span>
              </button>

              <button
                onClick={() => setActiveSubTab("president")}
                className={`px-3 py-1.5 rounded-md font-display font-medium text-xs cursor-pointer transition-all flex items-center gap-1.5 ${activeSubTab === "president"
                  ? "bg-red-100 text-red-600 border border-red-500/20 font-bold"
                  : "text-slate-700 hover:text-[#241012]"
                  }`}
              >
                <GraduationCap className="w-4 h-4 text-red-500" />
                <span>Step 2: Principal Approval</span>
                <span className="text-xs bg-red-500/20 text-red-600 px-1.5 py-0.5 rounded font-mono font-bold">
                  {presidentCount}
                </span>
              </button>

              <button
                onClick={() => setActiveSubTab("finance")}
                className={`px-3 py-1.5 rounded-md font-display font-medium text-xs cursor-pointer transition-all flex items-center gap-1.5 ${activeSubTab === "finance"
                  ? "bg-[#F5E1E3] text-[#6B1420] border border-[#6B1420]/20 font-bold"
                  : "text-slate-700 hover:text-[#241012]"
                  }`}
              >
                <span className="w-4 h-4 text-[#6B1420] font-semibold">₱</span>
                <span>Step 3: Finance Funding</span>
                <span className="text-xs bg-[#6B1420]/20 text-[#6B1420] px-1.5 py-0.5 rounded font-mono font-bold">
                  {financeCount}
                </span>
              </button>

              <button
                onClick={() => setActiveSubTab("all")}
                className={`px-3 py-1.5 rounded-md font-display font-medium text-xs cursor-pointer transition-all flex items-center gap-1.5 ${activeSubTab === "all"
                  ? "bg-[#F0EAE4] text-[#2B1210] border border-[#DDD2C8] font-bold"
                  : "text-slate-700 hover:text-[#241012]"
                  }`}
              >
                <Inbox className="w-4 h-4 text-slate-700" />
                <span>All Requests</span>
                <span className="text-xs bg-[#E6DDD3] text-[#4A322E] px-1.5 py-0.5 rounded font-mono font-bold">
                  {allCount}
                </span>
              </button>
            </div>

            {/* Subtotal for the currently filtered/sorted queue */}
            {filteredAndSortedTickets.length > 0 && (
              <div className="flex items-center justify-between text-xs font-mono text-slate-700 mb-3 px-1">
                <span>{filteredAndSortedTickets.length} job order{filteredAndSortedTickets.length !== 1 ? "s" : ""} shown</span>
                <span>
                  Subtotal: <span className="font-bold text-[#6B1420]">{formatPeso(sumJobOrderCosts(filteredAndSortedTickets))}</span>
                </span>
              </div>
            )}

            {/* Vertically stacked cards */}
            <div className="space-y-4">
              {filteredAndSortedTickets.length > 0 ? (
                filteredAndSortedTickets.map((ticket) => (
                  <div key={ticket.id} className={`relative group p-2 rounded-xl transition-all ${ticket.isEmergency ? "bg-red-50/90 border-2 border-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.15),0_0_16px_rgba(239,68,68,0.2)]" : "bg-[#F5F1EC]/50 border border-[#F0EAE4]"}`}>
                    <TicketStub
                      ticket={ticket}
                      isAdmin={true}
                      onApprove={(id) => {
                        const est = ppoCosts[id] ? Number(ppoCosts[id]) : undefined;
                        onApprove(id, est, undefined);
                        setToastMessage(`Job Order ${id} verified and approved by Physical Plant.`);
                        setTimeout(() => setToastMessage(null), 3000);
                      }}
                      onOverride={(id) => handleOpenOverride(ticket)}
                      onClick={(ticketId) => {
                        const found = tickets.find(t => t.id === ticketId) || null;
                        setSelectedTicket(found);
                        onTicketClick?.(ticketId);
                      }}
                    />

                    {/* Quick Inline Phase-specific buttons right in the ticket listing */}
                    <div className="mt-2.5 pt-2.5 border-t border-dashed border-[#E6DDD3] flex flex-col gap-2 px-1">
                      {/* Row 1: Timestamp + Emergency badge */}
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                        {ticket.isEmergency && (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-red-500 text-white rounded-full font-mono uppercase tracking-wider">
                            🚨 Emergency
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(ticket.dateSubmitted).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {" · "}
                          {new Date(ticket.dateSubmitted).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </span>
                      </div>

                      {/* Row 2: Action controls */}
                      <div className="flex items-center gap-2">
                        {/* 1. President stage — bypass button for PPO, otherwise read-only indicator */}
                        {activeSubTab === "president" && (
                          <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <span className="px-2.5 h-8 bg-red-50 text-red-600 border border-red-200 text-xs font-mono rounded-lg flex items-center gap-1 select-none">
                              <GraduationCap className="w-3 h-3" />
                              Awaiting President's Endorsement
                            </span>
                            {onPpoBypassPresident && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBypassTicketId(ticket.id);
                                  setBypassReason("");
                                }}
                                className="ml-auto px-3 h-8 bg-amber-500 hover:bg-amber-600 text-white text-xs font-mono font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
                                title="PPO can endorse in place of the President — a written reason is required and fully audited."
                              >
                                ⚡ Bypass President Endorsement
                              </button>
                            )}
                          </div>
                        )}

                        {/* 2. PPO Verify action — includes requires_funds toggle */}
                        {activeSubTab === "ppo" && (
                          <div className="flex flex-wrap items-center gap-2 w-full" onClick={(e) => e.stopPropagation()}>
                            {ticket.isEmergency && (
                              <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 h-8 animate-pulse whitespace-nowrap">
                                🚨 Requires immediate endorsement after approval
                              </span>
                            )}
                            <div className="flex items-center bg-white border border-[#E6DDD3] rounded-lg px-2.5 h-8">
                              <span className="text-xs text-slate-400 font-mono mr-1">₱</span>
                              <input
                                type="number"
                                placeholder="Est. Cost"
                                className="w-20 bg-transparent text-[#2B1210] text-xs font-mono focus:outline-none"
                                value={ppoCosts[ticket.id] || ""}
                                onChange={(e) => setPpoCosts({ ...ppoCosts, [ticket.id]: e.target.value })}
                              />
                            </div>
                            {/* Requires Funds toggle */}
                            <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs font-mono text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2.5 h-8 whitespace-nowrap" title="Check if this request needs budget allocation (President + Finance approval required)">
                              <input
                                type="checkbox"
                                checked={ppoRequiresFunds[ticket.id] ?? Boolean(ticket.requiresFunds)}
                                onChange={(e) => setPpoRequiresFunds({ ...ppoRequiresFunds, [ticket.id]: e.target.checked })}
                                className="w-3.5 h-3.5 accent-blue-600"
                              />
                              Needs Funds?
                            </label>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const estCost = ppoCosts[ticket.id] ? Number(ppoCosts[ticket.id]) : undefined;
                                const rf = ppoRequiresFunds[ticket.id] ?? Boolean(ticket.requiresFunds);
                                onApprove(ticket.id, estCost, ticket.isEmergency, false, rf);
                                setToastMessage(
                                  rf
                                    ? (ticket.isEmergency
                                        ? `🚨 EMERGENCY Job Order ${ticket.id} approved (Funded Track) — School Head & Finance urgently notified.`
                                        : `Job Order ${ticket.id} approved by PPO — forwarded to President for endorsement (Funded Track).`)
                                    : `Job Order ${ticket.id} approved by PPO — dispatched directly (No-Fund Track, no further approvals needed).`
                                );
                                setTimeout(() => setToastMessage(null), 4000);
                              }}
                              className={`ml-auto px-3 h-8 text-white text-xs font-mono font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer whitespace-nowrap ${
                                ticket.isEmergency
                                  ? "bg-red-600 hover:bg-red-700"
                                  : "bg-[#6B1420] hover:bg-[#7D1A28]"
                              }`}
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              {ticket.isEmergency ? "Approve 🚨 Emergency" : "Approve (PPO)"}
                            </button>
                          </div>
                        )}

                        {/* 3. Finance stage — read-only for PPO. The Finance Officer allocates funds in their own portal. */}
                        {activeSubTab === "finance" && (
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-mono rounded flex items-center gap-1 select-none">
                            <span className="font-bold text-sm leading-none">₱</span>
                            Pending Finance Funding Sign-off
                          </span>
                        )}

                        {/* 4. Display current approval stage in the All Registry view */}
                        {activeSubTab === "all" && (
                          <span className="text-xs font-mono font-bold uppercase tracking-wide">
                            {!ticket.ppoApproved ? (
                              <span className="text-[#8C2331]">Awaiting PPO</span>
                            ) : !ticket.requiresFunds ? (
                              <span className="text-cyan-500">✓ No-Fund Track — Dispatched</span>
                            ) : !ticket.schoolHeadApproved ? (
                              <span className="text-red-500">Awaiting President</span>
                            ) : !ticket.financeApproved ? (
                              <span className="text-[#6B1420]">Awaiting Finance</span>
                            ) : ticket.status === "Completed" ? (
                              <span className="text-soft-green font-semibold">Fully Resolved</span>
                            ) : (
                              <span className="text-cyan-accent">In Dispatch</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 border border-dashed border-[#E6DDD3] rounded-lg">
                  <Sliders className="w-8 h-8 text-gray-500 mx-auto stroke-1" />
                  <p className="text-sm text-slate-600 mt-2 font-mono">No requests in this queue stage with matching category.</p>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Right Column: Roster & Logs & Reports (4 cols) */}
        <div className="lg:col-span-4 space-y-6 sm:space-y-8">

          {/* ══ Recurring Problems Alert Panel ══ */}
          {recurringIssues.length > 0 && (
            <div className="bg-white border-2 border-red-300 rounded-lg p-4 sm:p-5 shadow-sm">
              {/* Header */}
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-red-100">
                <div className="w-7 h-7 rounded bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display font-bold text-sm text-red-700">
                    🔁 Recurring Problems Detected
                  </h3>
                  <p className="text-[10px] text-slate-500 font-sans">
                    {recurringIssues.length} issue type{recurringIssues.length !== 1 ? "s" : ""} with 3+ unresolved requests
                  </p>
                </div>
                <span className="text-lg font-mono font-bold text-red-600 bg-red-50 border border-red-200 rounded px-2 py-0.5">
                  {recurringIssues.length}
                </span>
              </div>

              {/* Issue rows */}
              <div className="space-y-2.5">
                {recurringIssues.map((g) => (
                  <div
                    key={`${g.office}||${g.jobType}`}
                    className="flex items-start gap-2.5 p-2.5 bg-red-50/60 border border-red-100 rounded-lg"
                  >
                    {/* Count badge */}
                    <div className="w-8 h-8 rounded bg-red-500 text-white font-mono font-bold text-sm flex items-center justify-center shrink-0">
                      {g.count}x
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#241012] font-sans truncate">{g.office}</p>
                      <p className="text-[11px] text-slate-500 font-mono uppercase">{g.jobType}</p>
                      <p className="text-[10px] text-red-600 font-sans mt-0.5">
                        Oldest open:{" "}
                        {new Date(
                          Math.min(...g.tickets.map((t) => new Date(t.dateSubmitted).getTime()))
                        ).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    {/* Severity pill */}
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap self-center ${
                        g.count >= 5
                          ? "bg-red-600 text-white"
                          : g.count >= 4
                          ? "bg-orange-500 text-white"
                          : "bg-amber-400 text-amber-900"
                      }`}
                    >
                      {g.count >= 5 ? "CRITICAL" : g.count >= 4 ? "HIGH" : "MODERATE"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Footer note */}
              <p className="text-[10px] text-slate-400 font-sans mt-3 pt-2 border-t border-red-100 leading-relaxed">
                ⚠️ Recurring problems may indicate a systemic issue. Consider a permanent repair or escalation.
              </p>
            </div>
          )}

          {/* Staff Roster Panel */}
          <div className="bg-white border border-[#E6DDD3] rounded-lg p-4 sm:p-6 shadow-sm">
            <h3 className="font-display font-semibold text-base text-[#241012] flex items-center gap-2 mb-4 pb-3 border-b border-[#E6DDD3]">
              <Users className="w-4 h-4 text-cyan-accent" /> Staff Workload Roster
            </h3>
            <div className="space-y-4">
              {staffRoster.map((staff) => {
                // Determine workload indicator color
                let barColor = "bg-cyan-accent";
                if (staff.workload > 75) barColor = "bg-soft-red";
                else if (staff.workload > 50) barColor = "bg-safety-amber";

                return (
                  <div key={staff.name} className="flex flex-col text-xs font-sans">
                    <div className="flex justify-between items-center text-[#2B1210] mb-1.5">
                      <div>
                        <span className="font-semibold block text-sm">{staff.name}</span>
                        <span className="text-sm text-slate-700 font-mono tracking-wide uppercase">{staff.specialty}</span>
                      </div>
                      <span className="font-mono text-slate-600 bg-[#F0EAE4] px-1.5 py-0.5 rounded border border-[#E6DDD3]">{staff.workload}% load</span>
                    </div>
                    {/* Workload Progress Bar */}
                    <div className="w-full h-2 rounded bg-[#F0EAE4] overflow-hidden border border-[#E6DDD3]">
                      <div className={`h-full ${barColor} transition-all`} style={{ width: `${staff.workload}%` }} />
                    </div>
                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {staff.tags.map((tag) => (
                        <span key={tag} className="text-xs font-mono bg-[#F0EAE4] text-[#6B1420] border border-[#E6DDD3] px-1.5 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reprioritization Log Panel */}
          <div className="bg-white border border-[#E6DDD3] rounded-lg p-4 sm:p-6 shadow-sm">
            <h3 className="font-display font-semibold text-base text-[#241012] flex items-center gap-2 mb-3 pb-3 border-b border-[#E6DDD3]">
              <Sliders className="w-4 h-4 text-cyan-accent" /> Reprioritization Audit Log
            </h3>
            <div className="space-y-3.5 max-h-56 overflow-y-auto pr-1">
              {logs.map((log, idx) => (
                <div key={idx} className="text-xs flex flex-col gap-1 border-b border-[#F0EAE4] pb-2.5 last:border-b-0">
                  <div className="flex justify-between text-xs font-mono text-slate-600">
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className="text-[#6B1420] font-semibold">{log.ticketId}</span>
                  </div>
                  <p className="text-slate-600 leading-normal font-sans">
                    {log.message}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Override Dialog / Modal */}
      {overrideTicket && (
        <div className="fixed inset-0 bg-[#241012]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#DDD2C8] rounded-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6 text-[#2B1210] text-left shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-lg text-[#241012]">
                  Manual Override: {overrideTicket.id}
                </h3>
                {isLoadingOverrideCandidates && (
                  <span className="text-[11px] font-mono text-slate-500 animate-pulse">
                    Loading matches…
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 font-sans leading-relaxed mt-1">
                Alter the technician dispatch, reconfigure the maintenance team roster, or enforce an administrative priority index override. Overrides are appended to the audit logs.
              </p>
            </div>

            {/* Target Staff Selection */}
            <div>
              <label className="block text-xs font-mono uppercase text-slate-700 mb-1.5 font-bold">
                LEAD TECHNICIAN / REASSIGN STAFF MEMBER
              </label>
              <select
                value={selectedStaff}
                onChange={(e) => handleSetOverrideLead(e.target.value)}
                className="w-full bg-[#F5F1EC] border border-[#E6DDD3] rounded-lg p-2.5 text-xs text-[#2B1210] focus:outline-none focus:border-[#7C1D2D] font-sans"
              >
                <option value="Outsource">Recommend Outsource (Specialized External Service)</option>
                {overrideCandidates.length > 0 ? (
                  overrideCandidates.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name} — {c.specialty} ({c.matchScore}% Match){c.isAtCapacity ? ` ⚠️ At Capacity (${c.activeTaskCount}/${c.limit})` : ` (${c.activeTaskCount}/${c.limit} active)`}
                    </option>
                  ))
                ) : (
                  staffRoster.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name} ({s.specialty})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Team Roster Management */}
            {selectedStaff !== "Outsource" && (
              <div className="space-y-2.5 pt-2 border-t border-[#E6DDD3]">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-mono uppercase text-slate-700 font-bold">
                    Dispatched Team Roster ({overrideTeam.length} Technicians)
                  </label>
                  <span className="text-[11px] font-mono text-slate-500">
                    {overrideTeam.length > 1 ? "Multi-technician team" : "Solo technician"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {overrideTeam.map((member) => (
                    <span
                      key={member.id}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono shadow-xs ${
                        member.isLead
                          ? "bg-[#7C1D2D] text-white font-bold"
                          : "bg-[#FAF7F5] text-[#2B1210] border border-[#DDD2C8]"
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>{member.name}</span>
                      {member.isLead ? (
                        <span className="text-[10px] bg-white/20 px-1 py-0.5 rounded font-normal">Lead</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetOverrideLead(member.name)}
                          className="text-[10px] text-cyan-700 hover:underline font-semibold cursor-pointer"
                        >
                          Set Lead
                        </button>
                      )}
                      {member.matchScore > 0 && (
                        <span className="text-[10px] opacity-80">({member.matchScore}%)</span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveStaffFromOverrideTeam(member.id)}
                        className="ml-1 hover:text-red-600 transition-colors cursor-pointer"
                        title="Remove technician"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                  {overrideTeam.length === 0 && (
                    <span className="text-xs text-slate-500 italic">No team members assigned.</span>
                  )}
                </div>

                {/* Add Matched Maintenance Staff */}
                <div className="bg-[#FAF7F5] border border-[#E6DDD3] rounded-lg p-2.5 space-y-1.5 w-full max-w-full overflow-hidden">
                  <span className="text-[11px] font-mono font-bold uppercase text-slate-700 flex items-center gap-1">
                    <UserPlus className="w-3.5 h-3.5 text-[#7C1D2D]" />
                    Add Matched Maintenance Staff
                  </span>
                  <div className="flex items-center gap-2 w-full">
                    <select
                      value={selectedOverrideAddStaffId}
                      onChange={(e) => setSelectedOverrideAddStaffId(e.target.value)}
                      className="flex-1 min-w-0 w-full bg-white border border-[#DDD2C8] rounded-lg p-2 text-xs text-[#2B1210] focus:outline-none focus:border-[#7C1D2D] font-sans truncate"
                    >
                      <option value="">— Select technician to add —</option>
                      {overrideCandidates
                        .filter((c) => !overrideTeam.some((m) => m.id === c.id))
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.specialty}) — {c.matchScore}% Match {c.isAtCapacity ? `[⚠️ At Capacity: ${c.activeTaskCount}/${c.limit}]` : `[${c.activeTaskCount}/${c.limit}]`}
                          </option>
                        ))}
                      {overrideCandidates.length === 0 && staffRoster
                        .filter((s) => s.id && !overrideTeam.some((m) => m.id === s.id))
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.specialty})
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      disabled={!selectedOverrideAddStaffId}
                      onClick={handleAddStaffToOverrideTeam}
                      className="shrink-0 whitespace-nowrap px-3 py-2 bg-[#7C1D2D] hover:bg-[#7C1D2D]/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-mono font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Set custom priority score */}
            <div className="pt-2 border-t border-[#E6DDD3]">
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-mono uppercase text-slate-700 font-bold">PRIORITY OVERRIDE INDEX</label>
                <span className="font-mono text-[#7C1D2D] font-bold bg-[#7C1D2D]/10 px-2 py-0.5 rounded text-xs">
                  {customScore} / 100
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={customScore}
                onChange={(e) => setCustomScore(Number(e.target.value))}
                className="w-full accent-[#7C1D2D] cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-500 font-mono mt-1">
                <span>10 (MIN)</span>
                <span>50 (NORMAL)</span>
                <span>75 (URGENT)</span>
                <span>100 (CRITICAL)</span>
              </div>
            </div>

            {/* Rationale text area */}
            <div className="pt-2 border-t border-[#E6DDD3]">
              <label className="block text-xs font-mono uppercase text-slate-700 mb-1.5 font-bold">
                OVERRIDE EXPLANATION / RATIONALE (REQUIRED)
              </label>
              <textarea
                value={overrideRationale}
                onChange={(e) => setOverrideRationale(e.target.value)}
                placeholder="e.g. JO-0143 safety concern outweighs earlier submission times..."
                className="w-full h-20 bg-[#F5F1EC] border border-[#E6DDD3] rounded-lg p-2.5 text-xs text-[#2B1210] focus:outline-none focus:border-[#7C1D2D] resize-none placeholder-slate-500 font-sans"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-[#E6DDD3]">
              <button
                type="button"
                onClick={() => setOverrideTicket(null)}
                className="px-4 py-2 bg-transparent text-slate-700 border border-[#DDD2C8] rounded text-xs font-mono font-bold hover:text-[#241012] transition-colors cursor-pointer"
              >
                CANCEL
              </button>

              <button
                type="button"
                onClick={handleApplyOverride}
                disabled={!overrideRationale.trim()}
                className="px-4 py-2 bg-[#7C1D2D] text-white font-mono font-bold rounded text-xs hover:bg-[#7C1D2D]/80 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                APPLY OVERRIDE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Details Modal */}
      <TicketDetailsModal
        isOpen={!!selectedTicket}
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        isAdmin={true}
        staffRoster={staffRoster}
        authedFetch={authedFetch}
        onStaffOverride={async (id, assignedStaff, priorityScore, rationale, teamStaffIds) => {
          const res = await onOverride(id, assignedStaff, priorityScore, rationale, teamStaffIds);
          setToastMessage(`Job Order ${id} staff dispatch successfully updated.`);
          setTimeout(() => setToastMessage(null), 3500);
          return res;
        }}
        onApprove={(id, estimatedCost, emergencyOverride) => {
          onApprove(id, estimatedCost, emergencyOverride);
        }}
        onSchoolHeadApprove={(id) => {
          onSchoolHeadApprove(id);
          setToastMessage(`Job Order ${id} successfully endorsed on behalf of the President.`);
          setTimeout(() => setToastMessage(null), 3000);
        }}
        onFinanceApprove={(id, approvedAmount, estimatedCost, financeNotes) => {
          onFinanceApprove(id, approvedAmount, estimatedCost, financeNotes);
          setToastMessage(`Funding released and dispatch initiated for Job Order ${id}.`);
          setTimeout(() => setToastMessage(null), 3000);
        }}
        onSaveBudgetItems={onSaveBudgetItems}
        onExtendDeadline={onExtendDeadline}
        onOverride={(id) => {
          if (selectedTicket) {
            handleOpenOverride(selectedTicket);
          }
        }}
        onDelete={onDeleteJobOrder ? async (id) => {
          const result = await onDeleteJobOrder(id);
          if (result.ok) {
            setSelectedTicket(null);
            setToastMessage(`Job Order ${id} deleted successfully.`);
            setTimeout(() => setToastMessage(null), 3000);
          } else {
            setToastMessage(`Error: ${result.error}`);
            setTimeout(() => setToastMessage(null), 4000);
          }
        } : undefined}
      />

      {/* User Account Management Modal */}
      {onCreateUser && onDeleteUser && (
        <AccountManagementModal
          isOpen={isAccountModalOpen}
          onClose={() => setIsAccountModalOpen(false)}
          users={userAccounts}
          onCreateUser={onCreateUser}
          onDeleteUser={onDeleteUser}
        />
      )}

      {/* PPO Bypass President Endorsement Modal */}
      {bypassTicketId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-amber-200">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <span className="text-xl">⚡</span>
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-[#241012]">Bypass President Endorsement</h3>
                <p className="text-xs text-slate-500 font-sans mt-0.5">Job Order <strong>{bypassTicketId}</strong></p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-800 font-sans leading-relaxed">
              <strong className="block mb-1">⚠️ This action is fully audited.</strong>
              Your name, timestamp, and reason will be permanently recorded in the approval log and visible to all admin roles.
              Finance approval is still required — only President endorsement is being bypassed.
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-xs text-red-700 font-sans leading-relaxed">
              🔒 <strong>Finance approval cannot be bypassed</strong> — only the Finance Department Head can release funds.
            </div>

            <div className="mb-4">
              <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1.5">
                Reason for Bypassing <span className="text-red-500">*</span>
              </label>
              <textarea
                value={bypassReason}
                onChange={(e) => setBypassReason(e.target.value)}
                rows={4}
                placeholder="e.g. President is unavailable due to official travel. Urgent repair needed to restore classroom power before Monday classes. Approval obtained verbally."
                className="w-full bg-[#F5F1EC] border border-[#E6DDD3] rounded-lg p-3 text-sm text-[#2B1210] focus:outline-none focus:border-amber-400 resize-none placeholder-slate-400 font-sans leading-relaxed"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1 font-sans">
                <span>{bypassReason.trim().length < 10 ? `${10 - bypassReason.trim().length} more characters needed` : "✓ Reason is sufficient"}</span>
                <span>{bypassReason.length} chars</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setBypassTicketId(null); setBypassReason(""); }}
                className="flex-1 px-4 py-2.5 border border-[#E6DDD3] rounded-lg text-sm font-mono text-slate-700 hover:bg-[#F0EAE4] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={bypassReason.trim().length < 10 || bypassSubmitting}
                onClick={async () => {
                  if (!onPpoBypassPresident || bypassReason.trim().length < 10) return;
                  setBypassSubmitting(true);
                  try {
                    await onPpoBypassPresident(bypassTicketId, bypassReason.trim());
                    setToastMessage(`⚡ President endorsement bypassed for ${bypassTicketId}. Forwarded to Finance.`);
                    setTimeout(() => setToastMessage(null), 4000);
                    setBypassTicketId(null);
                    setBypassReason("");
                  } finally {
                    setBypassSubmitting(false);
                  }
                }}
                className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-mono font-bold transition-colors cursor-pointer"
              >
                {bypassSubmitting ? "Processing…" : "⚡ Confirm Bypass"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};