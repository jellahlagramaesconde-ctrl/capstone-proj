import React, { useMemo, useState } from "react";
import { JobOrder } from "../types";
import { TicketDetailsModal } from "./TicketDetailsModal";
import { formatPeso, sumJobOrderCosts, getJobOrderCost } from "../priceUtils";
import {
  ArrowLeft,
  Building2,
  TrendingUp,
  CheckCircle,
  Clock,
  Search,
  ChevronRight,
  ChevronDown,
  BarChart3,
  FileText,
  Sparkles,
  ArrowUpDown,
  X,
} from "lucide-react";

interface FinanceTotalValuePageProps {
  tickets: JobOrder[];
  onBack: () => void;
  onFinanceApprove?: (
    id: string,
    approvedAmount?: number,
    estimatedCost?: number,
    financeNotes?: string
  ) => void;
}

type SortField = "dept" | "requests" | "estimated" | "funded" | "balance";
type SortDir = "asc" | "desc";

function statusBadge(status: string) {
  switch (status) {
    case "Completed":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    case "In Progress":
      return "bg-cyan-50 text-cyan-700 border border-cyan-200";
    default:
      return "bg-amber-50 text-amber-700 border border-amber-200";
  }
}

function approvalStage(ticket: JobOrder): { label: string; color: string } {
  if (ticket.financeApproved)
    return { label: "Finance Approved", color: "text-emerald-600" };
  if (ticket.schoolHeadApproved && ticket.ppoApproved)
    return { label: "Awaiting Finance", color: "text-[#155C35] font-bold" };
  if (ticket.ppoApproved)
    return { label: "Awaiting President", color: "text-amber-600" };
  return { label: "Awaiting PPO", color: "text-slate-600" };
}

export const FinanceTotalValuePage: React.FC<FinanceTotalValuePageProps> = ({
  tickets,
  onBack,
  onFinanceApprove,
}) => {
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("estimated");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedTicket, setSelectedTicket] = useState<JobOrder | null>(null);

  // ── Department breakdown ──────────────────────────────────────────
  const departmentBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        requests: JobOrder[];
        fundedTotal: number;
        estimatedTotal: number;
        allTotal: number;
      }
    >();
    tickets.forEach((t) => {
      const dept = t.office || "Unknown";
      if (!map.has(dept))
        map.set(dept, {
          requests: [],
          fundedTotal: 0,
          estimatedTotal: 0,
          allTotal: 0,
        });
      const entry = map.get(dept)!;
      entry.requests.push(t);
      if (t.financeApproved) {
        entry.fundedTotal += t.approvedAmount ?? t.estimatedCost ?? 0;
      }
      if (t.estimatedCost !== undefined) {
        entry.estimatedTotal += t.estimatedCost;
      }
      entry.allTotal += getJobOrderCost(t) ?? 0;
    });
    return Array.from(map.entries()).map(([dept, data]) => ({
      dept,
      ...data,
      pendingCount: data.requests.filter(
        (r) => r.ppoApproved && r.schoolHeadApproved && !r.financeApproved
      ).length,
      fundedCount: data.requests.filter((r) => r.financeApproved).length,
      balance: Math.max(0, data.estimatedTotal - data.fundedTotal),
    }));
  }, [tickets]);

  // ── Grand totals ──────────────────────────────────────────────────
  const grandTotals = useMemo(() => {
    const fundedTickets = tickets.filter((t) => t.financeApproved);
    const pendingTickets = tickets.filter(
      (t) => t.ppoApproved && t.schoolHeadApproved && !t.financeApproved
    );
    return {
      allDepts: departmentBreakdown.length,
      allRequests: tickets.length,
      estimatedTotal: departmentBreakdown.reduce(
        (s, d) => s + d.estimatedTotal,
        0
      ),
      fundedTotal: sumJobOrderCosts(fundedTickets),
      pendingEstimate: sumJobOrderCosts(pendingTickets),
      totalValue: sumJobOrderCosts(tickets),
    };
  }, [tickets, departmentBreakdown]);

  // ── Sorting ───────────────────────────────────────────────────────
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sortedDepts = useMemo(() => {
    const filtered = departmentBreakdown.filter((d) =>
      d.dept.toLowerCase().includes(search.toLowerCase())
    );
    return [...filtered].sort((a, b) => {
      let diff = 0;
      switch (sortField) {
        case "dept":
          diff = a.dept.localeCompare(b.dept);
          break;
        case "requests":
          diff = a.requests.length - b.requests.length;
          break;
        case "estimated":
          diff = a.estimatedTotal - b.estimatedTotal;
          break;
        case "funded":
          diff = a.fundedTotal - b.fundedTotal;
          break;
        case "balance":
          diff = a.balance - b.balance;
          break;
      }
      return sortDir === "asc" ? diff : -diff;
    });
  }, [departmentBreakdown, search, sortField, sortDir]);

  // ── Selected dept tickets ─────────────────────────────────────────
  const selectedDeptData = useMemo(() => {
    if (!selectedDept) return null;
    return departmentBreakdown.find((d) => d.dept === selectedDept) ?? null;
  }, [selectedDept, departmentBreakdown]);

  const SortBtn: React.FC<{ field: SortField; label: string; className?: string }> = ({
    field,
    label,
    className = "",
  }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center gap-1 group cursor-pointer hover:text-[#241012] transition-colors ${sortField === field ? "text-[#6B1420]" : "text-slate-700"
        } ${className}`}
    >
      {label}
      <ArrowUpDown
        className={`w-3 h-3 transition-opacity ${sortField === field ? "opacity-100" : "opacity-30 group-hover:opacity-70"
          }`}
      />
    </button>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-[#F7F4F0] text-[#2B1210] animate-fade-in">

      {/* ════════ HEADER BANNER ════════ */}
      <div className="bg-gradient-to-br from-[#0A3B21] via-[#155C35] to-[#0D4A2A] text-white px-6 sm:px-10 py-8 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full border border-white/8" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full border border-white/8" />
          <div className="absolute top-4 right-1/3 w-1.5 h-1.5 rounded-full bg-white/15" />
          <div className="absolute bottom-6 right-1/5 w-2 h-2 rounded-full bg-emerald-300/20" />
        </div>

        <div className="relative">
          {/* Back + breadcrumb */}
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-xs font-mono mb-5 group cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
            Back to Finance Dashboard
          </button>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-[11px] font-mono tracking-[0.25em] text-white/45 uppercase mb-1">
                  Finance — Total Value Report
                </p>
                <h2 className="text-xl sm:text-2xl font-display font-bold text-white leading-tight">
                  Department Budget Overview
                </h2>
                <p className="text-xs text-white/40 font-sans mt-1.5 max-w-lg leading-relaxed">
                  Complete breakdown of all department requests, estimated costs,
                  funded amounts, and outstanding balances. All amounts in ₱ PHP.
                </p>
              </div>
            </div>

            {/* Grand total pill */}
            <div className="flex items-center gap-3 flex-wrap shrink-0">
              <div className="bg-white/12 border border-white/20 rounded-xl px-5 py-3 text-center backdrop-blur-sm">
                <p className="text-[11px] font-mono text-white/50 uppercase tracking-wider mb-1">
                  Grand Total Value
                </p>
                <p className="text-2xl font-mono font-bold text-white">
                  {formatPeso(grandTotals.totalValue)}
                </p>
              </div>
              <div className="bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-center">
                <p className="text-[11px] font-mono text-white/50 uppercase tracking-wider mb-1">
                  Departments
                </p>
                <p className="text-xl font-mono font-bold text-white">
                  {grandTotals.allDepts}
                </p>
              </div>
              <div className="bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-center">
                <p className="text-[11px] font-mono text-white/50 uppercase tracking-wider mb-1">
                  Total Requests
                </p>
                <p className="text-xl font-mono font-bold text-white">
                  {grandTotals.allRequests}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-8 space-y-6">

        {/* ════════ GRAND TOTAL SUMMARY CARDS ════════ */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-[#E6DDD3] rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-mono tracking-wider text-slate-600 uppercase font-semibold">
                Total Estimated
              </p>
              <p className="text-xl font-mono font-bold text-amber-600 mt-0.5">
                {formatPeso(grandTotals.estimatedTotal)}
              </p>
              <p className="text-[11px] text-slate-600 font-sans mt-0.5">
                All PPO-estimated costs
              </p>
            </div>
          </div>

          <div className="bg-white border border-[#E6DDD3] rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-mono tracking-wider text-slate-600 uppercase font-semibold">
                Total Funded
              </p>
              <p className="text-xl font-mono font-bold text-emerald-600 mt-0.5">
                {formatPeso(grandTotals.fundedTotal)}
              </p>
              <p className="text-[11px] text-slate-600 font-sans mt-0.5">
                Released by Finance
              </p>
            </div>
          </div>

          <div className="bg-white border border-[#E6DDD3] rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#6B1420]/10 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-[#6B1420]" />
            </div>
            <div>
              <p className="text-xs font-mono tracking-wider text-slate-600 uppercase font-semibold">
                Pending Release
              </p>
              <p className="text-xl font-mono font-bold text-[#6B1420] mt-0.5">
                {formatPeso(grandTotals.pendingEstimate)}
              </p>
              <p className="text-[11px] text-slate-600 font-sans mt-0.5">
                Awaiting Finance sign-off
              </p>
            </div>
          </div>
        </section>

        {/* ════════ DEPARTMENT LEADERBOARD ════════ */}
        <section className="bg-white border border-[#E6DDD3] rounded-xl shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="px-6 py-4 border-b border-[#F0EAE4] bg-[#FDFCFB] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-semibold text-base text-[#241012] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#6B1420]" />
                Department Budget Leaderboard
              </h3>
              <p className="text-xs text-slate-600 mt-0.5 font-sans">
                Click any department row to view its individual requests below.
              </p>
            </div>
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search department…"
                className="w-full pl-8 pr-3 py-2 text-xs font-sans rounded-lg border border-[#E6DDD3] bg-[#FDFCFB] text-[#2B1210] focus:outline-none focus:ring-2 focus:ring-[#155C35]/25 focus:border-[#155C35] transition-all placeholder:text-[#C5B8B2]"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-[#6B1420] cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F5F1EC] border-b border-[#E6DDD3] font-mono font-bold text-slate-700 uppercase tracking-wider">
                  <th className="px-5 py-3 w-8">#</th>
                  <th className="px-5 py-3">
                    <SortBtn field="dept" label="Department / Office" />
                  </th>
                  <th className="px-5 py-3 text-center">
                    <SortBtn field="requests" label="Requests" className="justify-center" />
                  </th>
                  <th className="px-5 py-3 text-center">Funded</th>
                  <th className="px-5 py-3 text-center">Pending</th>
                  <th className="px-5 py-3 text-right">
                    <SortBtn field="estimated" label="Est. Total (₱)" className="justify-end" />
                  </th>
                  <th className="px-5 py-3 text-right">
                    <SortBtn field="funded" label="Funded (₱)" className="justify-end" />
                  </th>
                  <th className="px-5 py-3 text-right">
                    <SortBtn field="balance" label="Balance (₱)" className="justify-end" />
                  </th>
                  <th className="px-5 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F1EC]">
                {sortedDepts.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-5 py-12 text-center text-slate-600 font-sans"
                    >
                      {search
                        ? `No departments matching "${search}"`
                        : "No department data available."}
                    </td>
                  </tr>
                )}
                {sortedDepts.map(
                  (
                    {
                      dept,
                      requests,
                      fundedTotal,
                      estimatedTotal,
                      balance,
                      fundedCount,
                      pendingCount,
                    },
                    i
                  ) => {
                    const isSelected = selectedDept === dept;
                    const isFullyFunded =
                      estimatedTotal > 0 && balance <= 0 && fundedTotal > 0;
                    return (
                      <tr
                        key={dept}
                        onClick={() =>
                          setSelectedDept(isSelected ? null : dept)
                        }
                        className={`cursor-pointer transition-all group ${isSelected
                            ? "bg-[#0A3B21]/5 border-l-4 border-l-[#155C35]"
                            : "hover:bg-[#F7F4F0] border-l-4 border-l-transparent"
                          }`}
                      >
                        <td className="px-5 py-4 font-mono text-slate-600">
                          {i + 1}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isSelected
                                  ? "bg-[#155C35] text-white"
                                  : "bg-[#6B1420]/10 text-[#6B1420] group-hover:bg-[#6B1420]/15"
                                }`}
                            >
                              <Building2 className="w-3.5 h-3.5" />
                            </div>
                            <span
                              className={`font-display font-semibold text-sm transition-colors ${isSelected
                                  ? "text-[#155C35]"
                                  : "text-[#241012]"
                                }`}
                            >
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
                          {fundedCount > 0 ? (
                            <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                              {fundedCount}
                            </span>
                          ) : (
                            <span className="text-[#C5B8B2]">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          {pendingCount > 0 ? (
                            <span className="font-mono font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                              {pendingCount}
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
                          {isFullyFunded ? (
                            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              FULLY FUNDED
                            </span>
                          ) : balance > 0 ? (
                            <span className="text-amber-600">
                              {formatPeso(balance)}
                            </span>
                          ) : (
                            <span className="text-[#C5B8B2] font-normal">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          {isSelected ? (
                            <ChevronDown className="w-4 h-4 text-[#155C35] mx-auto" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-[#C5B8B2] group-hover:text-[#6B1420] mx-auto transition-colors" />
                          )}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
              {/* Grand total footer */}
              <tfoot>
                <tr className="bg-[#F5F1EC] border-t-2 border-[#E6DDD3] font-mono font-bold text-sm">
                  <td
                    className="px-5 py-3 text-slate-700 text-xs uppercase"
                    colSpan={5}
                  >
                    Grand Total — {tickets.length} requests / {departmentBreakdown.length} dept
                    {departmentBreakdown.length !== 1 ? "s" : ""}
                  </td>
                  <td className="px-5 py-3 text-right text-[#4A322E] text-sm">
                    {formatPeso(grandTotals.estimatedTotal)}
                  </td>
                  <td className="px-5 py-3 text-right text-[#155C35] text-sm">
                    {formatPeso(grandTotals.fundedTotal)}
                  </td>
                  <td className="px-5 py-3 text-right text-amber-600 text-sm">
                    {formatPeso(
                      departmentBreakdown.reduce(
                        (s, d) => s + d.balance,
                        0
                      )
                    )}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* ════════ PER-DEPARTMENT DETAIL PANEL ════════ */}
        {selectedDeptData && (
          <section
            key={selectedDept}
            className="bg-white border-2 border-[#155C35]/30 rounded-xl shadow-md overflow-hidden animate-fade-in"
          >
            {/* Dept detail header */}
            <div className="bg-gradient-to-r from-[#0A3B21] to-[#155C35] px-6 py-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[11px] font-mono text-white/50 uppercase tracking-wider">
                      Department Detail
                    </p>
                    <h3 className="font-display font-bold text-white text-lg leading-tight">
                      {selectedDeptData.dept}
                    </h3>
                  </div>
                </div>

                {/* Dept totals */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="bg-white/10 border border-white/15 rounded-lg px-4 py-2 text-center">
                    <p className="text-[11px] font-mono text-white/50 uppercase mb-0.5">
                      Est. Total
                    </p>
                    <p className="font-mono font-bold text-amber-300 text-sm">
                      {selectedDeptData.estimatedTotal > 0
                        ? formatPeso(selectedDeptData.estimatedTotal)
                        : "—"}
                    </p>
                  </div>
                  <div className="bg-white/10 border border-white/15 rounded-lg px-4 py-2 text-center">
                    <p className="text-[11px] font-mono text-white/50 uppercase mb-0.5">
                      Funded
                    </p>
                    <p className="font-mono font-bold text-emerald-300 text-sm">
                      {selectedDeptData.fundedTotal > 0
                        ? formatPeso(selectedDeptData.fundedTotal)
                        : "—"}
                    </p>
                  </div>
                  <div className="bg-white/10 border border-white/15 rounded-lg px-4 py-2 text-center">
                    <p className="text-[11px] font-mono text-white/50 uppercase mb-0.5">
                      Balance
                    </p>
                    <p
                      className={`font-mono font-bold text-sm ${selectedDeptData.balance <= 0
                          ? "text-emerald-300"
                          : "text-yellow-300"
                        }`}
                    >
                      {selectedDeptData.balance > 0
                        ? formatPeso(selectedDeptData.balance)
                        : "CLEAR"}
                    </p>
                  </div>
                  <div className="bg-white/10 border border-white/15 rounded-lg px-4 py-2 text-center">
                    <p className="text-[11px] font-mono text-white/50 uppercase mb-0.5">
                      Requests
                    </p>
                    <p className="font-mono font-bold text-white text-sm">
                      {selectedDeptData.requests.length}
                    </p>
                  </div>

                  <button
                    onClick={() => setSelectedDept(null)}
                    className="ml-2 w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white/60 hover:text-white transition-all cursor-pointer shrink-0"
                    title="Close detail"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Hint */}
            <div className="px-6 py-3 bg-[#155C35]/5 border-b border-[#155C35]/15 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#155C35] shrink-0" />
              <p className="text-xs text-[#155C35] font-sans font-medium">
                Showing all {selectedDeptData.requests.length} job order
                {selectedDeptData.requests.length !== 1 ? "s" : ""} submitted by{" "}
                <strong>{selectedDeptData.dept}</strong>. Click a row to view
                full ticket details.
              </p>
            </div>

            {/* Ticket detail table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F5F1EC] border-b border-[#E6DDD3] font-mono font-bold text-slate-700 uppercase tracking-wider">
                    <th className="px-5 py-3">Ticket ID</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Description</th>
                    <th className="px-5 py-3">Technician</th>
                    <th className="px-5 py-3">Approval Stage</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Est. Cost (₱)</th>
                    <th className="px-5 py-3 text-right">Funded (₱)</th>
                    <th className="px-5 py-3 text-center">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F1EC] font-sans">
                  {selectedDeptData.requests
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(b.dateSubmitted).getTime() -
                        new Date(a.dateSubmitted).getTime()
                    )
                    .map((ticket) => {
                      const stage = approvalStage(ticket);
                      const funded =
                        ticket.approvedAmount ?? ticket.estimatedCost;
                      return (
                        <tr
                          key={ticket.id}
                          onClick={() => setSelectedTicket(ticket)}
                          className="hover:bg-[#F7F4F0] cursor-pointer transition-colors group"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-[#241012] bg-[#F0EAE4] px-2 py-0.5 rounded">
                                {ticket.id}
                              </span>
                              {ticket.isEmergency && (
                                <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 bg-red-500 text-white rounded-full">
                                  🚨
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="font-mono text-[11px] px-2 py-0.5 bg-[#155C35]/10 text-[#155C35] border border-[#155C35]/20 rounded font-semibold">
                              {ticket.jobType}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-[#4A322E] max-w-[200px] truncate">
                            {ticket.description}
                          </td>
                          <td className="px-5 py-4 font-semibold text-[#2B1210] whitespace-nowrap">
                            {ticket.assignedStaff || (
                              <span className="text-[#C5B8B2] font-normal italic">
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`font-mono text-[11px] font-bold ${stage.color}`}>
                              {stage.label}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase font-bold inline-block whitespace-nowrap ${statusBadge(ticket.status)}`}
                            >
                              {ticket.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right font-mono text-slate-700">
                            {ticket.estimatedCost !== undefined ? (
                              formatPeso(ticket.estimatedCost)
                            ) : (
                              <span className="text-[#C5B8B2] italic text-[11px]">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right font-mono font-bold">
                            {ticket.financeApproved && funded !== undefined ? (
                              <span className="text-[#155C35]">
                                {formatPeso(funded)}
                              </span>
                            ) : ticket.ppoApproved &&
                              ticket.schoolHeadApproved ? (
                              <span className="text-amber-500 text-[11px] font-mono">
                                Awaiting
                              </span>
                            ) : (
                              <span className="text-[#C5B8B2] font-normal">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-center text-slate-600 whitespace-nowrap">
                            {ticket.dateSubmitted
                              ? new Date(ticket.dateSubmitted).toLocaleDateString(
                                "en-PH",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                }
                              )
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
                {/* Per-dept footer total */}
                <tfoot>
                  <tr className="bg-[#0A3B21]/5 border-t-2 border-[#155C35]/20 font-mono font-bold">
                    <td
                      className="px-5 py-3 text-[#155C35] text-xs uppercase tracking-wider"
                      colSpan={6}
                    >
                      {selectedDeptData.dept} — Overall Total
                    </td>
                    <td className="px-5 py-3 text-right text-[#4A322E] text-sm">
                      {selectedDeptData.estimatedTotal > 0
                        ? formatPeso(selectedDeptData.estimatedTotal)
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-right text-[#155C35] text-sm">
                      {selectedDeptData.fundedTotal > 0
                        ? formatPeso(selectedDeptData.fundedTotal)
                        : "—"}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Finance notes if any funded tickets have notes */}
            {selectedDeptData.requests.some((r) => r.financeNotes) && (
              <div className="px-6 py-4 bg-[#FDFCFB] border-t border-[#F0EAE4]">
                <p className="text-[11px] font-mono text-slate-700 uppercase tracking-wider mb-3 font-bold">
                  Finance Remarks
                </p>
                <div className="space-y-2">
                  {selectedDeptData.requests
                    .filter((r) => r.financeNotes)
                    .map((r) => (
                      <div
                        key={r.id}
                        className="flex items-start gap-2 text-xs font-sans"
                      >
                        <span className="font-mono font-bold text-[#241012] bg-[#F0EAE4] px-1.5 py-0.5 rounded shrink-0">
                          {r.id}
                        </span>
                        <span className="text-[#6A5A58] italic">
                          "{r.financeNotes}"
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Empty state for no selection */}
        {!selectedDept && sortedDepts.length > 0 && (
          <div className="border-2 border-dashed border-[#E6DDD3] rounded-xl p-10 text-center">
            <div className="w-12 h-12 rounded-full bg-[#155C35]/10 flex items-center justify-center mx-auto mb-3">
              <FileText className="w-6 h-6 text-[#155C35]" />
            </div>
            <p className="font-display font-semibold text-[#241012] text-sm">
              Select a Department
            </p>
            <p className="text-xs text-slate-600 mt-1.5 font-sans max-w-xs mx-auto leading-relaxed">
              Click on any department row in the table above to view its full
              list of job order requests and pricing breakdown.
            </p>
          </div>
        )}

      </div>

      {/* Ticket Details Modal */}
      <TicketDetailsModal
        isOpen={selectedTicket !== null}
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onFinanceApprove={
          onFinanceApprove
            ? (id, approvedAmount, estimatedCost, financeNotes) => {
              onFinanceApprove(id, approvedAmount, estimatedCost, financeNotes);
              setSelectedTicket(null);
            }
            : undefined
        }
      />
    </div>
  );
};