import React, { useMemo, useState } from "react";
import { JobOrder, Notification } from "../types";
import { TicketDetailsModal } from "./TicketDetailsModal";
import { NewJobOrderButton } from "./NewJobOrderButton";
import { FinanceTotalValuePage } from "./FinanceTotalValuePage";
import { getJobOrderCostDisplay, formatPeso, sumJobOrderCosts } from "../priceUtils";
import {
  CheckCircle,
  Clock,
  Wallet,
  TrendingUp,
  FileText,
  ShieldCheck,
  Inbox,
  Building2,
  ChevronRight,
  AlertCircle,
  Sparkles,
  ExternalLink,
} from "lucide-react";

interface FinanceDashboardProps {
  tickets: JobOrder[];
  onFinanceApprove: (id: string, approvedAmount?: number, estimatedCost?: number, financeNotes?: string) => void;
  onSubmitRequest?: (office: string, description: string, requestedByName: string, isEmergency: boolean) => Promise<void>;
  isSubmitting?: boolean;
  officeOptions?: string[];
  requestedByDefault?: string;
  aiEnabled?: boolean;
  notifications?: Notification[];
  readNotificationIds?: Set<string>;
  onMarkNotificationsRead?: (ids: string[]) => void;
}

// Strip non-numeric chars (except single decimal point) from a peso input string
function parsePesoInput(value: string): string {
  return value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
}

export const FinanceDashboard: React.FC<FinanceDashboardProps> = ({
  tickets,
  onFinanceApprove,
  onSubmitRequest,
  isSubmitting = false,
  officeOptions,
  requestedByDefault,
  notifications = [],
  readNotificationIds = new Set(),
  onMarkNotificationsRead = () => { },
}) => {
  const [activeTab, setActiveTab] = useState<"pending" | "funded" | "departments">("pending");
  const [financePage, setFinancePage] = useState<"dashboard" | "totalValue">("dashboard");
  const [selectedTicket, setSelectedTicket] = useState<JobOrder | null>(null);

  // Per-ticket finance input state
  const [estimatedCosts, setEstimatedCosts] = useState<Record<string, string>>({});
  const [approvedAmounts, setApprovedAmounts] = useState<Record<string, string>>({});
  const [financeNotes, setFinanceNotes] = useState<Record<string, string>>({});
  const [fundingId, setFundingId] = useState<string | null>(null);

  // ── Filters ──────────────────────────────────────────
  const pendingFundingTickets = useMemo(
    () =>
      tickets
        .filter((t) => t.ppoApproved && t.schoolHeadApproved && !t.financeApproved)
        .sort((a, b) => b.priorityScore - a.priorityScore),
    [tickets]
  );

  const fundedTickets = useMemo(
    () =>
      tickets
        .filter((t) => t.financeApproved)
        .sort(
          (a, b) =>
            new Date(b.dateSubmitted).getTime() - new Date(a.dateSubmitted).getTime()
        ),
    [tickets]
  );

  // ── Department breakdown ──────────────────────────────
  const departmentBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { requests: JobOrder[]; fundedTotal: number; estimatedTotal: number }
    >();
    tickets.forEach((t) => {
      const dept = t.office || "Unknown";
      if (!map.has(dept)) map.set(dept, { requests: [], fundedTotal: 0, estimatedTotal: 0 });
      const entry = map.get(dept)!;
      entry.requests.push(t);
      if (t.financeApproved) {
        entry.fundedTotal += t.approvedAmount ?? t.estimatedCost ?? 0;
      }
      if (t.estimatedCost !== undefined) entry.estimatedTotal += t.estimatedCost;
    });
    return Array.from(map.entries())
      .map(([dept, data]) => ({ dept, ...data }))
      .sort((a, b) => b.estimatedTotal - a.estimatedTotal);
  }, [tickets]);

  // ── Summary stats ─────────────────────────────────────
  const stats = useMemo(() => {
    const awaitingCount = pendingFundingTickets.length;
    const fundedCount = fundedTickets.length;
    const totalDisbursed = sumJobOrderCosts(fundedTickets);
    const pendingEstimate = sumJobOrderCosts(pendingFundingTickets);
    // Requests PPO approved via the emergency track, where Finance's release
    // was auto-recorded rather than a genuine funding decision.
    const bypassedCount = tickets.filter((t) => t.emergencyBypassed).length;
    return { awaitingCount, fundedCount, totalDisbursed, pendingEstimate, bypassedCount };
  }, [pendingFundingTickets, fundedTickets, tickets]);

  // ── Helpers ───────────────────────────────────────────
  const getEst = (ticket: JobOrder): string => {
    if (estimatedCosts[ticket.id] !== undefined) return estimatedCosts[ticket.id];
    if (ticket.estimatedCost !== undefined) return String(ticket.estimatedCost);
    return "";
  };

  const getAppr = (ticket: JobOrder): string => {
    if (approvedAmounts[ticket.id] !== undefined) return approvedAmounts[ticket.id];
    if (ticket.estimatedCost !== undefined) return String(ticket.estimatedCost);
    return "";
  };

  const handleFund = (ticket: JobOrder) => {
    const est = getEst(ticket);
    const appr = getAppr(ticket);
    const apprNum = appr ? Number(appr) : 0;
    if (!apprNum || apprNum <= 0) return; // guarded by disabled state
    setFundingId(ticket.id);
    onFinanceApprove(ticket.id, apprNum, est ? Number(est) : undefined, financeNotes[ticket.id] || "");
    setTimeout(() => setFundingId(null), 1800);
  };

  // ── If Total Value page is active, render it instead ───────────
  if (financePage === "totalValue") {
    return (
      <FinanceTotalValuePage
        tickets={tickets}
        onBack={() => setFinancePage("dashboard")}
        onFinanceApprove={onFinanceApprove}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#F7F4F0] text-[#2B1210]">

      {/* ════════════════════════════════════════════
          FINANCE HEADER BANNER
      ════════════════════════════════════════════ */}
      <div className="bg-gradient-to-br from-[#0A3B21] via-[#155C35] to-[#0D4A2A] text-white px-4 sm:px-6 py-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full border border-white/8" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full border border-white/8" />
        </div>
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <Wallet className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-mono tracking-[0.2em] text-white/45 uppercase mb-0.5">
                Finance &amp; Funding Portal
              </p>
              <h2 className="text-base sm:text-lg font-display font-bold text-white leading-tight">
                Budget Release &amp; Fund Allocation
              </h2>
              <p className="text-[11px] text-white/40 font-sans mt-1 max-w-lg leading-relaxed hidden sm:block">
                Review PPO &amp; President-endorsed requisitions and release funding.
                All amounts are in Philippine Pesos (₱ PHP).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {stats.awaitingCount > 0 && (
              <div className="bg-white/10 border border-white/15 rounded-lg px-3 py-1.5 text-center backdrop-blur-sm">
                <p className="text-lg font-mono font-bold text-white leading-none">
                  {stats.awaitingCount}
                </p>
                <p className="text-[9px] font-mono text-white/50 mt-0.5 uppercase tracking-widest whitespace-nowrap">
                  Awaiting Sign-off
                </p>
              </div>
            )}
            {stats.bypassedCount > 0 && (
              <div className="bg-red-500/15 border border-red-300/30 rounded-lg px-3 py-1.5 text-center backdrop-blur-sm">
                <p className="text-lg font-mono font-bold text-red-200 leading-none">
                  {stats.bypassedCount}
                </p>
                <p className="text-[9px] font-mono text-red-200/80 mt-0.5 uppercase tracking-widest whitespace-nowrap">
                  PPO Bypassed You
                </p>
              </div>
            )}
            <div className="bg-white/10 border border-white/15 rounded-lg px-3 py-1.5 text-center backdrop-blur-sm hidden sm:block">
              <p className="text-[9px] font-mono font-bold text-white/55 uppercase tracking-wider whitespace-nowrap">
                Pending Est.
              </p>
              <p className="text-xs font-mono font-bold text-yellow-300 mt-0.5 whitespace-nowrap">
                {formatPeso(stats.pendingEstimate)}
              </p>
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

      <div className="p-3 sm:p-5">

        {/* ════════════════════════════════════════════
            STATS ROW
        ════════════════════════════════════════════ */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-5">
          <div className="bg-white border border-[#E6DDD3] rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-1.5">
              <p className="text-[10px] font-mono tracking-wider text-slate-600 uppercase font-semibold leading-snug">
                Awaiting Sign-off
              </p>
              <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center shrink-0">
                <Clock className="w-3 h-3 text-amber-500" />
              </div>
            </div>
            <h4 className="text-xl font-mono font-bold text-amber-600 leading-none">
              {stats.awaitingCount}
            </h4>
            <p className="text-[11px] text-slate-600 mt-1 font-mono">
              Est: <span className="font-bold text-[#4A322E]">{formatPeso(stats.pendingEstimate)}</span>
            </p>
          </div>

          <div className="bg-white border border-[#E6DDD3] rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-1.5">
              <p className="text-[10px] font-mono tracking-wider text-slate-600 uppercase font-semibold leading-snug">
                Total Funded
              </p>
              <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
                <CheckCircle className="w-3 h-3 text-emerald-500" />
              </div>
            </div>
            <h4 className="text-xl font-mono font-bold text-emerald-600 leading-none">
              {stats.fundedCount}
            </h4>
            <p className="text-[11px] text-slate-600 mt-1 font-sans">Dispatched to technicians</p>
          </div>

          <button
            onClick={() => setFinancePage("totalValue")}
            className="bg-white border-2 border-[#155C35]/30 rounded-lg p-3 shadow-sm hover:shadow-lg hover:border-[#155C35]/60 hover:-translate-y-0.5 transition-all text-left cursor-pointer group relative overflow-hidden"
            title="Click to view full Total Value Report"
          >
            {/* Subtle animated shimmer on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#155C35]/4 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex items-start justify-between mb-1.5">
              <p className="text-[10px] font-mono tracking-wider text-slate-600 uppercase font-semibold leading-snug">
                Total Disbursed
              </p>
              <div className="w-6 h-6 rounded-md bg-[#155C35]/10 group-hover:bg-[#155C35]/20 flex items-center justify-center shrink-0 transition-colors">
                <TrendingUp className="w-3 h-3 text-[#155C35]" />
              </div>
            </div>
            <h4 className="relative text-lg font-mono font-bold text-[#155C35] leading-none">
              {formatPeso(stats.totalDisbursed)}
            </h4>
            <div className="relative flex items-center justify-between mt-1">
              <p className="text-[11px] text-slate-600 font-sans">Released to funded orders</p>
              <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-[#155C35] opacity-0 group-hover:opacity-100 transition-opacity">
                View Report <ExternalLink className="w-2.5 h-2.5" />
              </span>
            </div>
          </button>

          <div className="bg-white border border-[#E6DDD3] rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-1.5">
              <p className="text-[10px] font-mono tracking-wider text-slate-600 uppercase font-semibold leading-snug">
                Active Departments
              </p>
              <div className="w-6 h-6 rounded-md bg-[#6B1420]/10 flex items-center justify-center shrink-0">
                <Building2 className="w-3 h-3 text-[#6B1420]" />
              </div>
            </div>
            <h4 className="text-xl font-mono font-bold text-[#6B1420] leading-none">
              {departmentBreakdown.length}
            </h4>
            <p className="text-[11px] text-slate-600 mt-1 font-sans">Offices with job orders</p>
          </div>
        </section>

        {/* ════════════════════════════════════════════
            TAB NAVIGATION
        ════════════════════════════════════════════ */}
        <div className="flex items-center gap-1 bg-white border border-[#E6DDD3] rounded-xl p-1 mb-6 w-fit shadow-sm flex-wrap">
          {[
            {
              key: "pending",
              icon: <Clock className="w-4 h-4" />,
              label: "Pending Sign-off",
              count: stats.awaitingCount,
              countStyle: "bg-amber-500/15 text-amber-600",
            },
            {
              key: "funded",
              icon: <CheckCircle className="w-4 h-4" />,
              label: "Funded History",
              count: stats.fundedCount,
              countStyle: "bg-emerald-500/15 text-emerald-600",
            },
            {
              key: "departments",
              icon: <Building2 className="w-4 h-4" />,
              label: "By Department",
              count: departmentBreakdown.length,
              countStyle: "bg-[#6B1420]/15 text-[#6B1420]",
            },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as "pending" | "funded" | "departments")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-display font-semibold text-sm transition-all cursor-pointer ${activeTab === tab.key
                ? "bg-[#6B1420] text-white shadow-sm"
                : "text-slate-700 hover:text-[#241012] hover:bg-[#F5F1EC]"
                }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">
                {tab.key === "pending" ? "Pending" : tab.key === "funded" ? "Funded" : "Dept."}
              </span>
              <span
                className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? "bg-white/20 text-white" : tab.countStyle
                  }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════
            TAB: PENDING SIGN-OFF
        ════════════════════════════════════════════ */}
        {activeTab === "pending" && (
          <div>
            {pendingFundingTickets.length === 0 ? (
              <div className="bg-white border border-[#E6DDD3] rounded-xl p-16 text-center shadow-sm">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <Inbox className="w-8 h-8 text-emerald-500" />
                </div>
                <h4 className="font-display font-bold text-lg text-[#241012]">All Clear!</h4>
                <p className="text-sm text-slate-600 mt-2 max-w-sm mx-auto font-sans leading-relaxed">
                  No job orders are pending budget release. All approved requests have been funded.
                </p>
              </div>
            ) : (
              <>
                {/* Summary bar */}
                <div className="flex items-center justify-between mb-5 px-1 flex-wrap gap-3">
                  <p className="text-sm font-sans text-slate-700">
                    <span className="font-semibold text-[#2B1210]">{pendingFundingTickets.length}</span>{" "}
                    job order{pendingFundingTickets.length !== 1 ? "s" : ""} requiring budget release
                  </p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-sm font-mono text-slate-700">
                      Subtotal:{" "}
                      <span className="text-[#6B1420] font-bold">
                        {formatPeso(sumJobOrderCosts(pendingFundingTickets))}
                      </span>
                    </p>
                    {pendingFundingTickets.length > 1 && (
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `Approve & fund all ${pendingFundingTickets.length} job orders using their current input values?`
                            )
                          ) {
                            pendingFundingTickets.forEach((t) => {
                              const appr = getAppr(t);
                              const est = getEst(t);
                              const apprNum = appr ? Number(appr) : 0;
                              if (apprNum > 0) {
                                onFinanceApprove(
                                  t.id,
                                  apprNum,
                                  est ? Number(est) : undefined,
                                  financeNotes[t.id] || ""
                                );
                              }
                            });
                          }
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-bold text-xs rounded-lg transition-colors shadow-sm cursor-pointer"
                      >
                        Approve &amp; Fund All ({pendingFundingTickets.length})
                      </button>
                    )}
                  </div>
                </div>

                {/* Ticket cards */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  {pendingFundingTickets.map((ticket) => {
                    const costDisp = getJobOrderCostDisplay(ticket);
                    const currentEst = getEst(ticket);
                    const currentAppr = getAppr(ticket);
                    const isFunding = fundingId === ticket.id;
                    const apprNum = currentAppr ? Number(currentAppr) : 0;
                    const hasValidAppr = apprNum > 0;

                    return (
                      <div
                        key={ticket.id}
                        className="bg-white border border-[#E6DDD3] rounded-xl shadow-sm hover:shadow-md transition-all"
                      >
                        {/* ── Clickable header ── */}
                        <div
                          className="p-5 pb-3 cursor-pointer"
                          onClick={() => setSelectedTicket(ticket)}
                        >
                          {/* ID + badges */}
                          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-[#241012] bg-[#F0EAE4] px-2 py-0.5 rounded">
                                {ticket.id}
                              </span>
                              {ticket.isEmergency && (
                                <span className="text-xs font-mono font-bold px-2 py-0.5 bg-red-500 text-white rounded-full">
                                  🚨 EMERGENCY
                                </span>
                              )}
                              <span className="text-xs font-mono px-2 py-0.5 bg-[#155C35]/10 text-[#155C35] border border-[#155C35]/20 rounded-full font-semibold">
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

                          <h4 className="font-display font-bold text-base text-[#241012]">
                            {ticket.office}
                          </h4>
                          <p className="text-sm text-slate-700 mt-1 line-clamp-2 font-sans leading-relaxed">
                            {ticket.description}
                          </p>

                          {/* Approval pipeline */}
                          <div className="flex items-center gap-1.5 mt-3 text-xs font-mono flex-wrap">
                            <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                                <CheckCircle className="w-3 h-3 text-white" />
                              </div>
                              PPO
                            </div>
                            <ChevronRight className="w-3 h-3 text-[#CCBDB4]" />
                            <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                                <CheckCircle className="w-3 h-3 text-white" />
                              </div>
                              President
                            </div>
                            <ChevronRight className="w-3 h-3 text-[#CCBDB4]" />
                            <div className="flex items-center gap-1.5 text-[#155C35] font-bold bg-[#155C35]/8 border border-[#155C35]/20 px-2.5 py-1 rounded-full">
                              <div className="w-2 h-2 rounded-full bg-[#155C35] animate-pulse" />
                              FINANCE (NOW)
                            </div>
                          </div>

                          {/* PPO notes */}
                          <div className="mt-3 p-3 rounded-lg bg-[#6B1420]/5 border border-[#6B1420]/10">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#6B1420] mb-1 font-mono uppercase tracking-wider">
                              <Sparkles className="w-3 h-3 shrink-0" />
                              PPO Verification Note
                            </div>
                            <p className="text-xs text-[#6A5A58] italic leading-relaxed">
                              "{ticket.notes || "Item validated by Physical Plant Officer."}"
                            </p>
                            <div className="mt-2 pt-2 border-t border-[#6B1420]/10 flex items-center justify-between text-xs font-mono text-slate-700 flex-wrap gap-1">
                              <span>
                                Priority:{" "}
                                <span className="font-bold text-[#2B1210]">{ticket.priorityScore} pts</span>
                              </span>
                              <span>
                                Staff:{" "}
                                <span className="font-bold text-[#2B1210]">{ticket.assignedStaff}</span>
                              </span>
                              <span
                                className={`font-bold border px-1.5 py-0.5 rounded text-[11px] ${costDisp.badgeClass}`}
                              >
                                {costDisp.label}: {costDisp.text}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* ── Cost form ── */}
                        <div
                          className="px-5 pt-4 pb-5 border-t border-[#F0EAE4] mt-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            {/* Cost Estimation */}
                            <div>
                              <label className="block text-xs font-mono font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                                Cost Estimation
                              </label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono font-bold text-[#6B1420] text-sm select-none pointer-events-none">
                                  ₱
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  className="w-full pl-7 pr-3 py-2.5 text-sm font-mono rounded-lg border border-[#E6DDD3] bg-[#FDFCFB] text-[#2B1210] focus:outline-none focus:ring-2 focus:ring-[#6B1420]/25 focus:border-[#6B1420] transition-all placeholder:text-[#C5B8B2]"
                                  value={currentEst}
                                  placeholder="0"
                                  onChange={(e) => {
                                    const val = parsePesoInput(e.target.value);
                                    setEstimatedCosts({ ...estimatedCosts, [ticket.id]: val });
                                    // Auto-mirror to approved if not yet manually set
                                    if (approvedAmounts[ticket.id] === undefined) {
                                      setApprovedAmounts({ ...approvedAmounts, [ticket.id]: val });
                                    }
                                  }}
                                />
                              </div>
                              {currentEst && Number(currentEst) > 0 && (
                                <p className="text-[11px] font-mono text-slate-600 mt-1">
                                  = {formatPeso(Number(currentEst))}
                                </p>
                              )}
                            </div>

                            {/* Approved Amount */}
                            <div>
                              <label className="block text-xs font-mono font-bold text-emerald-700 uppercase tracking-wide mb-1.5">
                                Approved Amount ★
                              </label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono font-bold text-emerald-600 text-sm select-none pointer-events-none">
                                  ₱
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  className={`w-full pl-7 pr-3 py-2.5 text-sm font-mono rounded-lg border bg-[#FDFCFB] text-[#2B1210] focus:outline-none focus:ring-2 transition-all placeholder:text-[#C5B8B2] ${hasValidAppr
                                    ? "border-emerald-400 focus:ring-emerald-400/25 focus:border-emerald-500"
                                    : "border-[#E6DDD3] focus:ring-[#6B1420]/25 focus:border-[#6B1420]"
                                    }`}
                                  value={currentAppr}
                                  placeholder="0"
                                  onChange={(e) =>
                                    setApprovedAmounts({
                                      ...approvedAmounts,
                                      [ticket.id]: parsePesoInput(e.target.value),
                                    })
                                  }
                                />
                              </div>
                              {currentAppr && Number(currentAppr) > 0 && (
                                <p className="text-[11px] font-mono text-emerald-600 mt-1 font-semibold">
                                  = {formatPeso(Number(currentAppr))}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Notes */}
                          <div className="mb-4">
                            <label className="block text-xs font-mono font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                              Finance Remarks (Optional)
                            </label>
                            <input
                              type="text"
                              className="w-full px-3 py-2.5 text-xs font-sans rounded-lg border border-[#E6DDD3] bg-[#FDFCFB] text-[#2B1210] focus:outline-none focus:ring-2 focus:ring-[#6B1420]/25 focus:border-[#6B1420] transition-all placeholder:text-[#C5B8B2]"
                              value={financeNotes[ticket.id] || ""}
                              placeholder="e.g. Charged to maintenance allocation FY2026…"
                              onChange={(e) =>
                                setFinanceNotes({ ...financeNotes, [ticket.id]: e.target.value })
                              }
                            />
                          </div>

                          {/* Validation hint */}
                          {!hasValidAppr && (
                            <p className="text-xs text-amber-600 flex items-center gap-1.5 mb-3 font-mono">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              Enter an approved amount in ₱ to enable funding.
                            </p>
                          )}

                          {/* Fund button */}
                          <button
                            onClick={() => handleFund(ticket)}
                            disabled={!hasValidAppr || isFunding}
                            className="w-full py-3 bg-[#155C35] hover:bg-[#0A3B21] active:scale-[0.99] text-white text-sm font-display font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isFunding ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Releasing Funds…
                              </>
                            ) : (
                              <>
                                <span className="font-bold text-base leading-none">₱</span>
                                Approve &amp; Release{" "}
                                {hasValidAppr && (
                                  <span className="font-mono">{formatPeso(apprNum)}</span>
                                )}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════
            TAB: FUNDED HISTORY
        ════════════════════════════════════════════ */}
        {activeTab === "funded" && (
          <div>
            {fundedTickets.length === 0 ? (
              <div className="bg-white border border-[#E6DDD3] rounded-xl p-16 text-center shadow-sm">
                <div className="w-16 h-16 rounded-full bg-[#F0EAE4] flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-slate-600" />
                </div>
                <h4 className="font-display font-bold text-lg text-[#241012]">No Funded Orders Yet</h4>
                <p className="text-sm text-slate-600 mt-2 max-w-sm mx-auto font-sans">
                  Funded job orders will appear here as a permanent record.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-[#E6DDD3] rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[#F0EAE4] flex items-center justify-between bg-[#FDFCFB]">
                  <h3 className="font-display font-semibold text-base text-[#241012] flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    Funded Job Orders
                  </h3>
                  <p className="text-sm font-mono text-slate-700">
                    Total Released:{" "}
                    <span className="text-[#155C35] font-bold">
                      {formatPeso(sumJobOrderCosts(fundedTickets))}
                    </span>
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F5F1EC] border-b border-[#E6DDD3] font-mono font-bold text-slate-700 uppercase tracking-wider">
                        <th className="px-5 py-3">Ticket</th>
                        <th className="px-5 py-3">Department</th>
                        <th className="px-5 py-3">Type</th>
                        <th className="px-5 py-3">Description</th>
                        <th className="px-5 py-3">Technician</th>
                        <th className="px-5 py-3">Remarks</th>
                        <th className="px-5 py-3 text-right">Est. Cost (₱)</th>
                        <th className="px-5 py-3 text-right">Approved (₱)</th>
                        <th className="px-5 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5F1EC] font-sans">
                      {fundedTickets.map((ticket) => (
                        <tr
                          key={ticket.id}
                          onClick={() => setSelectedTicket(ticket)}
                          className="hover:bg-[#F7F4F0] cursor-pointer transition-colors group"
                        >
                          <td className="px-5 py-4 font-mono font-bold text-[#241012] whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {ticket.id}
                              {ticket.emergencyBypassed && (
                                <span
                                  className="text-[10px] font-mono font-bold px-1.5 py-px bg-red-600 text-white rounded-full"
                                  title="PPO approved directly — your fund release was auto-recorded, not a manual decision"
                                >
                                  BYPASS
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 font-semibold text-[#2B1210]">{ticket.office}</td>
                          <td className="px-5 py-4">
                            <span className="font-mono text-[11px] px-2 py-0.5 bg-[#155C35]/10 text-[#155C35] border border-[#155C35]/20 rounded font-semibold">
                              {ticket.jobType}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-slate-700 max-w-[180px] truncate">
                            {ticket.description}
                          </td>
                          <td className="px-5 py-4 font-semibold text-[#2B1210] whitespace-nowrap">
                            {ticket.assignedStaff}
                          </td>
                          <td className="px-5 py-4 text-slate-700 max-w-[140px] truncate italic">
                            {ticket.financeNotes ? (
                              `"${ticket.financeNotes}"`
                            ) : (
                              <span className="text-[#DDD2C8] not-italic">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right font-mono text-slate-700">
                            {ticket.estimatedCost !== undefined
                              ? formatPeso(ticket.estimatedCost)
                              : "—"}
                          </td>
                          <td className="px-5 py-4 text-right font-mono font-bold text-[#155C35] whitespace-nowrap">
                            {ticket.approvedAmount !== undefined
                              ? formatPeso(ticket.approvedAmount)
                              : ticket.estimatedCost !== undefined
                                ? formatPeso(ticket.estimatedCost)
                                : "—"}
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase font-bold inline-block whitespace-nowrap ${ticket.status === "Completed"
                                ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                                : "bg-cyan-50 text-cyan-600 border border-cyan-200"
                                }`}
                            >
                              {ticket.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#F5F1EC] border-t-2 border-[#E6DDD3] font-mono font-bold">
                        <td className="px-5 py-3 text-slate-700 text-xs uppercase" colSpan={7}>
                          Grand Total Released
                        </td>
                        <td className="px-5 py-3 text-right text-[#155C35] text-sm">
                          {formatPeso(sumJobOrderCosts(fundedTickets))}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════
            TAB: BY DEPARTMENT
        ════════════════════════════════════════════ */}
        {activeTab === "departments" && (
          <div className="space-y-5">
            {departmentBreakdown.length === 0 ? (
              <div className="bg-white border border-[#E6DDD3] rounded-xl p-16 text-center shadow-sm">
                <div className="w-16 h-16 rounded-full bg-[#F0EAE4] flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-slate-600" />
                </div>
                <h4 className="font-display font-bold text-lg text-[#241012]">No Data Yet</h4>
                <p className="text-sm text-slate-600 mt-2 max-w-sm mx-auto font-sans">
                  Department breakdowns will appear once job orders are submitted.
                </p>
              </div>
            ) : (
              <>
                {/* Summary banner */}
                <div className="bg-gradient-to-r from-[#155C35] to-[#0D4A2A] rounded-xl px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between text-white shadow-sm gap-4">
                  <div>
                    <p className="text-[11px] font-mono text-white/50 uppercase tracking-wider mb-1">
                      All Departments — Registry Total
                    </p>
                    <h3 className="text-2xl font-mono font-bold">
                      {formatPeso(sumJobOrderCosts(tickets))}
                    </h3>
                  </div>
                  <div className="flex items-center gap-6 text-sm font-mono flex-wrap">
                    <div>
                      <p className="text-white/50 text-[11px] uppercase tracking-wider mb-1">
                        Total Funded
                      </p>
                      <p className="font-bold text-emerald-300">
                        {formatPeso(sumJobOrderCosts(fundedTickets))}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/50 text-[11px] uppercase tracking-wider mb-1">
                        Pending Release
                      </p>
                      <p className="font-bold text-yellow-300">
                        {formatPeso(sumJobOrderCosts(pendingFundingTickets))}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/50 text-[11px] uppercase tracking-wider mb-1">
                        Departments
                      </p>
                      <p className="font-bold">{departmentBreakdown.length}</p>
                    </div>
                  </div>
                </div>

                {/* Department table */}
                <div className="bg-white border border-[#E6DDD3] rounded-xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#F0EAE4] bg-[#FDFCFB]">
                    <h3 className="font-display font-semibold text-base text-[#241012] flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[#6B1420]" />
                      Department Budget Breakdown
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5 font-sans">
                      All amounts in Philippine Pesos (₱ PHP). Sorted by estimated total.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#F5F1EC] border-b border-[#E6DDD3] font-mono font-bold text-slate-700 uppercase tracking-wider">
                          <th className="px-5 py-3">#</th>
                          <th className="px-5 py-3">Department / Office</th>
                          <th className="px-5 py-3 text-center">Requests</th>
                          <th className="px-5 py-3 text-center">Funded</th>
                          <th className="px-5 py-3 text-center">Pending</th>
                          <th className="px-5 py-3 text-right">Est. Total (₱)</th>
                          <th className="px-5 py-3 text-right">Funded Total (₱)</th>
                          <th className="px-5 py-3 text-right">Balance (₱)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F5F1EC]">
                        {departmentBreakdown.map(({ dept, requests, fundedTotal, estimatedTotal }, i) => {
                          const dFunded = requests.filter((r) => r.financeApproved).length;
                          const dPending = requests.filter(
                            (r) => r.ppoApproved && r.schoolHeadApproved && !r.financeApproved
                          ).length;
                          const balance = estimatedTotal - fundedTotal;
                          const isClear = estimatedTotal > 0 && balance <= 0;

                          return (
                            <tr key={dept} className="hover:bg-[#F7F4F0] transition-colors">
                              <td className="px-5 py-4 font-mono text-slate-600">{i + 1}</td>
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg bg-[#6B1420]/10 flex items-center justify-center shrink-0">
                                    <Building2 className="w-3.5 h-3.5 text-[#6B1420]" />
                                  </div>
                                  <span className="font-display font-semibold text-sm text-[#241012]">
                                    {dept}
                                  </span>
                                </div>
                              </td>
                              <td className="px-5 py-4 text-center">
                                <span className="font-mono font-bold text-[#6B1420] bg-[#6B1420]/8 px-2.5 py-1 rounded-full">
                                  {requests.length}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-center">
                                {dFunded > 0 ? (
                                  <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                                    {dFunded}
                                  </span>
                                ) : (
                                  <span className="text-[#C5B8B2]">—</span>
                                )}
                              </td>
                              <td className="px-5 py-4 text-center">
                                {dPending > 0 ? (
                                  <span className="font-mono font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                                    {dPending}
                                  </span>
                                ) : (
                                  <span className="text-[#C5B8B2]">—</span>
                                )}
                              </td>
                              <td className="px-5 py-4 text-right font-mono font-bold text-[#4A322E]">
                                {estimatedTotal > 0 ? (
                                  formatPeso(estimatedTotal)
                                ) : (
                                  <span className="text-[#C5B8B2] font-normal">—</span>
                                )}
                              </td>
                              <td className="px-5 py-4 text-right font-mono font-bold text-[#155C35]">
                                {fundedTotal > 0 ? (
                                  formatPeso(fundedTotal)
                                ) : (
                                  <span className="text-[#C5B8B2] font-normal">—</span>
                                )}
                              </td>
                              <td className="px-5 py-4 text-right font-mono font-bold">
                                {isClear ? (
                                  <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                    FULLY FUNDED
                                  </span>
                                ) : balance > 0 ? (
                                  <span className="text-amber-600">{formatPeso(balance)}</span>
                                ) : (
                                  <span className="text-[#C5B8B2] font-normal">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-[#F5F1EC] border-t-2 border-[#E6DDD3] font-mono font-bold text-sm">
                          <td className="px-5 py-3 text-slate-700 uppercase text-xs" colSpan={5}>
                            Grand Total — {tickets.length} orders / {departmentBreakdown.length} depts
                          </td>
                          <td className="px-5 py-3 text-right text-[#4A322E]">
                            {formatPeso(
                              departmentBreakdown.reduce((s, d) => s + d.estimatedTotal, 0)
                            )}
                          </td>
                          <td className="px-5 py-3 text-right text-[#155C35]">
                            {formatPeso(
                              departmentBreakdown.reduce((s, d) => s + d.fundedTotal, 0)
                            )}
                          </td>
                          <td className="px-5 py-3 text-right text-amber-600">
                            {formatPeso(
                              departmentBreakdown.reduce(
                                (s, d) => s + Math.max(0, d.estimatedTotal - d.fundedTotal),
                                0
                              )
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Ticket Details Modal */}
      <TicketDetailsModal
        isOpen={selectedTicket !== null}
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onFinanceApprove={(id, approvedAmount, estimatedCost, financeNotes) => {
          onFinanceApprove(id, approvedAmount, estimatedCost, financeNotes);
          setSelectedTicket(null);
        }}
      />
    </div>
  );
};