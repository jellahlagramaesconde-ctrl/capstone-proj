import React, { useMemo, useState } from "react";
import { JobOrder, Notification } from "../types";
import { TicketStub } from "./TicketStub";
import { TicketDetailsModal } from "./TicketDetailsModal";
import { Wrench, Calendar, AlertTriangle, CheckCircle, ShieldAlert, Sparkles, History, ChevronRight, FileText } from "lucide-react";
import { getJobOrderCostDisplay, formatPeso, sumJobOrderCosts } from "../priceUtils";

interface StaffDashboardProps {
  tickets: JobOrder[];
  onUpdateStatus: (id: string, status: "Pending" | "In Progress" | "Completed") => void;
  onTicketClick?: (ticketId: string) => void;
  activeStaffName?: string;
  notifications?: Notification[];
  readNotificationIds?: Set<string>;
  onMarkNotificationsRead?: (ids: string[]) => void;
}

const JOB_TYPE_FILTERS = ["All", "Electrical", "Plumbing", "HVAC", "Carpentry"];

// Priority tier — same red/orange/etc. dot convention used by the
// President/School Head "Endorsement History" log this list mirrors.
const getPriorityTier = (score: number) => {
  if (score >= 80) return { label: "CRITICAL", dot: "bg-red-500" };
  if (score >= 60) return { label: "HIGH", dot: "bg-orange-400" };
  if (score >= 35) return { label: "MODERATE", dot: "bg-amber-400" };
  return { label: "LOW", dot: "bg-slate-300" };
};


export const StaffDashboard: React.FC<StaffDashboardProps> = ({
  tickets,
  onUpdateStatus,
  onTicketClick,
  activeStaffName,
  notifications = [],
  readNotificationIds = new Set(),
  onMarkNotificationsRead = () => { },
}) => {
  const [activeTab, setActiveTab] = useState<"tasks" | "history">("tasks");
  const [selectedTicket, setSelectedTicket] = useState<JobOrder | null>(null);

  // Category filters — same "ALL / ELECTRICAL / PLUMBING / HVAC / CARPENTRY"
  // pattern as the PPO/Admin queue, applied separately to Assigned Tasks
  // and Completed History so a technician can narrow either list down.
  const [assignedFilterType, setAssignedFilterType] = useState<string>("All");
  const [historyFilterType, setHistoryFilterType] = useState<string>("All");

  // Active maintenance technician context — comes from the authenticated
  // account (App.tsx always passes it). Empty string if somehow missing,
  // so it simply matches no tickets rather than silently showing someone
  // else's queue.
  const activeTechnician = activeStaffName || "";

  // Filter tickets assigned specifically to Delfin Ramirez that are approved by PPO and Finance
  const assignedTickets = useMemo(() => {
    return tickets.filter((t) => t.assignedStaff === activeTechnician && t.ppoApproved && t.financeApproved);
  }, [tickets, activeTechnician]);

  // Compute stat metrics
  const stats = useMemo(() => {
    const assignedToday = assignedTickets.filter((t) => t.status === "Pending").length;
    const inProgress = assignedTickets.filter((t) => t.status === "In Progress").length;
    const completed = assignedTickets.filter((t) => t.status === "Completed").length;
    return { assignedToday, inProgress, completed };
  }, [assignedTickets]);

  // Real "upcoming work" queue for this technician: their own open tickets
  // (not yet Completed), most urgent/oldest first. Replaces the old static
  // Mon/Tue/Wed cards, which were hardcoded JSX unrelated to any account.
  const upcomingWork = useMemo(() => {
    return assignedTickets
      .filter((t) => t.status !== "Completed")
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "In Progress" ? -1 : 1;
        return (b.priorityScore ?? 0) - (a.priorityScore ?? 0);
      });
  }, [assignedTickets]);

  // "My Assigned Tasks" now shows only what's still active — completed
  // work has its own History section below, instead of piling up
  // indefinitely in this list with just a "Done!" label.
  const activeTasks = useMemo(() => {
    const base = assignedTickets.filter((t) => t.status !== "Completed");
    if (assignedFilterType === "All") return base;
    return base.filter((t) => t.jobType === assignedFilterType);
  }, [assignedTickets, assignedFilterType]);

  // Completed job orders, most recently finished first, so this
  // technician can look back at what they've already resolved.
  const completedHistory = useMemo(() => {
    const base = assignedTickets
      .filter((t) => t.status === "Completed")
      .sort((a, b) => {
        const aTime = a.dateCompleted ? new Date(a.dateCompleted).getTime() : 0;
        const bTime = b.dateCompleted ? new Date(b.dateCompleted).getTime() : 0;
        return bTime - aTime;
      });
    if (historyFilterType === "All") return base;
    return base.filter((t) => t.jobType === historyFilterType);
  }, [assignedTickets, historyFilterType]);


  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#F7F4F0] text-[#2B1210]">

      {/* 3 Stats Metrics Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8">
        {/* Assigned Today Card */}
        <div className="bg-white border border-[#E6DDD3] rounded-lg p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-mono tracking-wider text-slate-700 uppercase">ASSIGNED & PENDING</span>
            <h4 className="text-3xl font-mono font-bold text-[#241012] mt-1.5 leading-none">
              {stats.assignedToday}
            </h4>
            <p className="text-sm text-slate-600 mt-2 font-sans">Awaiting dispatch launch</p>
          </div>
          <div className="w-11 h-11 rounded bg-safety-amber/10 border border-safety-amber/30 flex items-center justify-center text-safety-amber text-lg font-mono">
            {stats.assignedToday}
          </div>
        </div>

        {/* In Progress Card */}
        <div className="bg-white border border-[#E6DDD3] rounded-lg p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-mono tracking-wider text-slate-700 uppercase">ACTIVE IN-PROGRESS</span>
            <h4 className="text-3xl font-mono font-bold text-[#241012] mt-1.5 leading-none">
              {stats.inProgress}
            </h4>
            <p className="text-sm text-slate-600 mt-2 font-sans">Currently working on issues</p>
          </div>
          <div className="w-11 h-11 rounded bg-cyan-accent/10 border border-cyan-accent/30 flex items-center justify-center text-cyan-accent text-lg font-mono">
            {stats.inProgress}
          </div>
        </div>

        {/* Completed This Week */}
        <div className="bg-white border border-[#E6DDD3] rounded-lg p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-mono tracking-wider text-slate-700 uppercase">RESOLVED THIS WEEK</span>
            <h4 className="text-3xl font-mono font-bold text-[#241012] mt-1.5 leading-none">
              {stats.completed}
            </h4>
            <p className="text-sm text-slate-600 mt-2 font-sans">Sign-offs fully recorded</p>
          </div>
          <div className="w-11 h-11 rounded bg-soft-green/10 border border-soft-green/30 flex items-center justify-center text-soft-green text-lg font-mono">
            {stats.completed}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          TAB NAVIGATION — same pattern as the Approval Desk's
          "Pending Endorsement" / "My Endorsed Log" toggle.
      ══════════════════════════════════════════ */}
      <div className="flex items-center gap-1 bg-white border border-[#E6DDD3] rounded-xl p-1 mb-6 w-fit shadow-sm">
        {[
          {
            key: "tasks",
            icon: <Wrench className="w-4 h-4" />,
            label: "My Assigned Tasks",
            shortLabel: "Tasks",
            count: activeTasks.length,
          },
          {
            key: "history",
            icon: <History className="w-4 h-4" />,
            label: "Completed History",
            shortLabel: "History",
            count: completedHistory.length,
          },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as "tasks" | "history")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-display font-semibold text-sm transition-all cursor-pointer ${activeTab === tab.key
              ? "bg-[#6B1420] text-white shadow-sm"
              : "text-slate-700 hover:text-[#241012] hover:bg-[#F5F1EC]"
              }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.shortLabel}</span>
            <span
              className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.key
                ? "bg-white/20 text-white"
                : "bg-[#F0EAE4] text-[#6B1420]"
                }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════
          TAB: MY ASSIGNED TASKS
      ══════════════════════════════════════════ */}
      {activeTab === "tasks" && (
        <div className="bg-white border border-[#E6DDD3] rounded-lg p-4 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E6DDD3]">
            <span className="flex items-center gap-2 font-display font-semibold text-base text-[#241012]">
              <Wrench className="w-5 h-5 text-cyan-accent" /> My Assigned Tasks ({activeTasks.length})
            </span>
            <span className="text-xs font-mono text-[#8C2331] bg-[#8C2331]/10 px-2 py-0.5 rounded font-bold shrink-0">
              TECHNICIAN FILE
            </span>
          </div>

          {/* Category filter pills — ALL / ELECTRICAL / PLUMBING / HVAC / CARPENTRY */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[#F0EAE4] p-1 border border-[#E6DDD3] rounded-lg text-xs font-mono mt-4">
            {JOB_TYPE_FILTERS.map((type) => (
              <button
                key={type}
                onClick={() => setAssignedFilterType(type)}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${assignedFilterType === type
                  ? "bg-[#8C2331] text-white font-bold shadow-sm"
                  : "text-slate-600 hover:text-[#241012]"
                  }`}
              >
                {type.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Subtotal row for the currently filtered list */}
          {activeTasks.length > 0 && (
            <div className="flex items-center justify-between text-xs font-mono text-slate-700 mt-3 px-1">
              <span>{activeTasks.length} job order{activeTasks.length !== 1 ? "s" : ""} shown</span>
              <span>
                Subtotal: <span className="font-bold text-[#6B1420]">{formatPeso(sumJobOrderCosts(activeTasks))}</span>
              </span>
            </div>
          )}

          <div className="space-y-4 mt-4">
            {activeTasks.length > 0 ? (
              activeTasks.map((ticket) => (
                <div key={ticket.id} className="relative">
                  <TicketStub
                    ticket={ticket}
                    isAdmin={false}
                    onUpdateStatus={onUpdateStatus}
                    onClick={(ticketId) => {
                      const found = tickets.find(t => t.id === ticketId) || null;
                      setSelectedTicket(found);
                      onTicketClick?.(ticketId);
                    }}
                  />
                </div>
              ))
            ) : (
              <div className="text-center py-16 border border-dashed border-[#E6DDD3] rounded-lg">
                <CheckCircle className="w-10 h-10 text-soft-green mx-auto stroke-1" />
                <p className="text-sm text-slate-600 mt-2 font-mono">
                  {assignedFilterType === "All"
                    ? "All assigned duties completed! Standby for dispatch."
                    : "No assigned tasks match this category."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB: COMPLETED HISTORY — styled as a permanent log, matching
          the "Endorsement History" table pattern from the Approval Desk:
          header bar with running total, divide-y rows with a priority
          dot, ID + status badges, office/description, and cost + date
          on the right.
      ══════════════════════════════════════════ */}
      {activeTab === "history" && (
        <div className="bg-white border border-[#E6DDD3] rounded-lg shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 sm:p-6 pb-0">
            <h3 className="font-display font-semibold text-base text-[#241012] pb-3 border-b border-[#E6DDD3] flex items-center gap-2">
              <History className="w-5 h-5 text-cyan-accent" /> Completed History ({completedHistory.length})
            </h3>

            {/* Category filter pills — ALL / ELECTRICAL / PLUMBING / HVAC / CARPENTRY */}
            <div className="flex flex-wrap items-center gap-1.5 bg-[#F0EAE4] p-1 border border-[#E6DDD3] rounded-lg text-xs font-mono mt-4">
              {JOB_TYPE_FILTERS.map((type) => (
                <button
                  key={type}
                  onClick={() => setHistoryFilterType(type)}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${historyFilterType === type
                    ? "bg-[#8C2331] text-white font-bold shadow-sm"
                    : "text-slate-600 hover:text-[#241012]"
                    }`}
                >
                  {type.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {completedHistory.length > 0 ? (
            <>
              {/* Log header bar with running total */}
              <div className="px-4 sm:px-6 py-3 mt-4 border-y border-[#F0EAE4] flex items-center justify-between bg-[#FDFCFB]">
                <p className="text-xs font-mono text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#6B1420]" />
                  {completedHistory.length} job order{completedHistory.length !== 1 ? "s" : ""} logged
                </p>
                <p className="text-xs font-mono text-slate-700">
                  Total:{" "}
                  <span className="text-[#6B1420] font-bold">
                    {formatPeso(sumJobOrderCosts(completedHistory))}
                  </span>
                </p>
              </div>

              {/* Rows */}
              <div className="divide-y divide-[#F5F1EC]">
                {completedHistory.map((t) => {
                  const tier = getPriorityTier(t.priorityScore ?? 0);
                  const costDisplay = getJobOrderCostDisplay(t);
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        setSelectedTicket(t);
                        onTicketClick?.(t.id);
                      }}
                      className="flex items-center gap-4 px-4 sm:px-6 py-4 hover:bg-[#F7F4F0] cursor-pointer transition-colors group"
                    >
                      {/* Priority dot */}
                      <div
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${tier.dot}`}
                        title={tier.label}
                      />

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="font-mono text-xs font-bold text-[#241012]">
                            {t.id}
                          </span>
                          {t.isEmergency && (
                            <span className="text-[11px] font-mono font-bold px-1.5 py-px bg-red-100 text-red-600 rounded-full">
                              EMERGENCY
                            </span>
                          )}
                          <span className="text-[11px] font-mono text-slate-600 bg-[#F0EAE4] px-1.5 py-px rounded">
                            {t.jobType}
                          </span>
                        </div>
                        <p className="font-sans font-semibold text-sm text-[#2B1210] truncate">
                          {t.office}
                        </p>
                        <p className="text-xs text-slate-600 truncate font-sans">
                          {t.description}
                        </p>
                      </div>

                      {/* Cost + date */}
                      <div className="text-right shrink-0 hidden sm:block">
                        <p className={`font-mono font-bold text-sm ${costDisplay.status === "final" ? "text-emerald-700" : "text-slate-500 italic text-xs"}`}>
                          {costDisplay.text}
                        </p>
                        <p className="text-[11px] font-mono text-slate-500 mt-1">
                          {t.dateCompleted
                            ? new Date(t.dateCompleted).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                            : "Date unavailable"}
                        </p>
                      </div>

                      <ChevronRight className="w-4 h-4 text-[#DDD2C8] group-hover:text-[#6B1420] transition-colors shrink-0" />
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-12 mx-4 sm:mx-6 mt-4 mb-4 sm:mb-6 border border-dashed border-[#E6DDD3] rounded-lg">
              <History className="w-8 h-8 text-slate-400 mx-auto stroke-1" />
              <p className="text-sm text-slate-600 mt-2 font-mono">
                {historyFilterType === "All"
                  ? "No completed jobs yet — finished work will show up here."
                  : "No completed jobs match this category."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Upcoming Work — full width, below the tabbed section */}
      <div className="mt-6 lg:mt-8 bg-white border border-[#E6DDD3] rounded-lg p-4 sm:p-6 shadow-sm">
        <h3 className="font-display font-semibold text-base text-[#241012] pb-3 border-b border-[#E6DDD3] flex items-center gap-2">
          <Calendar className="w-5 h-5 text-cyan-accent" /> Upcoming Work ({upcomingWork.length})
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {upcomingWork.length > 0 ? (
            upcomingWork.map((t) => {
              const isUrgent = t.priorityScore >= 75;
              return (
                <div
                  key={t.id}
                  className={`bg-[#F5F1EC] border rounded-lg p-4 shadow-sm ${isUrgent ? "border-safety-amber/20" : "border-[#E6DDD3]"
                    }`}
                >
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${t.status === "In Progress"
                        ? "text-cyan-accent bg-cyan-accent/10"
                        : "text-slate-700 bg-[#E6DDD3]"
                        }`}
                    >
                      {t.status === "In Progress" ? "IN PROGRESS" : "PENDING"}
                    </span>
                    <span className="text-sm text-slate-600 font-mono">{t.id}</span>
                  </div>
                  <h4 className="font-display font-semibold text-sm text-[#241012] mt-2">
                    {t.jobType} — {t.office}
                  </h4>
                  <p className="text-sm text-slate-600 mt-1 leading-normal font-sans line-clamp-2">
                    {t.description}
                  </p>
                  {t.isEmergency && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-safety-amber font-mono font-semibold bg-safety-amber/5 p-1 px-2 rounded">
                      <AlertTriangle className="w-3.5 h-3.5" /> Emergency / Safety Fix
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="sm:col-span-2 lg:col-span-3 text-center py-12 border border-dashed border-[#E6DDD3] rounded-lg">
              <Calendar className="w-8 h-8 text-slate-400 mx-auto stroke-1" />
              <p className="text-sm text-slate-600 mt-2 font-mono">Nothing scheduled — no tickets assigned yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Ticket Details Modal */}
      <TicketDetailsModal
        isOpen={!!selectedTicket}
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        isAdmin={false}
        onUpdateStatus={onUpdateStatus}
      />

    </div>
  );
};
export default StaffDashboard;