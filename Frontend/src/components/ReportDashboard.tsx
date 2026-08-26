import React, { useState, useEffect } from "react";
import { JobOrder } from "../types";
import {
  FileSpreadsheet,
  Sparkles,
  Download,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  BrainCircuit,
  Calendar,
  ArrowRight,
  Printer
} from "lucide-react";

interface ReportDashboardProps {
  tickets: JobOrder[];
  authedFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export const ReportDashboard: React.FC<ReportDashboardProps> = ({ tickets, authedFetch }) => {
  const [activeCell, setActiveCell] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const [editValue, setEditValue] = useState("");
  const [selectedPromptType, setSelectedPromptType] = useState<"bottlenecks" | "safety" | "balancing">("bottlenecks");
  const [aiReport, setAiReport] = useState<string>("");
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedTable, setCopiedTable] = useState(false);
  const [loadingSteps, setLoadingSteps] = useState<string>("Initializing analytical engine...");

  // Local grid values based on job orders
  const [gridData, setGridData] = useState<string[][]>([]);

  // Row and Column metadata for simulated Excel grid
  const columns = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
  const columnHeaders = [
    "Ticket ID",
    "Office Location",
    "Request Description",
    "Job Type",
    "Safety Risk",
    "Urgency",
    "Priority Score",
    "Assigned Staff",
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

    // Define CSV header
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

  // Generate AI analytical report via backend
  const handleGenerateAiReport = async (type: "bottlenecks" | "safety" | "balancing" = selectedPromptType) => {
    setLoadingAi(true);
    setAiError("");
    setAiReport("");

    // Simulate animated loading steps for enhanced UI feedback
    const steps = [
      "Connecting to COSCA facilities database...",
      "Querying active job order records...",
      "Feeding ticket priority scores into the intelligence matrix...",
      "Analyzing staff specialties & workload bottlenecks with Gemini 3.5 Flash...",
      "Compiling final executive recommendations and tabulating results..."
    ];

    let currentStep = 0;
    setLoadingSteps(steps[0]);

    const interval = setInterval(() => {
      if (currentStep < steps.length - 1) {
        currentStep++;
        setLoadingSteps(steps[currentStep]);
      }
    }, 1800);

    try {
      const response = await authedFetch("/api/reports/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptType: type })
      });

      if (!response.ok) {
        throw new Error("Failed to reach analytical core. Please try again.");
      }

      const data = await response.json();
      setAiReport(data.report || "No analysis generated.");
    } catch (err: any) {
      setAiError(err.message || "Something went wrong.");
    } finally {
      clearInterval(interval);
      setLoadingAi(false);
    }
  };

  // Converts the same markdown syntax renderMarkdown() understands (headers,
  // bold, inline code, bullet lists, tables, --- rules) into Word-friendly
  // HTML with inline styles — Tailwind classes don't mean anything to Word,
  // so this is a parallel, simpler converter just for the exported file.
  const markdownToWordHtml = (text: string): string => {
    const lines = text.split("\n");
    let html = "";
    let inList = false;
    let listBuffer: string[] = [];
    let inTable = false;
    let tableBuffer: string[][] = [];

    const escapeInline = (str: string) => {
      let s = str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      s = s.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
      s = s.replace(/`(.*?)`/g, "<span style=\"font-family:'Courier New';background:#F0EAE4;color:#6B1420;padding:1px 4px;\">$1</span>");
      return s;
    };

    const flushList = () => {
      if (listBuffer.length > 0) {
        html += "<ul>";
        listBuffer.forEach((item) => {
          html += `<li style="margin-bottom:4px;font-size:12px;color:#333333;">${escapeInline(item)}</li>`;
        });
        html += "</ul>";
        listBuffer = [];
        inList = false;
      }
    };

    const flushTable = () => {
      if (tableBuffer.length > 0) {
        const headers = tableBuffer[0];
        const rows = tableBuffer.slice(1).filter((r) => r.some((c) => c.trim().replace(/[-:|]/g, "").length > 0));
        html += `<table style="border-collapse:collapse;width:100%;margin:12px 0;">`;
        html += "<tr>" + headers.map((h) => `<th style="border:1px solid #E6DDD3;background:#F5F1EC;padding:6px 8px;text-align:left;font-size:11px;">${escapeInline(h.trim())}</th>`).join("") + "</tr>";
        rows.forEach((row) => {
          html += "<tr>" + row.map((cell) => `<td style="border:1px solid #E6DDD3;padding:6px 8px;font-size:11px;">${escapeInline(cell.trim())}</td>`).join("") + "</tr>";
        });
        html += "</table>";
        tableBuffer = [];
        inTable = false;
      }
    };

    lines.forEach((line) => {
      const trimmed = line.trim();

      if (trimmed.startsWith("|")) {
        flushList();
        inTable = true;
        const cells = line.split("|").map((c) => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
        if (!cells.every((c) => c.replace(/[-:\s]/g, "").length === 0)) {
          tableBuffer.push(cells);
        }
        return;
      } else if (inTable) {
        flushTable();
      }

      if (trimmed.startsWith("### ")) {
        flushList();
        html += `<h4 style="font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;color:#2B1210;margin:16px 0 6px;">${escapeInline(trimmed.slice(4))}</h4>`;
      } else if (trimmed.startsWith("## ")) {
        flushList();
        html += `<h3 style="font-size:16px;font-weight:600;color:#6B1420;border-bottom:1px solid #F0EAE4;padding-bottom:4px;margin:20px 0 10px;">${escapeInline(trimmed.slice(3))}</h3>`;
      } else if (trimmed.startsWith("# ")) {
        flushList();
        html += `<h2 style="font-size:19px;font-weight:bold;color:#241012;border-bottom:1px solid #E6DDD3;padding-bottom:6px;margin:26px 0 14px;">${escapeInline(trimmed.slice(2))}</h2>`;
      } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        inList = true;
        listBuffer.push(trimmed.slice(2));
      } else if (trimmed === "---") {
        flushList();
        html += `<hr style="border:none;border-top:1px solid #E6DDD3;margin:16px 0;">`;
      } else if (trimmed === "") {
        if (inList) flushList();
        // blank lines carry no content of their own — spacing comes from
        // the margins already on headings/paragraphs, so just skip them
      } else {
        if (inList) flushList();
        html += `<p style="font-size:12px;line-height:1.6;color:#333333;margin:0 0 10px;">${escapeInline(trimmed)}</p>`;
      }
    });

    flushList();
    flushTable();
    return html;
  };

  const handleCopyReport = () => {
    if (!aiReport) return;
    navigator.clipboard.writeText(aiReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Exports the briefing as a real Word document (.doc) with actual
  // formatting — bold headings, bullet lists, tables — instead of raw
  // markdown text, which Word would otherwise show as literal ##/** symbols.
  const handleExportReport = () => {
    if (!aiReport) return;
    const bodyHtml = markdownToWordHtml(aiReport);
    const fullHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>COSCA AI Facilities Briefing</title>
<!--[if gte mso 9]>
<xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml>
<![endif]-->
<style>
  body { font-family: Calibri, Arial, sans-serif; color: #2B1210; }
  table { font-family: Calibri, Arial, sans-serif; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

    const blob = new Blob(["\ufeff", fullHtml], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `COSCA_AI_Briefing_${selectedPromptType}_${new Date().toISOString().slice(0, 10)}.doc`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

  // Simple custom Markdown rendering engine to display Gemini text beautifully with clean Tailwind
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    const lines = text.split("\n");
    let inList = false;
    let listItems: string[] = [];
    let inTable = false;
    let tableRows: string[][] = [];

    const elements: React.ReactNode[] = [];

    const flushList = (key: number) => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`ul-${key}`} className="list-disc pl-6 space-y-1 text-[#4A322E] text-sm mb-4 leading-relaxed">
            {listItems.map((item, idx) => (
              <li key={idx} dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
            ))}
          </ul>
        );
        listItems = [];
        inList = false;
      }
    };

    const flushTable = (key: number) => {
      if (tableRows.length > 0) {
        // Find separators and format
        const headers = tableRows[0];
        const rows = tableRows.slice(1).filter(r => r.some(cell => cell.trim().replace(/[-:|]/g, "").length > 0));

        elements.push(
          <div key={`table-wrapper-${key}`} className="overflow-x-auto my-5 border border-[#E6DDD3] rounded-lg shadow-sm">
            <table className="min-w-full divide-y divide-[#E6DDD3] text-left font-sans text-xs">
              <thead className="bg-[#F5F1EC] text-[#4A322E] font-bold">
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="px-4 py-2.5 border-b border-[#E6DDD3]">{h.trim()}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-[#F0EAE4] text-slate-600">
                {rows.map((row, rIdx) => (
                  <tr key={rIdx} className={rIdx % 2 === 0 ? "bg-white" : "bg-[#F5F1EC]/50"}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-4 py-2.5 whitespace-nowrap" dangerouslySetInnerHTML={{ __html: formatInline(cell.trim()) }} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
        inTable = false;
      }
    };

    const formatInline = (str: string) => {
      // Bold **text**
      let html = str.replace(/\*\*(.*?)\*\*/g, "<strong class='font-bold text-[#241012]'>$1</strong>");
      // Bullet/Code backticks `code`
      html = html.replace(/`(.*?)`/g, "<code class='bg-[#F0EAE4] text-[#6B1420] px-1.5 py-0.5 rounded text-xs font-mono font-medium'>$1</code>");
      return html;
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Table line detect (starts and ends with |)
      if (trimmed.startsWith("|")) {
        flushList(index);
        inTable = true;
        const cells = line.split("|").map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
        // Skip markdown separator line e.g. |---|---|
        if (!cells.every(c => c.replace(/[-:\s]/g, "").length === 0)) {
          tableRows.push(cells);
        }
        return;
      } else {
        if (inTable) {
          flushTable(index);
        }
      }

      // Headers
      if (trimmed.startsWith("### ")) {
        flushList(index);
        elements.push(
          <h4 key={index} className="text-sm font-bold font-display uppercase tracking-wider text-[#2B1210] mt-5 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-3 bg-[#6B1420] rounded-sm inline-block" />
            {trimmed.slice(4)}
          </h4>
        );
      } else if (trimmed.startsWith("## ")) {
        flushList(index);
        elements.push(
          <h3 key={index} className="text-base sm:text-lg font-semibold font-display text-[#6B1420] border-b border-[#F0EAE4] pb-1 mt-6 mb-3">
            {trimmed.slice(3)}
          </h3>
        );
      } else if (trimmed.startsWith("# ")) {
        flushList(index);
        elements.push(
          <h2 key={index} className="text-lg sm:text-xl font-bold font-display text-[#241012] border-b border-[#E6DDD3] pb-2 mt-8 mb-4">
            {trimmed.slice(2)}
          </h2>
        );
      }
      // Lists
      else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        inList = true;
        listItems.push(trimmed.slice(2));
      } else {
        if (inList) {
          flushList(index);
        }

        if (trimmed === "") {
          elements.push(<div key={index} className="h-2" />);
        } else {
          elements.push(
            <p key={index} className="text-slate-600 text-sm leading-relaxed mb-3.5" dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }} />
          );
        }
      }
    });

    // End of file flushes
    if (inList) flushList(lines.length);
    if (inTable) flushTable(lines.length);

    return <div className="space-y-1">{elements}</div>;
  };

  // Pre-load default report on mount if empty
  useEffect(() => {
    if (!aiReport && !loadingAi) {
      // Create a nice initial summary report based on current data
      handleGenerateAiReport();
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F5F1EC] overflow-y-auto" id="report-dashboard">
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8">

        {/* SECTION 1: INTERACTIVE EXCEL LAYOUT ENGINE */}
        <div className="bg-white border border-[#E6DDD3] rounded-xl shadow-sm overflow-hidden flex flex-col print:hidden">
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
                className="flex items-center gap-1.5 py-2 px-3.5 bg-[#6B1420] text-white font-mono text-xs font-bold rounded-lg hover:bg-[#6B1420] transition-all cursor-pointer shadow-md"
              >
                <Download className="w-3.5 h-3.5" />
                Export to Excel (CSV)
              </button>
            </div>
          </div>

          {/* Excel Formula / Edit Bar */}
          <div className="flex items-center bg-white border-b border-[#E6DDD3] p-1.5 gap-2 text-xs font-mono">
            {/* Active Cell Coordinates Indicator */}
            <div className="bg-[#F0EAE4] border border-[#E6DDD3] px-3 py-1 text-center font-bold text-[#6B1420] min-w-[50px] rounded shadow-inner">
              {columns[activeCell.col]}{activeCell.row + 1}
            </div>

            {/* Formula fx symbol */}
            <div className="text-slate-600 italic px-1 font-serif select-none text-sm font-bold">
              fx
            </div>

            {/* Cell value text edit input */}
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
                {/* Column Letters header row (A, B, C...) */}
                <tr>
                  <th className="w-10 bg-[#E6DDD3] border border-[#DDD2C8] text-center text-sm text-slate-700 font-mono py-1"></th>
                  {columns.map((col, idx) => (
                    <th key={idx} className="bg-[#E6DDD3] border border-[#DDD2C8] text-center font-mono py-1 text-slate-600 min-w-[150px]">
                      {col}
                    </th>
                  ))}
                </tr>
                {/* Custom labeled column headers (Ticket ID, Location...) */}
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
                    {/* Row Index Indicator (1, 2, 3...) */}
                    <td className="bg-[#E6DDD3] border border-[#DDD2C8] text-center font-mono text-sm text-slate-700 font-bold select-none h-9">
                      {rIdx + 1}
                    </td>

                    {/* Cell grids */}
                    {row.map((cell, cIdx) => {
                      const isActive = activeCell.row === rIdx && activeCell.col === cIdx;

                      // Highlight styles depending on status values
                      let badgeClass = "";
                      if (cIdx === 8) { // Status column
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
                          {cIdx === 8 ? (
                            <span className={badgeClass}>{cell}</span>
                          ) : cIdx === 6 ? ( // Priority Score column
                            <span className="font-mono font-bold text-[#2B1210]">{cell}</span>
                          ) : (
                            cell
                          )}

                          {/* Tiny Excel selection corner dot */}
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

          {/* Sheet tabs footer mimicking actual Microsoft Excel */}
          <div className="bg-[#F0EAE4] border-t border-[#E6DDD3] px-4 py-2 flex items-center justify-between text-sm font-sans">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-600 select-none">Sheets:</span>
              <div className="flex bg-white border border-[#E6DDD3] px-3.5 py-1 text-[#6B1420] font-bold rounded shadow-xs relative select-none cursor-default">
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#6B1420] mr-1.5 inline" />
                COSCA_Tickets_Report
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#6B1420]" />
              </div>
            </div>
            <div className="font-mono text-slate-600 text-xs">
              Ready • Sum = {tickets.reduce((acc, t) => acc + t.priorityScore, 0)} (Priority)
            </div>
          </div>
        </div>

        {/* SECTION 2: AI ANALYTICAL INSIGHTS HUB (GEMINI POWERED) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Left panel: Executive prompts list */}
          <div className="lg:col-span-4 space-y-4 print:hidden">
            <div className="bg-white border border-[#E6DDD3] rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-[#6B1420]" />
                <h3 className="font-display font-semibold text-[#2B1210] text-sm uppercase tracking-wider">
                  Select AI Audit Vector
                </h3>
              </div>

              <p className="text-sm text-slate-700 leading-normal">
                Direct the facilities intelligence core to run targeted analytics over the current physical plant database.
              </p>

              <div className="space-y-2.5">
                <button
                  onClick={() => {
                    setSelectedPromptType("bottlenecks");
                    handleGenerateAiReport("bottlenecks");
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer flex gap-3 ${selectedPromptType === "bottlenecks"
                    ? "bg-[#6B1420]/5 border-[#6B1420]/40 text-[#6B1420]"
                    : "bg-transparent border-[#E6DDD3] text-slate-700 hover:text-[#4A322E] hover:bg-[#F5F1EC]"
                    }`}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-[#6B1420] shrink-0 mt-1" />
                  <div className="min-w-0">
                    <h5 className="font-semibold text-xs leading-none">Resource Bottlenecks</h5>
                    <p className="text-xs font-mono mt-1 text-slate-600">
                      Specialties match & workload balancing.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setSelectedPromptType("safety");
                    handleGenerateAiReport("safety");
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer flex gap-3 ${selectedPromptType === "safety"
                    ? "bg-[#6B1420]/5 border-[#6B1420]/40 text-[#6B1420]"
                    : "bg-transparent border-[#E6DDD3] text-slate-700 hover:text-[#4A322E] hover:bg-[#F5F1EC]"
                    }`}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 mt-1" />
                  <div className="min-w-0">
                    <h5 className="font-semibold text-xs leading-none">Safety & Risk Audit</h5>
                    <p className="text-xs font-mono mt-1 text-slate-600">
                      High safety risks and urgent escalations.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setSelectedPromptType("balancing");
                    handleGenerateAiReport("balancing");
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer flex gap-3 ${selectedPromptType === "balancing"
                    ? "bg-[#6B1420]/5 border-[#6B1420]/40 text-[#6B1420]"
                    : "bg-transparent border-[#E6DDD3] text-slate-700 hover:text-[#4A322E] hover:bg-[#F5F1EC]"
                    }`}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 shrink-0 mt-1" />
                  <div className="min-w-0">
                    <h5 className="font-semibold text-xs leading-none">Maintenance Speeds</h5>
                    <p className="text-xs font-mono mt-1 text-slate-600">
                      Workload balancing & operational speeds.
                    </p>
                  </div>
                </button>
              </div>

              <div className="border-t border-[#E6DDD3] pt-4">
                <button
                  onClick={() => handleGenerateAiReport()}
                  disabled={loadingAi}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-[#6B1420] text-white text-xs font-mono font-bold rounded-lg hover:bg-[#6B1420] transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAi ? "animate-spin" : ""}`} />
                  RE-RUN AI ANALYSIS
                </button>
              </div>
            </div>

            <div className="bg-[#6B1420]/10 border border-[#6B1420]/20 rounded-xl p-4 flex gap-3 text-xs text-[#6B1420]">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h5 className="font-semibold font-display mb-1">Direct Data Grounding</h5>
                <p className="leading-normal">
                  All audit reports are generated in real-time from the live database records. The spreadsheet above is a read-only view of the current database state.
                </p>
              </div>
            </div>
          </div>

          {/* Right panel: Live Markdown report display */}
          <div className="lg:col-span-8">
            <style>{`
              @media print {
                /* Let the report flow naturally down the page (and onto
                   further pages) instead of being pinned with position:
                   absolute, which Chrome refuses to paginate past page 1. */
                html, body, #report-dashboard {
                  height: auto !important;
                  overflow: visible !important;
                }
                /* The dashboard shell (Sidebar + Topbar layout, defined
                   outside this file) also pins its height to the viewport
                   and clips overflow to keep everything fixed on screen —
                   that same constraint clips the printed report to a
                   single page's worth of content. Reset every element
                   using those Tailwind utilities, wherever they live. */
                .h-screen, .h-dvh, .min-h-screen {
                  height: auto !important;
                  min-height: 0 !important;
                }
                .overflow-hidden {
                  overflow: visible !important;
                }
              }
            `}</style>
            <div id="ai-report-print-area" className="bg-white border border-[#E6DDD3] rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[500px] print:border-0 print:shadow-none print:overflow-visible">

              {/* Report Panel Header */}
              <div className="px-4 py-3.5 bg-[#F5F1EC] border-b border-[#E6DDD3] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#6B1420] animate-pulse" />
                  <span className="font-display font-bold text-xs uppercase tracking-wider text-[#2B1210]">
                    Generated Executive Briefing
                  </span>
                </div>

                <div className="flex items-center gap-2 print:hidden">
                  {aiReport && (
                    <button
                      onClick={handleCopyReport}
                      className="flex items-center gap-1 py-1.5 px-3 bg-white border border-[#E6DDD3] rounded text-xs font-mono text-[#4A322E] hover:bg-[#F0EAE4] transition-colors cursor-pointer"
                      title="Copy briefing contents to clipboard"
                    >
                      {copied ? <Check className="w-3 h-3 text-soft-green" /> : <Copy className="w-3 h-3" />}
                      {copied ? "Copied!" : "Copy Report"}
                    </button>
                  )}
                  {aiReport && (
                    <button
                      onClick={handleExportReport}
                      className="flex items-center gap-1 py-1.5 px-3 bg-white border border-[#E6DDD3] rounded text-xs font-mono text-[#4A322E] hover:bg-[#F0EAE4] transition-colors cursor-pointer"
                      title="Export briefing as a Word document"
                    >
                      <Download className="w-3 h-3" />
                      Export
                    </button>
                  )}
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1 py-1.5 px-3 bg-white border border-[#E6DDD3] rounded text-xs font-mono text-[#4A322E] hover:bg-[#F0EAE4] transition-colors cursor-pointer"
                    title="Print report"
                  >
                    <Printer className="w-3 h-3" />
                    Print
                  </button>
                </div>
              </div>

              {/* Report Body */}
              <div className="p-6 flex-1 flex flex-col">
                {loadingAi ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
                    <div className="relative flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full border-4 border-[#6B1420]/20 border-t-[#6B1420] animate-spin" />
                      <BrainCircuit className="w-6 h-6 text-[#6B1420] absolute animate-pulse" />
                    </div>
                    <div className="space-y-1.5 max-w-sm">
                      <h4 className="font-display font-bold text-sm text-[#2B1210] uppercase tracking-wider">
                        Running AI Diagnosis...
                      </h4>
                      <p className="text-sm text-slate-600 font-mono italic animate-pulse">
                        "{loadingSteps}"
                      </p>
                    </div>
                  </div>
                ) : aiError ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-rose-500/5 rounded-lg border border-rose-500/10">
                    <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
                    <h4 className="font-display font-semibold text-[#2B1210]">Briefing Compilation Interrupted</h4>
                    <p className="text-sm text-slate-700 mt-1 max-w-sm">
                      {aiError}
                    </p>
                    <button
                      onClick={() => handleGenerateAiReport()}
                      className="mt-4 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded font-mono font-bold text-xs text-rose-600 cursor-pointer transition-colors"
                    >
                      TRY RECONNECTING CORE
                    </button>
                  </div>
                ) : aiReport ? (
                  <div className="prose max-w-none prose-sm">
                    {renderMarkdown(aiReport)}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-600">
                    <BrainCircuit className="w-12 h-12 mb-2 stroke-1" />
                    <p className="text-xs font-sans">
                      No report loaded. Select an audit vector above or click re-run.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};