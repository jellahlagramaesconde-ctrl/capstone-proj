import React, { useState, useMemo } from "react";
import { JobOrder, Staff, LogEntry, Notification } from "../types";
import { TicketStub } from "./TicketStub";
import { TicketDetailsModal } from "./TicketDetailsModal";
import { NewJobOrderButton } from "./NewJobOrderButton";
import { AccountManagementModal, UserAccount } from "./AccountManagementModal";
import { formatPeso, sumJobOrderCosts } from "../priceUtils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { RefreshCw, Download, Sliders, Users, FileText, CheckCircle, ChevronDown, Check, GraduationCap, Inbox, Clock, Wallet, UserCheck } from "lucide-react";

interface AdminDashboardProps {
  tickets: JobOrder[];
  staffRoster: Staff[];
  logs: LogEntry[];
  userAccounts?: UserAccount[];
  onCreateUser?: (userData: { username: string; password: string; role: string; fullName: string; email?: string }) => Promise<{ ok: boolean; error?: string }>;
  onDeleteUser?: (id: number) => Promise<{ ok: boolean; error?: string }>;
  onDeleteJobOrder?: (ticketId: string) => Promise<{ ok: boolean; error?: string }>;
  onOverride: (id: string, assignedStaff: string, priorityScore: number, rationale: string) => void;
  onApprove: (id: string, estimatedCost?: number, emergencyOverride?: boolean) => void;
  onUpdateStatus: (id: string, status: "Pending" | "In Progress" | "Completed") => void;
  onTicketClick?: (ticketId: string) => void;
  onSchoolHeadApprove: (id: string) => void;
  onFinanceApprove: (id: string, approvedAmount?: number, estimatedCost?: number, financeNotes?: string) => void;
  onSubmitRequest?: (office: string, description: string, requestedByName: string, isEmergency: boolean) => Promise<void>;
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
  onSubmitRequest,
  isSubmitting = false,
  officeOptions,
  requestedByDefault,
  notifications = [],
  readNotificationIds = new Set(),
  onMarkNotificationsRead = () => { },
  maxWorkerTaskLimit,
}) => {
  // Account Management Modal state
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  // Sorting & Filtering State
  const [filterType, setFilterType] = useState<string>("All");
  const [activeSubTab, setActiveSubTab] = useState<"president" | "ppo" | "finance" | "all">("ppo");
  const [selectedTicket, setSelectedTicket] = useState<JobOrder | null>(null);

  // Local PPO Cost Input State
  const [ppoCosts, setPpoCosts] = useState<Record<string, string>>({});

  // Local PPO "treat as emergency" override checkbox state (for requests Dept
  // didn't flag but the PPO judges urgent on review)
  const [ppoEmergencyOverride, setPpoEmergencyOverride] = useState<Record<string, boolean>>({});

  // (Finance cost inputs removed — Finance approves via their own portal, not here)

  // Dialog State for Override Modals
  const [overrideTicket, setOverrideTicket] = useState<JobOrder | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [customScore, setCustomScore] = useState<number>(50);
  const [overrideRationale, setOverrideRationale] = useState<string>("");

  // Export Loading States
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Workflow queue counts
  const { presidentCount, ppoCount, financeCount, allCount } = useMemo(() => {
    return {
      presidentCount: tickets.filter((t) => t.ppoApproved && !t.schoolHeadApproved && t.status !== "Completed").length,
      ppoCount: tickets.filter((t) => !t.ppoApproved && t.status !== "Completed").length,
      financeCount: tickets.filter((t) => t.ppoApproved && t.schoolHeadApproved && !t.financeApproved && t.status !== "Completed").length,
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
      result = result.filter((t) => t.ppoApproved && !t.schoolHeadApproved && t.status !== "Completed");
    } else if (activeSubTab === "ppo") {
      result = result.filter((t) => !t.ppoApproved && t.status !== "Completed");
    } else if (activeSubTab === "finance") {
      result = result.filter((t) => t.ppoApproved && t.schoolHeadApproved && !t.financeApproved && t.status !== "Completed");
    }

    return result.sort((a, b) => b.priorityScore - a.priorityScore);
  }, [tickets, filterType, activeSubTab]);

  // Aggregate data for "Requests by Department" Recharts horizontal bar chart
  const departmentChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    tickets.forEach((t) => {
      counts[t.office] = (counts[t.office] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({
      name: name.replace("Office", "Off.").replace("Laboratory", "Lab"),
      count,
    }));
  }, [tickets]);

  const handleOpenOverride = (ticket: JobOrder) => {
    setOverrideTicket(ticket);
    setSelectedStaff(ticket.assignedStaff);
    setCustomScore(ticket.priorityScore);
    setOverrideRationale("");
  };

  const handleApplyOverride = () => {
    if (!overrideTicket) return;
    onOverride(overrideTicket.id, selectedStaff, customScore, overrideRationale);

    setToastMessage(`Ticket ${overrideTicket.id} successfully overridden and reprioritized.`);
    setTimeout(() => setToastMessage(null), 3500);
    setOverrideTicket(null);
  };

  const triggerExport = (type: "PDF" | "Excel") => {
    if (type === "PDF") {
      setIsExportingPDF(true);
      setTimeout(() => {
        setIsExportingPDF(false);
        setToastMessage("PDF Report successfully generated and downloaded to device!");
        setTimeout(() => setToastMessage(null), 3000);
      }, 1500);
    } else {
      setIsExportingExcel(true);
      setTimeout(() => {
        setIsExportingExcel(false);
        setToastMessage("Excel Worksheet successfully exported and saved!");
        setTimeout(() => setToastMessage(null), 3000);
      }, 1500);
    }
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
            <h4 className="text-3xl font-mono font-bold text-[#241012] mt-1.5 leading-none">
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
            <h4 className="text-3xl font-mono font-bold text-[#241012] mt-1.5 leading-none">
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
            <h4 className="text-3xl font-mono font-bold text-[#241012] mt-1.5 leading-none">
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
            <h4 className="text-3xl font-mono font-bold text-[#241012] mt-1.5 leading-none">
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
                  <div key={ticket.id} className={`relative group p-2 rounded-xl transition-all ${ticket.isEmergency ? "bg-red-50/60 border-2 border-red-400/50" : "bg-[#F5F1EC]/50 border border-[#F0EAE4]"}`}>
                    <TicketStub
                      ticket={ticket}
                      isAdmin={true}
                      onApprove={(id) => {
                        const est = ppoCosts[id] ? Number(ppoCosts[id]) : undefined;
                        onApprove(id, est, ppoEmergencyOverride[id]);
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
                        {/* 1. President stage — read-only for PPO */}
                        {activeSubTab === "president" && (
                          <span className="px-2.5 h-8 bg-red-50 text-red-600 border border-red-200 text-xs font-mono rounded-lg flex items-center gap-1 select-none">
                            <GraduationCap className="w-3 h-3" />
                            Pending President's Endorsement
                          </span>
                        )}

                        {/* 2. PPO Verify action */}
                        {activeSubTab === "ppo" && (
                          <div className="flex flex-wrap items-center gap-2 w-full" onClick={(e) => e.stopPropagation()}>
                            {!ticket.isEmergency && (
                              <label className="flex items-center gap-1.5 text-[11px] font-sans text-safety-amber bg-safety-amber/8 border border-safety-amber/15 rounded-lg px-2.5 h-8 cursor-pointer select-none font-medium whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={!!ppoEmergencyOverride[ticket.id]}
                                  onChange={(e) => setPpoEmergencyOverride({ ...ppoEmergencyOverride, [ticket.id]: e.target.checked })}
                                  className="accent-safety-amber cursor-pointer"
                                />
                                Emergency
                              </label>
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
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const estCost = ppoCosts[ticket.id] ? Number(ppoCosts[ticket.id]) : undefined;
                                const emergency = ticket.isEmergency || ppoEmergencyOverride[ticket.id];
                                onApprove(ticket.id, estCost, emergency);
                                setToastMessage(
                                  emergency
                                    ? `Job Order ${ticket.id} approved as EMERGENCY — dispatched directly to staff.`
                                    : `Job Order ${ticket.id} approved by PPO.`
                                );
                                setTimeout(() => setToastMessage(null), 3000);
                              }}
                              className="ml-auto px-3 h-8 bg-[#6B1420] hover:bg-[#7D1A28] text-white text-xs font-mono font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Approve (PPO)
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

          {/* Reports Panel with Recharts BarChart */}
          <div className="bg-white border border-[#E6DDD3] rounded-lg p-4 sm:p-6 shadow-sm">
            <h3 className="font-display font-semibold text-base text-[#241012] flex items-center gap-2 mb-4 pb-3 border-b border-[#E6DDD3]">
              <FileText className="w-4 h-4 text-cyan-accent" /> Requests by Department
            </h3>

            {/* Horizontal Bar Chart */}
            <div className="w-full h-44 mb-4 select-none">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentChartData} layout="vertical" margin={{ left: -15, right: 10, top: 0, bottom: 0 }}>
                  <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 10, fontFamily: 'monospace' }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" stroke="#6b7280" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: document.documentElement.classList.contains("dark") ? "#2A1518" : "#fff",
                      borderColor: document.documentElement.classList.contains("dark") ? "#3A1F22" : "#cbd5e1",
                      borderRadius: 8
                    }}
                    itemStyle={{ color: "#8C2331", fontStyle: "monospace" }}
                  />
                  <Bar dataKey="count" fill="#8C2331" radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Export buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => triggerExport("PDF")}
                disabled={isExportingPDF}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3.5 bg-[#8C2331]/15 hover:bg-[#8C2331]/30 border border-[#8C2331]/30 text-[#8C2331] text-xs font-mono font-bold rounded transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                {isExportingPDF ? "PDF EXPORT..." : "EXPORT PDF"}
              </button>

              <button
                onClick={() => triggerExport("Excel")}
                disabled={isExportingExcel}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3.5 bg-[#F0EAE4] hover:bg-[#E6DDD3] border border-[#DDD2C8] text-[#2B1210] text-xs font-mono font-bold rounded transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                {isExportingExcel ? "EXCEL EXP..." : "EXPORT EXCEL"}
              </button>
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
          <div className="bg-white border border-[#DDD2C8] rounded-lg max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6 text-[#2B1210] text-left shadow-2xl">
            <h3 className="font-display font-semibold text-lg text-[#241012] mb-2">
              Manual Override: {overrideTicket.id}
            </h3>
            <p className="text-sm text-slate-700 mb-4 font-sans leading-relaxed">
              Alter the technician dispatch or enforce an administrative priority index override. Overrides are appended to the audit logs.
            </p>

            {/* Target Staff Selection */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-700 mb-1.5 font-bold">REASSIGN STAFF MEMBER</label>
                <select
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  className="w-full bg-[#F5F1EC] border border-[#E6DDD3] rounded-lg p-2.5 text-sm text-[#2B1210] focus:outline-none focus:border-cyan-accent font-sans"
                >
                  <option value="Outsource">Recommend Outsource (Specialized External Service)</option>
                  {staffRoster.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name} ({s.specialty})
                    </option>
                  ))}
                </select>
              </div>

              {/* Set custom priority score */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-mono uppercase text-slate-700 font-bold">PRIORITY OVERRIDE INDEX</label>
                  <span className="font-mono text-[#6B1420] font-semibold bg-cyan-accent/10 px-2 py-0.5 rounded text-sm">
                    {customScore} / 100
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={customScore}
                  onChange={(e) => setCustomScore(Number(e.target.value))}
                  className="w-full accent-cyan-accent cursor-pointer"
                />
                <div className="flex justify-between text-sm text-slate-600 font-mono mt-1">
                  <span>10 (MIN)</span>
                  <span>50 (NORMAL)</span>
                  <span>75 (URGENT)</span>
                  <span>100 (CRITICAL)</span>
                </div>
              </div>

              {/* Rationale text area */}
              <div>
                <label className="block text-xs font-mono uppercase text-slate-700 mb-1.5 font-bold">OVERRIDE EXPLANATION / RATIONALE (REQUIRED)</label>
                <textarea
                  value={overrideRationale}
                  onChange={(e) => setOverrideRationale(e.target.value)}
                  placeholder="e.g. JO-0143 safety concern outweighs earlier submission times..."
                  className="w-full h-20 bg-[#F5F1EC] border border-[#E6DDD3] rounded-lg p-2.5 text-xs text-[#2B1210] focus:outline-none focus:border-cyan-accent resize-none placeholder-slate-500 font-sans"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#E6DDD3]">
              <button
                onClick={() => setOverrideTicket(null)}
                className="px-4 py-2 bg-transparent text-slate-700 border border-[#DDD2C8] rounded text-xs font-mono font-bold hover:text-[#241012] transition-colors cursor-pointer"
              >
                CANCEL
              </button>

              <button
                onClick={handleApplyOverride}
                disabled={!overrideRationale.trim()}
                className="px-4 py-2 bg-[#8C2331] text-[#1A0E10] font-mono font-bold rounded text-xs hover:bg-[#8C2331]/80 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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

    </div>
  );
};