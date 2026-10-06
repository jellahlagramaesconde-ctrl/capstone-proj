import React, { useState, useEffect, useMemo } from "react";
import { jsPDF } from "jspdf";
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
  Filter,
  Sparkles,
  Printer,
  ClipboardList,
  CheckCircle2,
  Clock,
  Timer,
  Building2,
  AlertTriangle
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface ReportDashboardProps {
  tickets: JobOrder[];
  authedFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

type RangeKey = "7d" | "30d" | "semester" | "all";

const RANGE_OPTIONS: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "semester", label: "This semester (180 days)", days: 180 },
  { key: "all", label: "All time", days: null },
];

const escHtml = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const downloadCSV = (filename: string, rows: (string | number)[][]) => {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

// ---------------------------------------------------------------------------
// savePDF — builds a PDF in-memory with jsPDF and triggers an immediate
// file download. No print dialog, no popup window required.
// ---------------------------------------------------------------------------
type PdfSection =
  | { type: "title"; text: string }
  | { type: "meta"; text: string }
  | { type: "heading"; text: string }
  | { type: "bullet"; text: string }
  | { type: "table"; headers: string[]; rows: string[][]; footerRow?: string[] };

const savePDF = (filename: string, sections: PdfSection[]) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 18;
  const marginR = 18;
  const contentW = pageW - marginL - marginR;
  let y = 20;

  const checkPage = (needed: number) => {
    if (y + needed > pageH - 16) {
      doc.addPage();
      y = 20;
    }
  };

  for (const section of sections) {
    if (section.type === "title") {
      checkPage(12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(107, 20, 32); // #6B1420
      doc.text(section.text, marginL, y);
      y += 9;

    } else if (section.type === "meta") {
      checkPage(6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(section.text, marginL, y);
      y += 7;

    } else if (section.type === "heading") {
      checkPage(10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(107, 20, 32);
      doc.text(section.text, marginL, y);
      y += 7;

    } else if (section.type === "bullet") {
      checkPage(6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(43, 18, 16);
      const lines = doc.splitTextToSize(`• ${section.text}`, contentW - 4);
      doc.text(lines, marginL + 3, y);
      y += lines.length * 5.5;

    } else if (section.type === "table") {
      const { headers, rows, footerRow } = section;
      const allRows = [...rows, ...(footerRow ? [footerRow] : [])];
      // Fixed column widths: distribute evenly
      const colW = contentW / headers.length;
      const rowH = 7;
      const headerH = 7;

      checkPage(headerH + 4);
      // Header row
      doc.setFillColor(240, 234, 228); // #f0eae4
      doc.setDrawColor(221, 210, 200);
      doc.rect(marginL, y, contentW, headerH, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(43, 18, 16);
      headers.forEach((h, i) => {
        const cellX = marginL + i * colW;
        doc.text(h, cellX + 2, y + 4.8, { maxWidth: colW - 4 });
      });
      y += headerH;

      allRows.forEach((row, ri) => {
        checkPage(rowH + 2);
        const isFooter = footerRow && ri === allRows.length - 1;
        if (isFooter) {
          doc.setFillColor(245, 241, 236); // #f5f1ec
          doc.rect(marginL, y, contentW, rowH, "FD");
          doc.setFont("helvetica", "bold");
        } else {
          doc.setFillColor(ri % 2 === 0 ? 255 : 250, ri % 2 === 0 ? 255 : 248, ri % 2 === 0 ? 255 : 246);
          doc.rect(marginL, y, contentW, rowH, "FD");
          doc.setFont("helvetica", "normal");
        }
        doc.setFontSize(9);
        doc.setTextColor(43, 18, 16);
        row.forEach((cell, i) => {
          const cellX = marginL + i * colW;
          const txt = doc.splitTextToSize(String(cell), colW - 4);
          doc.text(txt[0] ?? "", cellX + 2, y + 4.8);
        });
        // Row border
        doc.setDrawColor(221, 210, 200);
        doc.rect(marginL, y, contentW, rowH);
        y += rowH;
      });
      y += 6;
    }
  }

  // Footer on every page
  const pageCount = (doc.internal as any).getNumberOfPages?.() ?? 1;
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `COSCA Facilities Portal  ·  Page ${p} of ${pageCount}  ·  Confidential`,
      pageW / 2,
      pageH - 8,
      { align: "center" }
    );
  }

  doc.save(filename);
};

// Minimal Markdown renderer for the AI report (headers, bullets, bold, tables).
const renderInline = (text: string): React.ReactNode[] =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <React.Fragment key={i}>{part.replace(/\*/g, "")}</React.Fragment>
  );

const MarkdownReport: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split(/\r?\n/);
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { i++; continue; }
    if (trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { tableLines.push(lines[i].trim()); i++; }
      const rows = tableLines
        .filter((l) => !/^\|[\s:|-]+\|?$/.test(l))
        .map((l) => l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
      if (rows.length) {
        out.push(
          <div key={`t${i}`} className="overflow-x-auto my-2">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr>{rows[0].map((c, k) => <th key={k} className="border border-[#E6DDD3] bg-[#F0EAE4] px-2 py-1 text-left">{renderInline(c)}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(1).map((r, ri) => (
                  <tr key={ri}>{r.map((c, k) => <td key={k} className="border border-[#E6DDD3] px-2 py-1">{renderInline(c)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }
    if (/^#{1,2}\s/.test(trimmed)) {
      out.push(<h4 key={i} className="font-display font-bold text-sm text-[#6B1420] mt-4 mb-1">{renderInline(trimmed.replace(/^#+\s*/, ""))}</h4>);
    } else if (/^#{3,}\s/.test(trimmed)) {
      out.push(<h5 key={i} className="font-display font-semibold text-xs text-[#2B1210] mt-3 mb-1 uppercase tracking-wide">{renderInline(trimmed.replace(/^#+\s*/, ""))}</h5>);
    } else if (/^[-*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && (/^\s*[-*]\s/.test(lines[i]) || /^\s*\d+\.\s/.test(lines[i]))) {
        items.push(lines[i].trim().replace(/^([-*]|\d+\.)\s+/, ""));
        i++;
      }
      out.push(
        <ul key={`l${i}`} className="list-disc pl-5 space-y-1 text-xs text-[#4A322E]">
          {items.map((it, k) => <li key={k}>{renderInline(it)}</li>)}
        </ul>
      );
      continue;
    } else {
      out.push(<p key={i} className="text-xs text-[#4A322E] my-1">{renderInline(trimmed)}</p>);
    }
    i++;
  }
  return <>{out}</>;
};

export const ReportDashboard: React.FC<ReportDashboardProps> = ({ tickets, authedFetch }) => {
  const [copiedTable, setCopiedTable] = useState(false);
  const [range, setRange] = useState<RangeKey>("all");

  // AI insights state
  const [aiReport, setAiReport] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiFocus, setAiFocus] = useState("general");

  // Audit log state
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("All");

  const rangeMeta = RANGE_OPTIONS.find((r) => r.key === range)!;
  const rangeCutoff = useMemo(
    () => (rangeMeta.days ? Date.now() - rangeMeta.days * 24 * 3600 * 1000 : null),
    [range]
  );

  // Tickets inside the selected date range (by submission date)
  const scopedTickets = useMemo(() => {
    if (rangeCutoff === null) return tickets;
    return tickets.filter((t) => {
      const ts = new Date(t.dateSubmitted).getTime();
      return isNaN(ts) ? true : ts >= rangeCutoff;
    });
  }, [tickets, rangeCutoff]);

  const columnHeaders = [
    "Ticket ID",
    "Office",
    "Description",
    "Job Type",
    "Safety Risk",
    "Urgency",
    "Priority",
    "Assigned Staff",
    "Approved Cost",
    "Status",
  ];

  const gridData = useMemo<string[][]>(
    () =>
      scopedTickets.map((t) => [
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
        t.status,
      ]),
    [scopedTickets]
  );

  // Summary statistics
  const stats = useMemo(() => {
    const total = scopedTickets.length;
    const completed = scopedTickets.filter((t) => t.status === "Completed");
    const open = total - completed.length;
    const durations = completed
      .map((t) =>
        t.dateCompleted
          ? (new Date(t.dateCompleted).getTime() - new Date(t.dateSubmitted).getTime()) / (24 * 3600 * 1000)
          : NaN
      )
      .filter((d) => !isNaN(d) && d >= 0);
    const avgDays = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
    const now = Date.now();
    const overdue = scopedTickets.filter(
      (t) => t.status !== "Completed" && t.deadline && new Date(t.deadline).getTime() < now
    ).length;
    const totalApproved = scopedTickets.reduce((acc, t) => acc + (t.approvedAmount ?? 0), 0);
    return {
      total,
      completedCount: completed.length,
      open,
      completionRate: total ? Math.round((completed.length / total) * 100) : 0,
      avgDays,
      overdue,
      totalApproved,
    };
  }, [scopedTickets]);

  // Requests by Department: merge near-duplicate office names (e.g. "Registrar's Off." vs "Registrar Off.")
  const departmentChartData = useMemo(() => {
    const normalize = (s: string) =>
      s.toLowerCase().replace(/['’]s\b/g, "").replace(/\s+/g, " ").trim();
    const groups: Record<string, { name: string; completed: number; open: number; total: number }> = {};
    scopedTickets.forEach((t) => {
      const key = normalize(t.office || "Unknown");
      if (!groups[key]) groups[key] = { name: t.office || "Unknown", completed: 0, open: 0, total: 0 };
      if (t.status === "Completed") groups[key].completed += 1;
      else groups[key].open += 1;
      groups[key].total += 1;
    });
    return Object.values(groups).sort((a, b) => b.total - a.total);
  }, [scopedTickets]);

  const busiest = departmentChartData[0];
  const stamp = new Date().toISOString().slice(0, 10);

  const handleExportCSV = () => {
    if (gridData.length === 0) return;
    downloadCSV(`COSCA_Job_Orders_Report_${stamp}.csv`, [columnHeaders, ...gridData]);
  };

  const handleCopyTable = () => {
    if (gridData.length === 0) return;
    const text = [columnHeaders.join("\t"), ...gridData.map((row) => row.join("\t"))].join("\n");
    navigator.clipboard.writeText(text);
    setCopiedTable(true);
    setTimeout(() => setCopiedTable(false), 2000);
  };

  const handleExportDepartmentCSV = () => {
    if (departmentChartData.length === 0) return;
    downloadCSV(`COSCA_Requests_By_Department_${stamp}.csv`, [
      ["Department", "Total Requests", "Completed", "Open"],
      ...departmentChartData.map((d) => [d.name, d.total, d.completed, d.open]),
    ]);
  };

  // Full report PDF: summary + department table — saves a .pdf file directly.
  const handleExportDepartmentPDF = () => {
    if (departmentChartData.length === 0) return;
    const avg = stats.avgDays !== null ? `${stats.avgDays.toFixed(1)} days` : "N/A";
    savePDF(`COSCA_Facilities_Report_${stamp}.pdf`, [
      { type: "title",   text: "COSCA Facilities Report" },
      { type: "meta",    text: `${rangeMeta.label}  ·  Generated ${new Date().toLocaleString()}` },
      { type: "heading", text: "Summary" },
      { type: "bullet",  text: `Total requests: ${stats.total}` },
      { type: "bullet",  text: `Completed: ${stats.completedCount} (${stats.completionRate}%)` },
      { type: "bullet",  text: `Open backlog: ${stats.open}  (overdue: ${stats.overdue})` },
      { type: "bullet",  text: `Average completion time: ${avg}` },
      { type: "bullet",  text: `Total approved cost: ${formatPeso(stats.totalApproved)}` },
      { type: "heading", text: "Requests by Department" },
      {
        type: "table",
        headers: ["Department", "Total", "Completed", "Open"],
        rows: departmentChartData.map((d) => [d.name, String(d.total), String(d.completed), String(d.open)]),
        footerRow: ["All Departments", String(stats.total), String(stats.completedCount), String(stats.open)],
      },
    ]);
  };

  // AI Insights
  const focusOptions = [
    { key: "general", label: "General overview" },
    { key: "bottlenecks", label: "Bottlenecks & workload" },
    { key: "safety", label: "Safety & urgency" },
    { key: "balancing", label: "Staff balancing" },
  ];

  const generateInsights = async () => {
    setAiLoading(true);
    setAiError("");
    try {
      const res = await authedFetch("/api/reports/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptType: aiFocus,
          from: rangeCutoff !== null ? new Date(rangeCutoff).toISOString() : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to generate insights.");
      setAiReport(data.report || "No report content generated.");
    } catch (err: any) {
      setAiError(err.message || "Could not generate insights.");
    } finally {
      setAiLoading(false);
    }
  };

  const printAiReport = () => {
    if (!aiReport) return;
    const sections: PdfSection[] = [
      { type: "title",   text: "COSCA Facilities Insights" },
      { type: "meta",    text: `${rangeMeta.label}  ·  Generated ${new Date().toLocaleString()}` },
    ];
    aiReport.split(/\r?\n/).forEach((line) => {
      const t = line.trim();
      if (!t) return;
      const plain = t.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/^#+\s*/, "").replace(/^[-*]\s+/, "");
      if (/^#{1,2}\s/.test(t))  sections.push({ type: "heading", text: plain });
      else if (/^#{3,}\s/.test(t)) sections.push({ type: "heading", text: plain });
      else if (/^[-*]\s/.test(t)) sections.push({ type: "bullet",  text: plain });
      else                          sections.push({ type: "bullet",  text: plain });
    });
    savePDF(`COSCA_Smart_Insights_${stamp}.pdf`, sections);
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
    const ts = new Date(e.createdAt).getTime();
    const inRange = rangeCutoff === null || isNaN(ts) || ts >= rangeCutoff;
    return matchesAction && matchesSearch && inRange;
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
    downloadCSV(`COSCA_Approval_Audit_Log_${stamp}.csv`, [headers, ...rows]);
  };

  const statCards = [
    { label: "Total Requests", value: String(stats.total), sub: rangeMeta.label, icon: ClipboardList },
    { label: "Completed", value: `${stats.completionRate}%`, sub: `${stats.completedCount} of ${stats.total} done`, icon: CheckCircle2 },
    { label: "Open Backlog", value: String(stats.open), sub: stats.overdue > 0 ? `${stats.overdue} overdue` : "None overdue", icon: stats.overdue > 0 ? AlertTriangle : Clock },
    { label: "Avg. Completion", value: stats.avgDays !== null ? `${stats.avgDays.toFixed(1)}d` : "—", sub: "Submitted → completed", icon: Timer },
    { label: "Busiest Office", value: busiest ? String(busiest.total) : "—", sub: busiest ? busiest.name : "No data", icon: Building2 },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F5F1EC] overflow-y-auto" id="report-dashboard">
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8">

        {/* HEADER + DATE RANGE */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-bold text-xl text-[#241012]">Reports &amp; Insights</h2>
            <p className="text-sm text-slate-600 font-sans mt-0.5">Track repair trends, workload and approvals, then download reports.</p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              id="report-range"
              value={range}
              onChange={(e) => setRange(e.target.value as RangeKey)}
              className="text-xs font-mono border border-[#E6DDD3] rounded-lg bg-white px-3 py-2 text-[#2B1210] focus:outline-none focus:border-[#6B1420] cursor-pointer"
            >
              {RANGE_OPTIONS.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* SUMMARY CARDS */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {statCards.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="bg-white border border-[#E6DDD3] rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-600">{c.label}</span>
                  <Icon className="w-4 h-4 text-[#6B1420]" />
                </div>
                <div className="text-2xl font-mono font-bold text-[#241012] mt-2 leading-none">{c.value}</div>
                <p className="text-xs text-slate-600 font-sans mt-1.5 truncate" title={c.sub}>{c.sub}</p>
              </div>
            );
          })}
        </section>

        {/* AI INSIGHTS */}
        <div className="bg-white border border-[#E6DDD3] rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 bg-[#F5F1EC] border-b border-[#E6DDD3] flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#6B1420]" />
              <span className="font-display font-bold text-xs uppercase tracking-wider text-[#2B1210]">Smart Insights</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={aiFocus}
                onChange={(e) => setAiFocus(e.target.value)}
                className="text-xs font-mono border border-[#E6DDD3] rounded-lg bg-white px-2 py-2 text-[#2B1210] focus:outline-none focus:border-[#6B1420] cursor-pointer"
              >
                {focusOptions.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
              <button
                onClick={generateInsights}
                disabled={aiLoading}
                className="flex items-center gap-1.5 py-2 px-3.5 bg-[#6B1420] text-white font-mono text-xs font-bold rounded-lg hover:bg-[#6B1420]/90 transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                {aiLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {aiLoading ? "Analyzing…" : aiReport ? "Refresh" : "Generate Insights"}
              </button>
              {aiReport && (
                <button
                  onClick={printAiReport}
                  className="flex items-center gap-1.5 py-2 px-3.5 bg-white border border-[#6B1420]/40 text-[#6B1420] font-mono text-xs font-bold rounded-lg hover:bg-[#6B1420]/10 transition-all cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print / PDF
                </button>
              )}
            </div>
          </div>
          <div className="p-4 sm:p-6">
            {aiError ? (
              <div className="flex items-center gap-2 text-rose-600 text-sm font-sans">
                <AlertCircle className="w-4 h-4" /> {aiError}
              </div>
            ) : aiLoading ? (
              <div className="flex items-center gap-3 text-slate-500 text-sm font-mono py-6">
                <RefreshCw className="w-4 h-4 animate-spin text-[#6B1420]" /> Analyzing job orders…
              </div>
            ) : aiReport ? (
              <MarkdownReport text={aiReport} />
            ) : (
              <p className="text-sm text-slate-600 font-sans">
                Get a plain-language summary of trends, problem areas and recommended actions based on the selected date range.
                Choose a focus and click <strong>Generate Insights</strong>.
              </p>
            )}
          </div>
        </div>

        {/* REQUESTS BY DEPARTMENT */}
        <div className="bg-white border border-[#E6DDD3] rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 bg-[#F5F1EC] border-b border-[#E6DDD3] flex flex-wrap gap-3 items-center justify-between">
            <span className="font-display font-bold text-xs uppercase tracking-wider text-[#2B1210]">
              Requests by Department
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportDepartmentPDF}
                disabled={departmentChartData.length === 0}
                className="flex items-center gap-1.5 py-2 px-3.5 bg-white border border-[#6B1420]/40 text-[#6B1420] font-mono text-xs font-bold rounded-lg hover:bg-[#6B1420]/10 transition-all cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                Export PDF
              </button>
              <button
                onClick={handleExportDepartmentCSV}
                disabled={departmentChartData.length === 0}
                className="flex items-center gap-1.5 py-2 px-3.5 bg-[#6B1420] text-white font-mono text-xs font-bold rounded-lg hover:bg-[#6B1420]/90 transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                Export to Excel (CSV)
              </button>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            {departmentChartData.length === 0 ? (
              <p className="text-sm text-slate-600 font-sans">No requests in this date range.</p>
            ) : (
              <div className="w-full select-none" style={{ height: Math.max(180, departmentChartData.length * 44 + 50) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentChartData} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
                    <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" stroke="#6b7280" tick={{ fontSize: 11 }} width={220} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="open" name="Open" stackId="a" fill="#8C2331" barSize={18} />
                    <Bar dataKey="completed" name="Completed" stackId="a" fill="#2f9e6e" radius={[0, 4, 4, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* JOB ORDER TABLE (read-only) */}
        <div className="bg-white border border-[#E6DDD3] rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3.5 bg-[#F5F1EC] border-b border-[#E6DDD3] flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#6B1420]" />
              <span className="font-display font-bold text-xs uppercase tracking-wider text-[#2B1210]">Job Order Report</span>
              <span className="px-2 py-0.5 bg-[#6B1420]/10 text-[#6B1420] text-xs font-mono rounded-full border border-[#6B1420]/20">
                {gridData.length} rows
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleCopyTable}
                disabled={gridData.length === 0}
                className="flex items-center gap-1.5 py-2 px-3.5 bg-white border border-[#E6DDD3] rounded-lg text-xs font-mono text-[#4A322E] hover:bg-[#F0EAE4] transition-colors cursor-pointer disabled:opacity-50"
              >
                {copiedTable ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedTable ? "Copied!" : "Copy Table"}
              </button>
              <button
                onClick={handleExportCSV}
                disabled={gridData.length === 0}
                className="flex items-center gap-1.5 py-2 px-3.5 bg-[#6B1420] text-white font-mono text-xs font-bold rounded-lg hover:bg-[#6B1420]/90 transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                Export to Excel (CSV)
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            {gridData.length === 0 ? (
              <p className="text-sm text-slate-500 font-sans py-12 text-center">No job orders in this date range.</p>
            ) : (
              <table className="min-w-full border-collapse text-xs font-sans">
                <thead className="bg-[#F0EAE4] sticky top-0 z-10">
                  <tr>
                    {columnHeaders.map((h) => (
                      <th key={h} className="border-b border-[#E6DDD3] px-3 py-2.5 text-left font-bold uppercase tracking-wider text-slate-600 text-[10px] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EAE4]">
                  {gridData.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-[#F5F1EC]/60 transition-colors">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-2.5 text-[#4A322E] max-w-[240px] truncate" title={cell}>
                          {cIdx === 9 ? (
                            <span className={
                              cell === "Completed" ? "bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-200" :
                              cell === "In Progress" ? "bg-cyan-50 text-cyan-700 font-bold px-2 py-0.5 rounded border border-cyan-200" :
                              "bg-[#6B1420]/10 text-[#6B1420] font-bold px-2 py-0.5 rounded border border-[#6B1420]/20"
                            }>{cell}</span>
                          ) : cIdx === 8 ? (
                            <span className={`font-mono ${
                              cell.startsWith("₱") && !cell.includes("No Funds")
                                ? "font-bold text-emerald-700"
                                : "text-slate-500 italic"
                            }`}>{cell}</span>
                          ) : cIdx === 6 ? (
                            <span className="font-mono font-bold text-[#2B1210]">{cell}</span>
                          ) : cIdx === 0 ? (
                            <span className="font-mono font-bold text-[#6B1420]">{cell}</span>
                          ) : (
                            cell
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-[#F0EAE4] border-t border-[#E6DDD3] px-4 py-2 font-mono text-slate-600 text-xs flex flex-wrap items-center gap-3">
            <span>Total Approved: <strong className="text-emerald-700 font-bold">{formatPeso(stats.totalApproved)}</strong></span>
          </div>
        </div>

        {/* APPROVAL AUDIT LOG */}
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