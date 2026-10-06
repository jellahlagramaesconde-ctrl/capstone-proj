import React, { useMemo, useState } from "react";
import { JobOrder, Notification } from "../types";
import { TicketDetailsModal } from "./TicketDetailsModal";
import { DenySuspendModal } from "./DenySuspendModal";
import { NewJobOrderButton } from "./NewJobOrderButton";
import { getJobOrderCostDisplay, formatPeso, sumJobOrderCosts } from "../priceUtils";
import {
  GraduationCap,
  CheckCircle,
  Clock,
  TrendingUp,
  Wallet,
  ChevronRight,
  FileText,
  AlertTriangle,
  Inbox,
  Ban,
  PauseCircle,
  Play,
  RotateCcw,
} from "lucide-react";

interface SchoolHeadDashboardProps {
  tickets: JobOrder[];
  onSchoolHeadApprove: (id: string) => void;
  onDeny?: (id: string, reason: string) => Promise<void> | void;
  onSuspend?: (id: string, reason: string) => Promise<void> | void;
  displayName?: string;
  onSubmitRequest?: (office: string, description: string, requestedByName: string, isEmergency: boolean, photoUrls?: string[], requiresFunds?: boolean) => Promise<void>;
  isSubmitting?: boolean;
  officeOptions?: string[];
  requestedByDefault?: string;
  aiEnabled?: boolean;
  notifications?: Notification[];
  readNotificationIds?: Set<string>;
  onMarkNotificationsRead?: (ids: string[]) => void;
}

export const SchoolHeadDashboard: React.FC<SchoolHeadDashboardProps> = ({
  tickets,
  onSchoolHeadApprove,
  onDeny,
  onSuspend,
  displayName,
  onSubmitRequest,
  isSubmitting = false,
  officeOptions,
  requestedByDefault,
  notifications = [],
  readNotificationIds = new Set(),
  onMarkNotificationsRead = () => { },
}) => {
  const [activeTab, setActiveTab] = useState<"pending" | "endorsed" | "suspended" | "denied">("pending");
  const [selectedTicket, setSelectedTicket] = useState<JobOrder | null>(null);
  const [endorsingId, setEndorsingId] = useState<string | null>(null);
  const [denySuspendTarget, setDenySuspendTarget] = useState<{ ticket: JobOrder; mode: "deny" | "suspend" } | null>(null);

  // Pending: PPO-approved, funded-track, not yet endorsed by president, not completed, not denied, not suspended
  // No-fund tickets skip this stage entirely and go straight to In Progress.
  const pendingEndorsementTickets = useMemo(() => {
    return tickets
      .filter((t) => t.ppoApproved && !t.schoolHeadApproved && t.requiresFunds && t.status !== "Completed" && t.status !== "Denied" && t.status !== "Suspended")
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }, [tickets]);

  // Endorsed: all tickets with school head approval
  const endorsedTickets = useMemo(() => {
    return tickets
      .filter((t) => t.schoolHeadApproved)
      .sort(
        (a, b) =>
          new Date(b.dateSubmitted).getTime() - new Date(a.dateSubmitted).getTime()
      );
  }, [tickets]);

  // Suspended tickets
  const suspendedTickets = useMemo(() => {
    return tickets
      .filter((t) => t.status === "Suspended")
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }, [tickets]);

  // Denied tickets
  const deniedTickets = useMemo(() => {
    return tickets
      .filter((t) => t.status === "Denied")
      .sort(
        (a, b) =>
          new Date(b.statusChangedAt || b.dateSubmitted).getTime() - new Date(a.statusChangedAt || a.dateSubmitted).getTime()
      );
  }, [tickets]);

  const stats = useMemo(() => {
    const pendingCount = pendingEndorsementTickets.length;
    const endorsedCount = endorsedTickets.length;
    const suspendedCount = suspendedTickets.length;
    const deniedCount = deniedTickets.length;
    const avgPriority =
      pendingCount > 0
        ? Math.round(
          pendingEndorsementTickets.reduce((s, t) => s + t.priorityScore, 0) / pendingCount
        )
        : 0;
    const totalRegistryValue = sumJobOrderCosts(tickets);
    const highPriorityCount = pendingEndorsementTickets.filter((t) => t.priorityScore >= 60).length;
    const emergencyCount = pendingEndorsementTickets.filter((t) => t.isEmergency).length;
    return { pendingCount, endorsedCount, suspendedCount, deniedCount, avgPriority, totalRegistryValue, highPriorityCount, emergencyCount };
  }, [pendingEndorsementTickets, endorsedTickets, suspendedTickets, deniedTickets, tickets]);

  // Priority tier: visual styling based on score
  const getPriorityTier = (score: number) => {
    if (score >= 80)
      return {
        label: "CRITICAL",
        border: "border-l-red-500",
        badge: "bg-red-50 text-red-600 border-red-200",
        dot: "bg-red-500",
        scoreBg: "bg-red-50 text-red-600",
      };
    if (score >= 60)
      return {
        label: "HIGH",
        border: "border-l-orange-400",
        badge: "bg-orange-50 text-orange-600 border-orange-200",
        dot: "bg-orange-400",
        scoreBg: "bg-orange-50 text-orange-600",
      };
    if (score >= 40)
      return {
        label: "MODERATE",
        border: "border-l-amber-400",
        badge: "bg-amber-50 text-amber-700 border-amber-200",
        dot: "bg-amber-400",
        scoreBg: "bg-amber-50 text-amber-700",
      };
    return {
      label: "ROUTINE",
      border: "border-l-slate-300",
      badge: "bg-slate-50 text-slate-500 border-slate-200",
      dot: "bg-slate-400",
      scoreBg: "bg-slate-50 text-slate-500",
    };
  };

  const handleEndorse = (ticketId: string) => {
    setEndorsingId(ticketId);
    onSchoolHeadApprove(ticketId);
    setTimeout(() => setEndorsingId(null), 1800);
  };

  const firstName = displayName?.split(" ").find((w) => w.length > 2) || "President";

  return (
    <div className="flex-1 overflow-y-auto bg-[#F7F4F0] text-[#2B1210]">

      {/* ══════════════════════════════════════════
          EXECUTIVE HEADER BANNER
      ══════════════════════════════════════════ */}
      <div className="bg-gradient-to-br from-[#3A0B10] via-[#6B1420] to-[#4A0D16] text-white px-4 sm:px-6 py-4 relative overflow-hidden">
        {/* Decorative geometry */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full border border-white/8" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full border border-white/8" />
        </div>

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Identity */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm p-2">
              <GraduationCap className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-mono tracking-[0.2em] text-white/45 uppercase mb-0.5">
                Principal &amp; President Approval Desk
              </p>
              <h2 className="text-base sm:text-lg font-display font-bold text-white leading-tight">
                {displayName || "School Directress / President"}
              </h2>
              <p className="text-[11px] text-white/40 font-sans mt-1 max-w-lg leading-relaxed hidden sm:block">
                Colegio de Santa Catalina de Alejandria — Review PPO-evaluated repair
                requisitions and endorse them for Finance funding.
              </p>
            </div>
          </div>

          {/* Status + count chips */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {stats.pendingCount > 0 && (
              <div className="bg-white/10 border border-white/15 rounded-lg px-3 py-1.5 text-center backdrop-blur-sm">
                <p className="text-lg font-mono font-bold text-white leading-none">
                  {stats.pendingCount}
                </p>
                <p className="text-[9px] font-mono text-white/50 mt-0.5 uppercase tracking-widest whitespace-nowrap">
                  Awaiting Sign-off
                </p>
              </div>
            )}
            {stats.emergencyCount > 0 && (
              <div className="bg-red-500/15 border border-red-300/30 rounded-lg px-3 py-1.5 text-center backdrop-blur-sm">
                <p className="text-lg font-mono font-bold text-red-200 leading-none">
                  {stats.emergencyCount}
                </p>
                <p className="text-[9px] font-mono text-red-200/80 mt-0.5 uppercase tracking-widest whitespace-nowrap">
                  🚨 Emergency
                </p>
              </div>
            )}
            <div className="bg-white/10 border border-white/15 rounded-lg px-3 py-1.5 text-center backdrop-blur-sm hidden sm:block">
              <p className="text-[9px] font-mono font-bold text-white/55 uppercase tracking-wider whitespace-nowrap">
                Account Status
              </p>
              <div className="flex items-center gap-1 mt-0.5 justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-[10px] font-mono text-emerald-300 font-bold whitespace-nowrap">VERIFIED SIGNATORY</p>
              </div>
            </div>
            {onSubmitRequest && (
              <div className="hidden lg:block">
                <NewJobOrderButton
                  onSubmitRequest={onSubmitRequest}
                  isSubmitting={isSubmitting}
                  officeOptions={officeOptions}
                  defaultRequestedBy={requestedByDefault}
                  className="!py-1.5 !px-3 !text-xs"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          EMERGENCY ALERT BANNER
      ══════════════════════════════════════════ */}
      {stats.emergencyCount > 0 && (
        <div className="mx-3 sm:mx-5 mt-3 bg-red-600 text-white rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg animate-pulse">
          <span className="text-2xl shrink-0">🚨</span>
          <div className="flex-1 min-w-0">
            <p className="font-mono font-bold text-sm leading-tight">
              URGENT ACTION REQUIRED — {stats.emergencyCount} EMERGENCY {stats.emergencyCount === 1 ? "REQUEST" : "REQUESTS"} PENDING YOUR ENDORSEMENT
            </p>
            <p className="text-xs text-red-100 mt-0.5 font-sans">
              Emergency requests require immediate endorsement to allow Finance to release funding and dispatch the technician.
            </p>
          </div>
          <div className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" />
        </div>
      )}

      <div className="p-3 sm:p-5">

        {/* ══════════════════════════════════════════
            STATS CARDS
        ══════════════════════════════════════════ */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-5">
          {/* Pending */}
          <div className="bg-white border border-[#E6DDD3] rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-1.5">
              <p className="text-[10px] font-mono tracking-wider text-slate-600 uppercase font-semibold leading-snug">
                Pending Endorsement
              </p>
              <div className="w-6 h-6 rounded-md bg-[#6B1420]/10 flex items-center justify-center shrink-0">
                <Clock className="w-3 h-3 text-[#6B1420]" />
              </div>
            </div>
            <h4 className="text-xl font-mono font-bold text-[#6B1420] leading-none">
              {stats.pendingCount}
            </h4>
            <p className="text-[11px] text-slate-600 mt-1 font-sans">
              {stats.highPriorityCount > 0 ? (
                <span className="text-orange-500 font-semibold">
                  {stats.highPriorityCount} high-priority
                </span>
              ) : (
                "No critical items"
              )}
            </p>
          </div>

          {/* Endorsed */}
          <div className="bg-white border border-[#E6DDD3] rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-1.5">
              <p className="text-[10px] font-mono tracking-wider text-slate-600 uppercase font-semibold leading-snug">
                Total Endorsed
              </p>
              <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
                <CheckCircle className="w-3 h-3 text-emerald-500" />
              </div>
            </div>
            <h4 className="text-xl font-mono font-bold text-emerald-600 leading-none">
              {stats.endorsedCount}
            </h4>
            <p className="text-[11px] text-slate-600 mt-1 font-sans">Forwarded to Finance</p>
          </div>

          {/* Avg Priority */}
          <div className="bg-white border border-[#E6DDD3] rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-1.5">
              <p className="text-[10px] font-mono tracking-wider text-slate-600 uppercase font-semibold leading-snug">
                Avg Priority Score
              </p>
              <div className="w-6 h-6 rounded-md bg-[#6B1420]/10 flex items-center justify-center shrink-0">
                <TrendingUp className="w-3 h-3 text-[#6B1420]" />
              </div>
            </div>
            <h4 className="text-xl font-mono font-bold text-[#6B1420] leading-none">
              {stats.avgPriority}
              <span className="text-xs font-sans font-normal text-slate-600"> / 100</span>
            </h4>
            <p className="text-[11px] text-slate-600 mt-1 font-sans">Current request load</p>
          </div>

          {/* Registry Value */}
          <div className="bg-white border border-[#E6DDD3] rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-1.5">
              <p className="text-[10px] font-mono tracking-wider text-slate-600 uppercase font-semibold leading-snug">
                Registry Value
              </p>
              <div className="w-6 h-6 rounded-md bg-[#6B1420]/10 flex items-center justify-center shrink-0">
                <Wallet className="w-3 h-3 text-[#6B1420]" />
              </div>
            </div>
            <h4 className="text-lg font-mono font-bold text-[#6B1420] leading-none">
              {formatPeso(stats.totalRegistryValue)}
            </h4>
            <p className="text-[11px] text-slate-600 mt-1 font-sans">All job orders on record</p>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            TAB NAVIGATION
        ══════════════════════════════════════════ */}
        <div className="flex items-center gap-1 bg-white border border-[#E6DDD3] rounded-xl p-1 mb-6 w-fit shadow-sm flex-wrap">
          {[
            {
              key: "pending",
              icon: <Clock className="w-4 h-4" />,
              label: "Pending Endorsement",
              shortLabel: "Pending",
              count: stats.pendingCount,
              badgeClass: activeTab === "pending" ? "bg-white/20 text-white" : "bg-[#F0EAE4] text-[#6B1420]",
            },
            {
              key: "endorsed",
              icon: <CheckCircle className="w-4 h-4" />,
              label: "My Endorsed Log",
              shortLabel: "Endorsed",
              count: stats.endorsedCount,
              badgeClass: activeTab === "endorsed" ? "bg-white/20 text-white" : "bg-[#F0EAE4] text-emerald-700",
            },
            {
              key: "suspended",
              icon: <PauseCircle className="w-4 h-4 text-amber-600" />,
              label: "Suspended / On Hold",
              shortLabel: "Suspended",
              count: stats.suspendedCount,
              badgeClass: activeTab === "suspended" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800",
            },
            {
              key: "denied",
              icon: <Ban className="w-4 h-4 text-rose-600" />,
              label: "Denied Requests",
              shortLabel: "Denied",
              count: stats.deniedCount,
              badgeClass: activeTab === "denied" ? "bg-white/20 text-white" : "bg-rose-100 text-rose-800",
            },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-display font-semibold text-xs sm:text-sm transition-all cursor-pointer ${
                activeTab === tab.key
                  ? "bg-[#6B1420] text-white shadow-sm"
                  : "text-slate-700 hover:text-[#241012] hover:bg-[#F5F1EC]"
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
              <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded-full ${tab.badgeClass}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════
            TAB: PENDING ENDORSEMENT
        ══════════════════════════════════════════ */}
        {activeTab === "pending" && (
          <div>
            {pendingEndorsementTickets.length === 0 ? (
              <div className="bg-white border border-[#E6DDD3] rounded-xl p-16 text-center shadow-sm">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                </div>
                <h4 className="font-display font-bold text-lg text-[#241012]">
                  Approval Desk is Clear
                </h4>
                <p className="text-sm text-slate-600 mt-2 max-w-sm mx-auto font-sans leading-relaxed">
                  All PPO-evaluated requests have been endorsed. Excellent institutional
                  responsiveness, {firstName}!
                </p>
              </div>
            ) : (
              <>
                {/* Summary bar */}
                <div className="flex items-center justify-between mb-5 px-1">
                  <p className="text-sm font-sans text-slate-700">
                    <span className="font-semibold text-[#2B1210]">
                      {pendingEndorsementTickets.length}
                    </span>{" "}
                    job order{pendingEndorsementTickets.length !== 1 ? "s" : ""} awaiting
                    your endorsement
                  </p>
                  <p className="text-sm font-mono text-slate-700">
                    Est. total:{" "}
                    <span className="text-[#6B1420] font-bold">
                      {formatPeso(sumJobOrderCosts(pendingEndorsementTickets))}
                    </span>
                  </p>
                </div>

                {/* Ticket cards */}
                <div className="space-y-4">
                  {pendingEndorsementTickets.map((ticket) => {
                    const tier = getPriorityTier(ticket.priorityScore);
                    const costDisplay = getJobOrderCostDisplay(ticket);
                    const isEndorsing = endorsingId === ticket.id;

                    return (
                      <div
                        key={ticket.id}
                        className={`bg-white border-l-4 ${tier.border} rounded-xl shadow-sm hover:shadow-md transition-all ${
                          ticket.isEmergency
                            ? "border-2 border-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.15),0_0_16px_rgba(239,68,68,0.2)]"
                            : "border border-[#E6DDD3]"
                        }`}
                      >
                        {/* ── Clickable upper body ── */}
                        <div
                          className="p-5 pb-4 cursor-pointer"
                          onClick={() => setSelectedTicket(ticket)}
                        >
                          {/* Row 1: ID, badges, date */}
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-bold text-[#241012] bg-[#F0EAE4] px-2 py-0.5 rounded">
                                {ticket.id}
                              </span>
                              {ticket.isEmergency && (
                                <span className="text-xs font-mono font-bold px-2 py-0.5 bg-red-500 text-white rounded-full">
                                  🚨 EMERGENCY
                                </span>
                              )}
                              <span
                                className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${tier.badge}`}
                              >
                                {tier.label}
                              </span>
                              <span className="text-xs font-mono px-2 py-0.5 bg-[#F0EAE4] text-[#6B1420] border border-[#E6DDD3] rounded-full">
                                {ticket.jobType}
                              </span>
                            </div>
                            <span className="text-xs font-mono text-slate-600 shrink-0">
                              {ticket.dateSubmitted
                                ? new Date(ticket.dateSubmitted).toLocaleDateString("en-PH", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                                : "—"}
                            </span>
                          </div>

                          {/* Office & description */}
                          <h4 className="font-display font-bold text-base text-[#241012] group-hover:text-[#6B1420] transition-colors mb-1">
                            {ticket.office}
                          </h4>
                          <p className="text-sm text-slate-700 line-clamp-2 font-sans leading-relaxed">
                            {ticket.description}
                          </p>

                          {/* ── 3-step approval pipeline ── */}
                          <div className="flex items-center gap-1.5 mt-4 text-xs font-mono flex-wrap">
                            <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                                <CheckCircle className="w-3 h-3 text-white" />
                              </div>
                              PPO Verified
                            </div>
                            <ChevronRight className="w-3 h-3 text-[#CCBDB4]" />
                            <div className="flex items-center gap-1.5 text-[#6B1420] font-bold bg-[#6B1420]/8 border border-[#6B1420]/20 px-2.5 py-1 rounded-full">
                              <div className="w-2 h-2 rounded-full bg-[#6B1420] animate-pulse" />
                              YOUR APPROVAL
                            </div>
                            <ChevronRight className="w-3 h-3 text-[#CCBDB4]" />
                            <div className="flex items-center gap-1 text-slate-600 font-medium">
                              <div className="w-5 h-5 rounded-full border-2 border-[#DDD2C8] flex items-center justify-center">
                                <span className="text-[8px] font-bold text-slate-600">₱</span>
                              </div>
                              Finance Release
                            </div>
                          </div>

                          {/* ── Assessment metrics ── */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[#F5F1EC]">
                            <div>
                              <p className="text-[11px] font-mono uppercase tracking-wide text-slate-600 mb-1">
                                Safety Risk
                              </p>
                              <div className="flex items-center gap-1.5">
                                <div
                                  className={`w-2 h-2 rounded-full ${(ticket.safetyRisk ?? 0) >= 4
                                    ? "bg-red-500"
                                    : (ticket.safetyRisk ?? 0) >= 3
                                      ? "bg-orange-400"
                                      : "bg-emerald-400"
                                    }`}
                                />
                                <span
                                  className={`font-mono font-bold text-sm ${(ticket.safetyRisk ?? 0) >= 4
                                    ? "text-red-500"
                                    : "text-[#4A322E]"
                                    }`}
                                >
                                  {ticket.safetyRisk ?? "—"} / 5
                                </span>
                              </div>
                            </div>

                            <div>
                              <p className="text-[11px] font-mono uppercase tracking-wide text-slate-600 mb-1">
                                Priority
                              </p>
                              <span
                                className={`font-mono font-bold text-sm px-2 py-0.5 rounded ${tier.scoreBg}`}
                              >
                                {ticket.priorityScore} pts
                              </span>
                            </div>

                            <div>
                              <p className="text-[11px] font-mono uppercase tracking-wide text-slate-600 mb-1">
                                {costDisplay.label}
                              </p>
                              <span
                                className={`font-mono font-bold text-sm border px-1.5 py-0.5 rounded text-xs ${costDisplay.badgeClass}`}
                              >
                                {costDisplay.text}
                              </span>
                            </div>

                            <div>
                              <p className="text-[11px] font-mono uppercase tracking-wide text-slate-600 mb-1">
                                Assigned To
                              </p>
                              <span className="font-mono text-xs text-[#4A322E] truncate block">
                                {ticket.assignedStaff || "—"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* ── Endorsement action footer ── */}
                        <div className="px-5 pb-5">
                          {ticket.isEmergency && (
                            <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs font-sans text-red-700">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-500" />
                              <span>
                                <strong>Emergency note:</strong> This request bypassed normal
                                flow — PPO has already dispatched staff. Your endorsement is
                                for record-keeping.
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEndorse(ticket.id);
                              }}
                              disabled={isEndorsing}
                              className="flex-1 py-3 bg-[#6B1420] hover:bg-[#4A0D16] active:scale-[0.99] text-white text-sm font-display font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                              {isEndorsing ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  Endorsing…
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4" />
                                  Endorse &amp; Forward to Finance
                                  <ChevronRight className="w-4 h-4 opacity-60" />
                                </>
                              )}
                            </button>
                            {onSuspend && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDenySuspendTarget({ ticket, mode: "suspend" });
                                }}
                                className="px-3.5 py-3 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-display font-semibold text-xs sm:text-sm rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                                title="Put request on hold with note"
                              >
                                <PauseCircle className="w-4 h-4 text-amber-600" />
                                <span className="hidden sm:inline">Suspend</span>
                              </button>
                            )}
                            {onDeny && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDenySuspendTarget({ ticket, mode: "deny" });
                                }}
                                className="px-3.5 py-3 border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 font-display font-semibold text-xs sm:text-sm rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                                title="Disapprove and reject request with note"
                              >
                                <Ban className="w-4 h-4 text-rose-600" />
                                <span className="hidden sm:inline">Deny</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB: ENDORSED LOG
        ══════════════════════════════════════════ */}
        {activeTab === "endorsed" && (
          <div>
            {endorsedTickets.length === 0 ? (
              <div className="bg-white border border-[#E6DDD3] rounded-xl p-16 text-center shadow-sm">
                <div className="w-16 h-16 rounded-full bg-[#F0EAE4] flex items-center justify-center mx-auto mb-4">
                  <Inbox className="w-8 h-8 text-slate-600" />
                </div>
                <h4 className="font-display font-bold text-lg text-[#241012]">
                  No Endorsements Yet
                </h4>
                <p className="text-sm text-slate-600 mt-2 max-w-sm mx-auto font-sans leading-relaxed">
                  Job orders you endorse will appear here as a permanent record.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-[#E6DDD3] rounded-xl shadow-sm overflow-hidden">
                {/* Table header */}
                <div className="px-6 py-4 border-b border-[#F0EAE4] flex items-center justify-between bg-[#FDFCFB]">
                  <h3 className="font-display font-semibold text-base text-[#241012] flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#6B1420]" />
                    Endorsement History
                  </h3>
                  <p className="text-xs font-mono text-slate-700">
                    Total:{" "}
                    <span className="text-[#6B1420] font-bold">
                      {formatPeso(sumJobOrderCosts(endorsedTickets))}
                    </span>
                  </p>
                </div>

                {/* Rows */}
                <div className="divide-y divide-[#F5F1EC]">
                  {endorsedTickets.map((ticket) => {
                    const tier = getPriorityTier(ticket.priorityScore);
                    const costDisplay = getJobOrderCostDisplay(ticket);
                    return (
                      <div
                        key={ticket.id}
                        onClick={() => setSelectedTicket(ticket)}
                        className="flex items-center gap-4 px-6 py-4 hover:bg-[#F7F4F0] cursor-pointer transition-colors group"
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
                              {ticket.id}
                            </span>
                            {ticket.isEmergency && (
                              <span className="text-[11px] font-mono font-bold px-1.5 py-px bg-red-100 text-red-600 rounded-full">
                                EMERGENCY
                              </span>
                            )}
                            {false && (
                              <span
                                className="text-[11px] font-mono font-bold px-1.5 py-px bg-red-600 text-white rounded-full"
                                title="PPO approved directly — your endorsement was auto-recorded, not manually given"
                              >
                                PPO BYPASS
                              </span>
                            )}
                            <span className="text-[11px] font-mono text-slate-600 bg-[#F0EAE4] px-1.5 py-px rounded">
                              {ticket.jobType}
                            </span>
                          </div>
                          <p className="font-sans font-semibold text-sm text-[#2B1210] truncate">
                            {ticket.office}
                          </p>
                          <p className="text-xs text-slate-600 truncate font-sans">
                            {ticket.description}
                          </p>
                        </div>

                        {/* Cost + status */}
                        <div className="text-right shrink-0 hidden sm:block">
                          <p className="font-mono font-bold text-sm text-[#6B1420]">
                            {costDisplay.text}
                          </p>
                          <span
                            className={`inline-block text-[11px] font-mono font-bold px-2 py-0.5 rounded-full mt-1 ${ticket.status === "Completed"
                              ? "bg-emerald-50 text-emerald-600"
                              : ticket.status === "In Progress"
                                ? "bg-cyan-50 text-cyan-600"
                                : "bg-amber-50 text-amber-600"
                              }`}
                          >
                            {ticket.financeApproved
                              ? ticket.status.toUpperCase()
                              : "AWAITING FINANCE"}
                          </span>
                        </div>

                        <ChevronRight className="w-4 h-4 text-[#DDD2C8] group-hover:text-[#6B1420] transition-colors shrink-0" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB: SUSPENDED / ON HOLD
        ══════════════════════════════════════════ */}
        {activeTab === "suspended" && (
          <div>
            {suspendedTickets.length === 0 ? (
              <div className="bg-white border border-[#E6DDD3] rounded-xl p-16 text-center shadow-sm">
                <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
                  <PauseCircle className="w-8 h-8 text-amber-600" />
                </div>
                <h4 className="font-display font-bold text-lg text-[#241012]">
                  No Suspended Requests
                </h4>
                <p className="text-sm text-slate-600 mt-2 max-w-sm mx-auto font-sans leading-relaxed">
                  There are currently no job orders placed on hold.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-sm font-sans text-slate-700">
                    <span className="font-semibold text-[#2B1210]">
                      {suspendedTickets.length}
                    </span>{" "}
                    request{suspendedTickets.length !== 1 ? "s" : ""} on hold
                  </p>
                </div>
                {suspendedTickets.map((ticket) => {
                  const costDisplay = getJobOrderCostDisplay(ticket);
                  return (
                    <div
                      key={ticket.id}
                      className="bg-white border-l-4 border-l-amber-500 border border-amber-200/80 rounded-xl shadow-sm hover:shadow-md transition-all p-5"
                    >
                      <div
                        className="cursor-pointer"
                        onClick={() => setSelectedTicket(ticket)}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-bold text-[#241012] bg-[#F0EAE4] px-2 py-0.5 rounded">
                              {ticket.id}
                            </span>
                            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                              <PauseCircle className="w-3.5 h-3.5" />
                              SUSPENDED
                            </span>
                            <span className="text-xs font-mono px-2 py-0.5 bg-[#F0EAE4] text-[#6B1420] border border-[#E6DDD3] rounded-full">
                              {ticket.jobType}
                            </span>
                          </div>
                          <span className="text-xs font-mono text-slate-600">
                            {ticket.statusChangedAt
                              ? new Date(ticket.statusChangedAt).toLocaleString()
                              : "—"}
                          </span>
                        </div>

                        <h4 className="font-display font-bold text-base text-[#241012] mb-1">
                          {ticket.office}
                        </h4>
                        <p className="text-sm text-slate-700 line-clamp-2 font-sans mb-3">
                          {ticket.description}
                        </p>

                        {/* Suspension callout */}
                        <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-xs font-sans text-amber-900 mb-3">
                          <p className="font-bold font-mono text-[11px] uppercase tracking-wider text-amber-800 mb-0.5">
                            Reason for Suspension ({ticket.statusActorRole || "Admin"}):
                          </p>
                          <p className="italic">"{ticket.statusReason || "Temporarily on hold pending review."}"</p>
                        </div>

                        <div className="flex items-center justify-between text-xs font-mono text-slate-600 border-t border-[#F5F1EC] pt-3">
                          <span>Est: <strong className="text-[#6B1420]">{costDisplay.text}</strong></span>
                          <span>Assigned: <strong className="text-[#2B1210]">{ticket.assignedStaff || "Unassigned"}</strong></span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB: DENIED REQUESTS
        ══════════════════════════════════════════ */}
        {activeTab === "denied" && (
          <div>
            {deniedTickets.length === 0 ? (
              <div className="bg-white border border-[#E6DDD3] rounded-xl p-16 text-center shadow-sm">
                <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-4">
                  <Ban className="w-8 h-8 text-rose-600" />
                </div>
                <h4 className="font-display font-bold text-lg text-[#241012]">
                  No Denied Requests
                </h4>
                <p className="text-sm text-slate-600 mt-2 max-w-sm mx-auto font-sans leading-relaxed">
                  No requests have been disapproved or denied.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-sm font-sans text-slate-700">
                    <span className="font-semibold text-[#2B1210]">
                      {deniedTickets.length}
                    </span>{" "}
                    denied request{deniedTickets.length !== 1 ? "s" : ""}
                  </p>
                </div>
                {deniedTickets.map((ticket) => {
                  const costDisplay = getJobOrderCostDisplay(ticket);
                  return (
                    <div
                      key={ticket.id}
                      className="bg-white border-l-4 border-l-rose-500 border border-rose-200/80 rounded-xl shadow-sm hover:shadow-md transition-all p-5 cursor-pointer"
                      onClick={() => setSelectedTicket(ticket)}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-bold text-[#241012] bg-[#F0EAE4] px-2 py-0.5 rounded">
                            {ticket.id}
                          </span>
                          <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                            <Ban className="w-3.5 h-3.5" />
                            DENIED
                          </span>
                          <span className="text-xs font-mono px-2 py-0.5 bg-[#F0EAE4] text-[#6B1420] border border-[#E6DDD3] rounded-full">
                            {ticket.jobType}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-slate-600">
                          {ticket.statusChangedAt
                            ? new Date(ticket.statusChangedAt).toLocaleString()
                            : "—"}
                        </span>
                      </div>

                      <h4 className="font-display font-bold text-base text-[#241012] mb-1">
                        {ticket.office}
                      </h4>
                      <p className="text-sm text-slate-700 line-clamp-2 font-sans mb-3">
                        {ticket.description}
                      </p>

                      {/* Denial Remarks */}
                      <div className="p-3 bg-rose-50/80 border border-rose-200 rounded-lg text-xs font-sans text-rose-900 mb-3">
                        <p className="font-bold font-mono text-[11px] uppercase tracking-wider text-rose-800 mb-0.5">
                          Disapproval Remarks ({ticket.statusActorRole || "Admin"}):
                        </p>
                        <p className="italic">"{ticket.statusReason || "Disapproved by institutional authority."}"</p>
                      </div>

                      <div className="flex items-center justify-between text-xs font-mono text-slate-600 border-t border-[#F5F1EC] pt-3">
                        <span>Est: <strong className="text-[#6B1420]">{costDisplay.text}</strong></span>
                        <span>Requester: <strong className="text-[#2B1210]">{ticket.requestedByName}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
          TICKET DETAILS MODAL
      ══════════════════════════════════════════ */}
      {selectedTicket && (
        <TicketDetailsModal
          isOpen={!!selectedTicket}
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          actorRole="President"
          onSchoolHeadApprove={(id) => {
            onSchoolHeadApprove(id);
            setSelectedTicket(null);
          }}
          onDeny={async (id, reason) => {
            await onDeny?.(id, reason);
            setSelectedTicket(null);
          }}
          onSuspend={async (id, reason) => {
            await onSuspend?.(id, reason);
            setSelectedTicket(null);
          }}
        />
      )}

      {/* ══════════════════════════════════════════
          DENY / SUSPEND MODAL
      ══════════════════════════════════════════ */}
      {denySuspendTarget && (
        <DenySuspendModal
          isOpen={true}
          mode={denySuspendTarget.mode}
          ticket={denySuspendTarget.ticket}
          actorRole="President"
          onClose={() => setDenySuspendTarget(null)}
          onConfirm={async (reason) => {
            if (denySuspendTarget.mode === "deny") {
              await onDeny?.(denySuspendTarget.ticket.id, reason);
            } else {
              await onSuspend?.(denySuspendTarget.ticket.id, reason);
            }
            setDenySuspendTarget(null);
          }}
        />
      )}
    </div>
  );
};