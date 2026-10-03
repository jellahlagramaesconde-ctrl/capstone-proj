import React, { useState, useEffect } from "react";
import { JobOrder, AuditLogEntry } from "../types";
import { formatPeso } from "../priceUtils";
import {
  FileSpreadsheet,
  Download,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  ShieldCheck,
  Search,
  Filter
} from "lucide-react";

interface ReportDashboardProps {
  tickets: JobOrder[];
  authedFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export const ReportDashboard: React.FC<ReportDashboardProps> = ({ tickets, authedFetch }) => {
  const [activeCell, setActiveCell] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const [editValue, setEditValue] = useState("");
  const [copiedTable, setCopiedTable] = useState(false);

  // Audit log state
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("All");

  // Local grid values based on job orders
  const [gridData, setGridData] = useState<string[][]>([]);

  // Row and Column metadata for simulated Excel grid
  const columns = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  const columnHeaders = [
    "Ticket ID",
    "Office Location",
    "Request Description",
    "Job Type",
    "Safety Risk",
    "Urgency",
    "Priority Score",
    "Assigned Staff",
    "Approved Cost",
    "Status"
  ];

  // Load ticket data into Excel sheet grid
  useEffect(() => {
    if (tickets && tickets.length > 0) {
      const formatted = tickets.map((t) => [
        t.id,
        t.office,
        t.description,
        t.jobType,
        String(t.safetyRisk),
        String(t.urgency),
        String(t.priorityScore),
        t.assignedStaff,
        t.approvedAmount !== undefined && t.approvedAmount !== null
          ? formatPeso(t.approvedAmount)
          : (t.requiresFunds === false ? "₱0 (No Funds Needed)" : (t.estimatedCost != null ? `Est. ${formatPeso(t.estimatedCost)}` : "Awaiting Finance")),
        t.status
      ]);
      setGridData(formatted);
    }
  }, [tickets]);

  // Update formula/input bar when active cell changes
  useEffect(() => {
    if (gridData.length > 0 && activeCell.row >= 0 && activeCell.row < gridData.length) {
      setEditValue(gridData[activeCell.row][activeCell.col] || "");
    }
  }, [activeCell, gridData]);

  const handleCellClick = (row: number, col: number) => {
    setActiveCell({ row, col });
  };

  const handleCellValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEditValue(val);
    if (gridData.length > 0) {
      const updated = [...gridData];
      updated[activeCell.row][activeCell.col] = val;
      setGridData(updated);
    }
  };

  // Export spreadsheet data to CSV
  const handleExportCSV = () => {
    if (gridData.length === 0) return;
    const csvContent = [
      columnHeaders.join(","),
      ...gridData.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `COSCA_Facilities_Ready_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyTable = () => {
    if (gridData.length === 0) return;
    const text = [
      columnHeaders.join("\t"),
      ...gridData.map(row => row.join("\t"))
    ].join("\n");
    navigator.clipboard.writeText(text);
    setCopiedTable(true);
    setTimeout(() => setCopiedTable(false), 2000);
  };

  // Fetch audit log
  const fetchAuditLog = async () => {
    setAuditLoading(true);
    setAuditError("");
    try {
      const res = await authedFetch("/api/audit-log");
      if (!res.ok) throw new Error("Failed to load audit log.");
      const data: AuditLogEntry[] = await res.json();
      setAuditLog(data);
    } catch (err: any) {
      setAuditError(err.message || "Could not load audit log.");
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => { fetchAuditLog(); }, []);

  // Action badge styling
  const actionMeta: Record<string, { label: string; color: string }> = {
    ppo_approve:          { label: "PPO Approved",        color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    no_fund_dispatch:     { label: "No-Fund Dispatch",    color: "bg-cyan-100 text-cyan-800 border-cyan-200" },
    president_approve:    { label: "President Endorsed",  color: "bg-blue-100 text-blue-800 border-blue-200" },
    ppo_bypass_president: { label: "PPO Bypass",          color: "bg-amber-100 text-amber-800 border-amber-200" },
    finance_approve:      { label: "Finance Approved",    color: "bg-violet-100 text-violet-800 border-violet-200" },
    staff_completed:      { label: "Completed",           color: "bg-slate-100 text-slate-700 border-slate-200" },
    DEADLINE_EXTENDED:    { label: "Deadline Extended",   color: "bg-orange-100 text-orange-800 border-orange-200" },
  };

  const auditActions = ["All", ...Object.keys(actionMeta)];

  const filteredAudit = auditLog.filter((e) => {
    const matchesAction = auditActionFilter === "All" || e.action === auditActionFilter;
    const q = auditSearch.toLowerCase();
    const matchesSearch = !q ||
      e.jobOrderId.toLowerCase().includes(q) ||
      (e.actorName ?? "").toLowerCase().includes(q) ||
      (e.reason ?? "").toLowerCase().includes(q);
    return matchesAction && matchesSearch;
  });

  const handleExportAuditCSV = () => {
    if (filteredAudit.length === 0) return;
    const headers = ["ID", "Job Order", "Action", "Actor", "Amount (PHP)", "Reason", "Previous Value", "New Value", "Timestamp"];
    const rows = filteredAudit.map((e) => [
      e.id,
      e.jobOrderId,
      e.action,
      e.actorName ?? "System",
      e.amountPhp != null ? e.amountPhp : "",
      e.reason ?? "",
      e.previousValue ?? "",
      e.newValue ?? "",
      new Date(e.createdAt).toLocaleString(),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `COSCA_Approval_Audit_Log_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F5F1EC] overflow-y-auto" id="report-dashboard">
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8">

        {/* SECTION 1: INTERACTIVE EXCEL LAYOUT ENGINE */}
        <div className="bg-white border border-[#E6DDD3] rounded-xl shadow-sm overflow-hidden flex flex-col">
          {/* Excel Menu Bar */}
          <div className="px-4 py-3 bg-[#F5F1EC] border-b border-[#E6DDD3] flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="px-2 py-1 bg-[#6B1420] text-white rounded font-mono text-xs font-bold shadow-sm">
                XLSX
              </div>
              <span className="font-sans font-semibold text-sm text-[#2B1210]">
                COSCA_Facilities_Ready_Report.xlsx
              </span>
              <span className="px-1.5 py-0.5 bg-[#E6DDD3] text-slate-700 rounded text-xs font-mono">
                Read-Only cells mapped to Database
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={handleCopyTable}
                className="flex items-center gap-1.5 py-2 px-3.5 bg-white border border-[#E6DDD3] rounded-lg text-xs font-mono text-[#4A322E] hover:bg-[#F0EAE4] transition-colors cursor-pointer shadow-xs"
              >
                {copiedTable ? <Check className="w-3.5 h-3.5 text-soft-green" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedTable ? "Copied!" : "Copy Grid Text"}
              </button>

              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 py-2 px-3.5 bg-[#6B1420] text-white font-mono text-xs font-bold rounded-lg hover:bg-[#6B1420]/90 transition-all cursor-pointer shadow-md"
              >
                <Download className="w-3.5 h-3.5" />
                Export to Excel (CSV)
              </button>
            </div>
          </div>

          {/* Excel Formula / Edit Bar */}
          <div className="flex items-center bg-white border-b border-[#E6DDD3] p-1.5 gap-2 text-xs font-mono">
            <div className="bg-[#F0EAE4] border border-[#E6DDD3] px-3 py-1 text-center font-bold text-[#6B1420] min-w-[50px] rounded shadow-inner">
              {columns[activeCell.col]}{activeCell.row + 1}
            </div>
            <div className="text-slate-600 italic px-1 font-serif select-none text-sm font-bold">
              fx
            </div>
            <input
              type="text"
              value={editValue}
              onChange={handleCellValueChange}
              className="flex-1 bg-[#F5F1EC] border border-[#E6DDD3] rounded px-3 py-1 text-[#2B1210] focus:outline-none focus:border-[#6B1420] transition-colors font-sans shadow-inner"
              placeholder="Edit selected cell value directly. Edits persist locally in-grid."
            />
          </div>

          {/* Main Spreadsheet Grid viewport */}
          <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
            <table className="min-w-full border-collapse border-[#E6DDD3] text-xs font-sans select-none">
              <thead className="bg-[#F0EAE4] sticky top-0 z-10">
                <tr>
                  <th className="w-10 bg-[#E6DDD3] border border-[#DDD2C8] text-center text-sm text-slate-700 font-mono py-1"></th>
                  {columns.map((col, idx) => (
                    <th key={idx} className="bg-[#E6DDD3] border border-[#DDD2C8] text-center font-mono py-1 text-slate-600 min-w-[150px]">
                      {col}
                    </th>
                  ))}
                </tr>
                <tr className="bg-[#F0EAE4]/80 text-left">
                  <th className="bg-[#E6DDD3] border border-[#DDD2C8] text-center text-sm text-slate-600 font-mono py-1.5"></th>
                  {columnHeaders.map((header, idx) => (
                    <th key={idx} className="border border-[#DDD2C8] px-3 py-1.5 font-bold uppercase text-xs tracking-wider text-slate-700">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white">
                {gridData.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-[#F5F1EC]/50 transition-colors">
                    <td className="bg-[#E6DDD3] border border-[#DDD2C8] text-center font-mono text-sm text-slate-700 font-bold select-none h-9">
                      {rIdx + 1}
                    </td>
                    {row.map((cell, cIdx) => {
                      const isActive = activeCell.row === rIdx && activeCell.col === cIdx;
                      let badgeClass = "";
                      if (cIdx === 9) {
                        badgeClass =
                          cell === "Completed" ? "bg-soft-green/10 text-soft-green font-bold px-2 py-0.5 rounded border border-soft-green/20" :
                          cell === "In Progress" ? "bg-cyan-accent/10 text-cyan-accent font-bold px-2 py-0.5 rounded border border-cyan-accent/20" :
                          "bg-[#6B1420]/10 text-[#6B1420] font-bold px-2 py-0.5 rounded border border-[#6B1420]/20";
                      }
                      return (
                        <td
                          key={cIdx}
                          onClick={() => handleCellClick(rIdx, cIdx)}
                          className={`border border-[#E6DDD3] px-3 py-2 cursor-pointer relative font-sans truncate max-w-[220px] ${isActive
                            ? "outline-2 outline-[#6B1420] outline-offset-[-2px] bg-[#6B1420]/5"
                            : "text-[#4A322E]"
                          }`}
                        >
                          {cIdx === 9 ? (
                            <span className={badgeClass}>{cell}</span>
                          ) : cIdx === 8 ? (
                            <span className={`font-mono text-xs ${
                              cell.startsWith("₱") && !cell.includes("No Funds")
                                ? "font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                                : "text-slate-500 font-normal italic"
                            }`}>
                              {cell}
                            </span>
                          ) : cIdx === 6 ? (
                            <span className="font-mono font-bold text-[#2B1210]">{cell}</span>
                          ) : (
                            cell
                          )}
                          {isActive && (
                            <div className="absolute right-0 bottom-0 w-1.5 h-1.5 bg-[#6B1420] pointer-events-none" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sheet tabs footer */}
          <div className="bg-[#F0EAE4] border-t border-[#E6DDD3] px-4 py-2 flex items-center justify-between text-sm font-sans">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-600 select-none">Sheets:</span>
              <div className="flex bg-white border border-[#E6DDD3] px-3.5 py-1 text-[#6B1420] font-bold rounded shadow-xs relative select-none cursor-default">
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#6B1420] mr-1.5 inline" />
                COSCA_Tickets_Report
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#6B1420]" />
              </div>
            </div>
            <div className="font-mono text-slate-600 text-xs flex flex-wrap items-center gap-3">
              <span>Ready</span>
              <span>•</span>
              <span>Total Approved: <strong className="text-emerald-700 font-bold">{formatPeso(tickets.reduce((acc, t) => acc + (t.approvedAmount ?? 0), 0))}</strong></span>
              <span>•</span>
              <span>Total Priority Sum = {tickets.reduce((acc, t) => acc + t.priorityScore, 0)}</span>
            </div>
          </div>
        </div>

        {/* SECTION 2: APPROVAL AUDIT LOG */}
        <div className="bg-white border border-[#E6DDD3] rounded-xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3.5 bg-[#F5F1EC] border-b border-[#E6DDD3] flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#6B1420]" />
              <span className="font-display font-bold text-xs uppercase tracking-wider text-[#2B1210]">
                Approval Audit Log
              </span>
              <span className="px-2 py-0.5 bg-[#6B1420]/10 text-[#6B1420] text-xs font-mono rounded-full border border-[#6B1420]/20">
                {filteredAudit.length} entries
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchAuditLog}
                disabled={auditLoading}
                className="flex items-center gap-1.5 py-1.5 px-3 bg-white border border-[#E6DDD3] rounded-lg text-xs font-mono text-[#4A322E] hover:bg-[#F0EAE4] transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${auditLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                onClick={handleExportAuditCSV}
                disabled={filteredAudit.length === 0}
                className="flex items-center gap-1.5 py-1.5 px-3 bg-[#6B1420] text-white font-mono text-xs font-bold rounded-lg hover:bg-[#6B1420]/90 transition-all cursor-pointer shadow-sm disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="px-4 py-3 border-b border-[#E6DDD3] bg-white flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search ticket ID, actor, reason…"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs font-sans border border-[#E6DDD3] rounded-lg bg-[#F5F1EC] focus:outline-none focus:border-[#6B1420] text-[#2B1210]"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="text-xs font-mono border border-[#E6DDD3] rounded-lg bg-[#F5F1EC] px-2 py-1.5 text-[#2B1210] focus:outline-none focus:border-[#6B1420] cursor-pointer"
              >
                {auditActions.map((a) => (
                  <option key={a} value={a}>
                    {a === "All" ? "All Actions" : (actionMeta[a]?.label ?? a)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            {auditLoading ? (
              <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin text-[#6B1420]" />
                <span className="text-sm font-mono">Loading audit records…</span>
              </div>
            ) : auditError ? (
              <div className="flex flex-col items-center justify-center gap-2 py-14 text-rose-600">
                <AlertCircle className="w-8 h-8" />
                <p className="text-sm font-mono">{auditError}</p>
                <button onClick={fetchAuditLog} className="text-xs underline mt-1 cursor-pointer">Retry</button>
              </div>
            ) : filteredAudit.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-14 text-slate-400">
                <ShieldCheck className="w-10 h-10 stroke-1" />
                <p className="text-sm font-sans">No audit entries match your filters.</p>
              </div>
            ) : (
              <table className="min-w-full border-collapse text-xs font-sans">
                <thead className="bg-[#F0EAE4] sticky top-0 z-10">
                  <tr>
                    {["Timestamp", "Ticket ID", "Action", "Actor", "Amount", "Reason / Notes"].map((h) => (
                      <th key={h} className="border-b border-[#E6DDD3] px-3 py-2.5 text-left font-bold uppercase tracking-wider text-slate-600 text-[10px] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EAE4]">
                  {filteredAudit.map((entry) => {
                    const meta = actionMeta[entry.action];
                    return (
                      <tr key={entry.id} className="hover:bg-[#F5F1EC]/60 transition-colors">
                        <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap font-mono">
                          {new Date(entry.createdAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 font-mono font-bold text-[#6B1420] whitespace-nowrap">
                          {entry.jobOrderId}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta?.color ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                            {meta?.label ?? entry.action}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                          {entry.actorName ?? <span className="italic text-slate-400">System</span>}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap font-mono">
                          {entry.amountPhp != null
                            ? <span className="text-violet-700 font-bold">₱{entry.amountPhp.toLocaleString()}</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 max-w-[280px]">
                          {entry.reason
                            ? <span className="italic">"{entry.reason}"</span>
                            : entry.newValue
                              ? <span className="text-slate-400 font-mono text-[10px]">{entry.newValue}</span>
                              : <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};