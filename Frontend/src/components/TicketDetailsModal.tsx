import React, { useState, useEffect } from "react";
import { JobOrder } from "../types";
import { getJobOrderCost, getJobOrderCostDisplay, formatPeso } from "../priceUtils";
import { PrintableJobOrder } from "./PrintableJobOrder";
import { BudgetRequisitionItems } from "./BudgetRequisitionItems";
import { DeadlineBadge } from "./DeadlineBadge";
import {
  X,
  Calendar,
  MapPin,
  User,
  Clock,
  AlertTriangle,
  Activity,
  Users,
  Printer,
  Check,
  FileText,
  Star,
  ShieldAlert,
  Wrench,
  CheckCircle,
  RefreshCw,
  Trash2,
  Sliders,
  UserPlus,
  Plus
} from "lucide-react";
import { Staff, StaffCandidate } from "../types";

interface TicketDetailsModalProps {
  isOpen: boolean;
  ticket: JobOrder | null;
  onClose: () => void;
  isAdmin?: boolean;
  onApprove?: (ticketId: string, estimatedCost?: number, emergencyOverride?: boolean) => void;
  onOverride?: (ticketId: string) => void;
  onStaffOverride?: (ticketId: string, assignedStaff: string, priorityScore: number, rationale: string, teamStaffIds?: number[]) => Promise<{ ok: boolean; error?: string } | void>;
  onUpdateStatus?: (ticketId: string, status: "Pending" | "In Progress" | "Completed") => void;
  onFinanceApprove?: (ticketId: string, approvedAmount?: number, estimatedCost?: number, financeNotes?: string) => void;
  onSchoolHeadApprove?: (ticketId: string) => void;
  onDelete?: (ticketId: string) => void;
  onSaveBudgetItems?: (ticketId: string, items: { qty: number; unit?: string; description: string; unitCost: number }[]) => Promise<void>;
  onExtendDeadline?: (ticketId: string, params: { extensionHours?: number; extensionDays?: number; newDeadline?: string; reason: string }) => Promise<{ ok: boolean; error?: string } | void>;
  staffRoster?: Staff[];
  authedFetch?: (url: string, options?: RequestInit) => Promise<Response>;
}

export const TicketDetailsModal: React.FC<TicketDetailsModalProps> = ({
  isOpen,
  ticket,
  onClose,
  isAdmin = false,
  onApprove,
  onOverride,
  onStaffOverride,
  onUpdateStatus,
  onFinanceApprove,
  onSchoolHeadApprove,
  onDelete,
  onSaveBudgetItems,
  onExtendDeadline,
  staffRoster,
  authedFetch,
}) => {
  if (!isOpen || !ticket) return null;

  // Local states for inputs in the modal
  const [modalPpoCost, setModalPpoCost] = useState<string>("");
  const [modalFinanceEst, setModalFinanceEst] = useState<string>("");
  const [modalFinanceAppr, setModalFinanceAppr] = useState<string>("");
  const [modalFinanceNotes, setModalFinanceNotes] = useState<string>("");
  const [modalEmergencyOverride, setModalEmergencyOverride] = useState<boolean>(false);

  // Extend Deadline state
  const [isExtendingDeadline, setIsExtendingDeadline] = useState(false);
  const [extensionHours, setExtensionHours] = useState(0);
  const [extensionDays, setExtensionDays] = useState(1);
  const [extensionReason, setExtensionReason] = useState("");
  const [extensionBusy, setExtensionBusy] = useState(false);
  const [extensionError, setExtensionError] = useState<string | null>(null);
  const [extensionSuccess, setExtensionSuccess] = useState<string | null>(null);

  // Staff Dispatch Override State
  const [isEditingDispatch, setIsEditingDispatch] = useState(false);
  const [editLeadStaff, setEditLeadStaff] = useState<string>("");
  const [editTeam, setEditTeam] = useState<{ id: number; name: string; matchScore: number; isLead: boolean }[]>([]);
  const [candidates, setCandidates] = useState<StaffCandidate[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [editPriorityScore, setEditPriorityScore] = useState<number>(50);
  const [editRationale, setEditRationale] = useState<string>("");
  const [selectedAddStaffId, setSelectedAddStaffId] = useState<string>("");
  const [isSavingOverride, setIsSavingOverride] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [overrideSuccess, setOverrideSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (ticket) {
      setModalPpoCost(ticket.estimatedCost !== undefined ? String(ticket.estimatedCost) : "");

      const defaultEst = ticket.estimatedCost !== undefined
        ? ticket.estimatedCost
        : (ticket.jobType === "Electrical" ? 5400 : ticket.jobType === "Plumbing" ? 3600 : 3000);
      setModalFinanceEst(ticket.estimatedCost !== undefined ? String(ticket.estimatedCost) : String(defaultEst));
      setModalFinanceAppr(ticket.approvedAmount !== undefined ? String(ticket.approvedAmount) : String(defaultEst));
      setModalFinanceNotes(ticket.financeNotes || "");
      setModalEmergencyOverride(false);
      setIsExtendingDeadline(false);
      setExtensionReason("");
      setExtensionHours(0);
      setExtensionDays(1);
      setExtensionError(null);
      setExtensionSuccess(null);
      setIsEditingDispatch(false);
      setOverrideError(null);
      setOverrideSuccess(null);
      setSelectedAddStaffId("");
    }
  }, [ticket, isOpen]);

  const handleApplyExtension = async () => {
    if (!extensionReason.trim()) {
      setExtensionError("Please provide an audit reason for the extension.");
      return;
    }
    setExtensionBusy(true);
    setExtensionError(null);
    setExtensionSuccess(null);

    const payload = {
      extensionHours,
      extensionDays,
      reason: extensionReason.trim(),
    };

    if (onExtendDeadline) {
      const res = await onExtendDeadline(ticket.id, payload);
      setExtensionBusy(false);
      if (res && res.ok === false) {
        setExtensionError(res.error || "Failed to extend deadline.");
      } else {
        setExtensionSuccess("Deadline successfully extended.");
        setTimeout(() => {
          setIsExtendingDeadline(false);
          setExtensionSuccess(null);
        }, 1500);
      }
    } else {
      try {
        const token = localStorage.getItem("jors_token");
        const res = await fetch(`/api/job-orders/${ticket.id}/extend-deadline`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        setExtensionBusy(false);
        if (!res.ok) {
          setExtensionError(data.error || "Failed to extend deadline.");
        } else {
          setExtensionSuccess("Deadline successfully extended.");
          if (data.ticket?.deadline) {
            ticket.deadline = data.ticket.deadline;
            ticket.deadlineExtensionReason = data.ticket.deadlineExtensionReason;
          }
          setTimeout(() => {
            setIsExtendingDeadline(false);
            setExtensionSuccess(null);
          }, 1500);
        }
      } catch (err: any) {
        setExtensionBusy(false);
        setExtensionError(err?.message || "Could not reach server.");
      }
    }
  };

  const handleOpenDispatchEditor = async () => {
    if (!ticket) return;
    setIsEditingDispatch(true);
    setEditLeadStaff(ticket.assignedStaff || "Outsource");
    setEditPriorityScore(ticket.priorityScore || 50);
    setEditRationale("");
    setOverrideError(null);
    setOverrideSuccess(null);
    setSelectedAddStaffId("");

    // Initialize editTeam from ticket.assignedStaffList
    const currentTeam = ticket.assignedStaffList && ticket.assignedStaffList.length > 0
      ? ticket.assignedStaffList.map((m) => ({ ...m }))
      : [];
    if (currentTeam.length === 0 && ticket.assignedStaff && ticket.assignedStaff !== "Outsource") {
      const found = staffRoster?.find((s) => s.name === ticket.assignedStaff);
      if (found && found.id) {
        currentTeam.push({ id: found.id, name: found.name, matchScore: ticket.matchScore || 0, isLead: true });
      }
    }
    setEditTeam(currentTeam);

    // Fetch ranked candidates for this ticket's job type
    setIsLoadingCandidates(true);
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
          setCandidates(deduped);
        }
      }
    } catch (err) {
      console.error("Failed to load staff candidates", err);
    } finally {
      setIsLoadingCandidates(false);
    }
  };

  const handleAddStaffToTeam = () => {
    if (!selectedAddStaffId) return;
    const staffId = Number(selectedAddStaffId);
    if (!staffId || editTeam.some((m) => m.id === staffId)) return;

    const cand = candidates.find((c) => c.id === staffId) || staffRoster?.find((s) => s.id === staffId);
    if (!cand) return;

    const newMember = {
      id: staffId,
      name: cand.name,
      matchScore: (cand as StaffCandidate).matchScore ?? 0,
      isLead: editTeam.length === 0,
    };
    const updatedTeam = [...editTeam, newMember];
    setEditTeam(updatedTeam);
    setSelectedAddStaffId("");

    if (editLeadStaff === "Outsource" || !editLeadStaff) {
      setEditLeadStaff(cand.name);
    }
  };

  const handleRemoveStaffFromTeam = (staffId: number) => {
    const updatedTeam = editTeam.filter((m) => m.id !== staffId);
    setEditTeam(updatedTeam);
    const removedMember = editTeam.find((m) => m.id === staffId);
    if (removedMember && removedMember.name === editLeadStaff) {
      if (updatedTeam.length > 0) {
        updatedTeam[0].isLead = true;
        setEditLeadStaff(updatedTeam[0].name);
      } else {
        setEditLeadStaff("Outsource");
      }
    }
  };

  const handleSetLead = (staffName: string) => {
    setEditLeadStaff(staffName);
    if (staffName === "Outsource") {
      setEditTeam([]);
    } else {
      const cand = candidates.find((c) => c.name === staffName) || staffRoster?.find((s) => s.name === staffName);
      if (cand && cand.id) {
        let updatedTeam = editTeam.map((m) => ({ ...m, isLead: m.id === cand.id }));
        if (!updatedTeam.some((m) => m.id === cand.id)) {
          updatedTeam = [
            { id: cand.id, name: cand.name, matchScore: (cand as StaffCandidate).matchScore ?? 0, isLead: true },
            ...updatedTeam,
          ];
        }
        setEditTeam(updatedTeam);
      }
    }
  };

  const handleSaveDispatchOverride = async () => {
    if (!ticket) return;
    if (!editRationale.trim()) {
      setOverrideError("Please provide an override rationale / explanation.");
      return;
    }
    setIsSavingOverride(true);
    setOverrideError(null);
    try {
      const teamIds = editLeadStaff === "Outsource" ? [] : editTeam.map((m) => m.id);
      if (onStaffOverride) {
        const result = await onStaffOverride(ticket.id, editLeadStaff, editPriorityScore, editRationale.trim(), teamIds);
        if (result && !result.ok) {
          setOverrideError(result.error || "Failed to apply override.");
          return;
        }
      } else if (onOverride) {
        onOverride(ticket.id);
      }
      setOverrideSuccess("Staff assignment & dispatch roster updated successfully.");
      setTimeout(() => {
        setIsEditingDispatch(false);
        setOverrideSuccess(null);
      }, 1500);
    } catch (err: any) {
      setOverrideError(err.message || "Failed to apply override.");
    } finally {
      setIsSavingOverride(false);
    }
  };

  const isCompleted = ticket.status === "Completed";
  const isUrgent = ticket.priorityScore >= 75 && !isCompleted;

  // Determine status color classes
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-soft-green/10 text-soft-green border border-soft-green/20";
      case "In Progress":
        return "bg-cyan-accent/10 text-cyan-accent border border-cyan-accent/20";
      default:
        return "bg-[#6B1420]/10 text-[#6B1420] border border-[#6B1420]/20";
    }
  };

  // Score meter background classes
  const getPriorityColorClass = (score: number) => {
    if (score >= 90) return "bg-rose-500";
    if (score >= 75) return "bg-safety-amber";
    if (score >= 50) return "bg-[#6B1420]";
    return "bg-cyan-accent";
  };

  const getPriorityTextClass = (score: number) => {
    if (score >= 90) return "text-rose-500";
    if (score >= 75) return "text-safety-amber";
    if (score >= 50) return "text-[#6B1420]";
    return "text-cyan-accent";
  };

  // Convert risk score to text
  const getRiskLabel = (score: number) => {
    switch (score) {
      case 5: return "Critical Danger";
      case 4: return "High Risk";
      case 3: return "Moderate Risk";
      case 2: return "Minor Risk";
      default: return "No Risk";
    }
  };

  const handlePrint = () => {
    // Open a clean blank window so the modal backdrop / blur / stacking
    // contexts can't bleed into the printout the way window.print() does.
    const el = document.querySelector<HTMLElement>(".print-only");
    if (!el) { window.print(); return; }

    const printWin = window.open("", "_blank", "width=960,height=720");
    if (!printWin) { window.print(); return; }

    // The blank popup has no base URL, so relative paths like /cosca-seal.png
    // would 404. Rewrite all root-relative src attributes to absolute URLs
    // before injecting so images (logo, etc.) load correctly.
    const origin = window.location.origin;
    const html = el.innerHTML.replace(
      /(<img[^>]+src=")\/([^"]*")/gi,
      `$1${origin}/$2`
    );

    printWin.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Job Order – ${ticket.id}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px;
           color: #000; background: #fff; }
    @page { margin: 0.5in; size: letter portrait; }
    @media print {
      body { margin: 0; }
    }
  </style>
</head>
<body>${html}</body>
</html>`);

    printWin.document.close();
    printWin.focus();
    // Small delay lets the browser finish laying out before the print dialog
    setTimeout(() => {
      printWin.print();
      printWin.close();
    }, 300);
  };

  return (
    <>
      <div className="fixed inset-0 bg-[#241012]/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto">
        {/* Modal Container */}
        <div className="bg-white border border-[#E6DDD3] rounded-t-xl sm:rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[95vh] sm:max-h-[90vh] sm:my-8">

          {/* Crimson Header Banner */}
          <div className="sticky top-0 z-10 bg-[#7C1D2D] text-white px-5 sm:px-6 py-4 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-[11px] font-mono tracking-widest uppercase text-white/75 leading-none">
                    JORS · COSCA · TICKET #{ticket.id}
                  </span>
                  {ticket.isEmergency && (
                    <span className="text-[10px] bg-red-500/80 text-white px-2 py-0.5 rounded-full font-mono font-bold uppercase animate-pulse">
                      EMERGENCY
                    </span>
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5">
                  Requisition Details Sheet: {ticket.office}
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-white/75 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Close sheet"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Form Body */}
          <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 overflow-y-auto flex-1">

            {ticket.isEmergency && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-sm font-sans leading-relaxed">
                  <span className="font-bold text-red-700">🚨 Emergency Request — All Admins Urgently Notified.</span>
                  <span className="text-red-700/90">
                    {" "}This request was flagged as an emergency. The PPO, School Head, and Finance team
                    were all notified simultaneously so they can act without delay.
                    Standard approval stages (PPO → School Head → Finance) still apply and must each be completed.
                  </span>
                </div>
              </div>
            )}

            {/* Main Title and Status overview banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start bg-[#F5F1EC] border border-[#F0EAE4] p-4 rounded-lg">
              <div className="md:col-span-2 space-y-1">
                <span className="text-xs font-mono tracking-widest text-slate-600 uppercase font-bold">
                  REQUEST LOCATION & SPECIALTY
                </span>
                <h4 className="text-xl font-display font-semibold text-[#241012] flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#6B1420] shrink-0" />
                  {ticket.office}
                </h4>
                <p className="text-xs font-mono font-bold text-[#6B1420] uppercase">
                  {ticket.jobType} WORK REQUEST
                </p>
              </div>

              <div className="flex flex-col md:items-end justify-center h-full gap-1.5">
                <span className="text-xs font-mono tracking-widest text-slate-600 uppercase font-bold">
                  CURRENT STATUS
                </span>
                <span className={`inline-block text-xs font-mono font-bold px-3 py-1 rounded-full text-center ${getStatusBadgeClass(ticket.status)}`}>
                  {ticket.status.toUpperCase()}
                </span>
              </div>
            </div>

            {/* SLA Timeline & Resolution Target */}
            <div className="bg-[#F5F1EC] border border-[#E6DDD3] rounded-lg p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E6DDD3] pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-[#6B1420]/10 text-[#6B1420]">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono tracking-wider uppercase font-bold text-slate-600 block">
                      SLA TIMELINE &amp; RESOLUTION DEADLINE
                    </span>
                    <span className="text-xs font-sans text-slate-700">
                      Severity: <strong className="text-[#241012] font-mono">{ticket.severity || (ticket.isEmergency ? "Emergency" : "Regular")}</strong>
                    </span>
                  </div>
                </div>

                {/* Live Deadline Badge */}
                <div className="flex items-center gap-2">
                  <DeadlineBadge
                    severity={ticket.severity || (ticket.isEmergency ? "Emergency" : "Regular")}
                    deadline={ticket.deadline}
                    compact={false}
                  />

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsExtendingDeadline(!isExtendingDeadline);
                        setExtensionError(null);
                        setExtensionSuccess(null);
                      }}
                      className="px-2.5 py-1 bg-white border border-[#E6DDD3] hover:border-[#6B1420] text-[#6B1420] rounded-lg text-xs font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      {isExtendingDeadline ? "Close" : "Extend / Edit"}
                    </button>
                  )}
                </div>
              </div>

              {/* Deadline details row */}
              <div className="flex flex-wrap items-center justify-between text-xs font-mono gap-2 text-slate-700">
                <div>
                  <span className="text-slate-600 uppercase font-semibold">Target Deadline: </span>
                  <span className="font-bold text-[#241012]">
                    {ticket.deadline
                      ? new Date(ticket.deadline).toLocaleString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Calculating from SLA defaults..."}
                  </span>
                </div>

                {ticket.deadlineExtensionReason && (
                  <div className="text-[11px] font-sans bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded">
                    ⚠️ <strong>Extension Logged:</strong> "{ticket.deadlineExtensionReason}"
                  </div>
                )}
              </div>

              {/* Inline Extend Deadline Panel (PPO Admin) */}
              {isExtendingDeadline && (
                <div className="p-3.5 bg-white border border-[#6B1420]/30 rounded-lg space-y-3 mt-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-[#E6DDD3] pb-2">
                    <span className="text-xs font-mono font-bold text-[#6B1420] uppercase flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Extend Deadline For Job Order {ticket.id}
                    </span>
                    <span className="text-[10px] font-mono text-slate-600">Requires audit reason</span>
                  </div>

                  {extensionError && (
                    <div className="p-2 bg-red-50 text-red-700 text-xs rounded border border-red-200">
                      {extensionError}
                    </div>
                  )}

                  {extensionSuccess && (
                    <div className="p-2 bg-emerald-50 text-emerald-700 text-xs rounded border border-emerald-200">
                      {extensionSuccess}
                    </div>
                  )}

                  {/* Quick Add Presets */}
                  <div>
                    <label className="block text-[11px] font-mono font-bold text-slate-700 uppercase mb-1.5">
                      Select Extension Duration:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: "+2 Hours", hours: 2, days: 0 },
                        { label: "+4 Hours", hours: 4, days: 0 },
                        { label: "+8 Hours", hours: 8, days: 0 },
                        { label: "+1 Day", hours: 0, days: 1 },
                        { label: "+2 Days", hours: 0, days: 2 },
                        { label: "+3 Days", hours: 0, days: 3 },
                        { label: "+1 Week", hours: 0, days: 7 },
                      ].map((preset) => {
                        const isSelected = extensionHours === preset.hours && extensionDays === preset.days;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              setExtensionHours(preset.hours);
                              setExtensionDays(preset.days);
                            }}
                            className={`px-2.5 py-1 rounded text-xs font-mono font-bold border transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-[#6B1420] text-white border-[#6B1420]"
                                : "bg-[#F5F1EC] text-slate-700 border-[#E6DDD3] hover:bg-[#EAE4DC]"
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Reason input */}
                  <div>
                    <label className="block text-[11px] font-mono font-bold text-slate-700 uppercase mb-1">
                      Reason for Extension *
                    </label>
                    <input
                      type="text"
                      required
                      value={extensionReason}
                      onChange={(e) => setExtensionReason(e.target.value)}
                      placeholder="e.g. Waiting for delivery of replacement compressor / Weather delays..."
                      className="w-full text-xs font-sans px-3 py-2 border border-[#E6DDD3] rounded-lg bg-[#FBF9F6] text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#6B1420]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsExtendingDeadline(false)}
                      className="px-3 py-1.5 text-xs font-mono text-slate-600 hover:text-slate-800 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyExtension}
                      disabled={extensionBusy || !extensionReason.trim()}
                      className="px-4 py-1.5 bg-[#6B1420] hover:bg-[#541019] text-white rounded-lg text-xs font-mono font-bold cursor-pointer disabled:opacity-50 shadow-xs"
                    >
                      {extensionBusy ? "Extending..." : "Confirm Extension"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Description Section */}
            <div className="space-y-2">
              <span className="text-xs font-mono tracking-widest text-slate-600 uppercase font-bold block">
                DETAILED ISSUE REPORT
              </span>
              <p className="text-sm text-[#4A322E] font-sans leading-relaxed bg-[#F5F1EC]/50 p-4 rounded-lg border border-[#F0EAE4]">
                {ticket.description}
              </p>
            </div>

            {/* Technician's completion remarks — visible to everyone once the job is done */}
            {isCompleted && (
              <div className="space-y-2">
                <span className="text-xs font-mono tracking-widest text-slate-600 uppercase font-bold flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> TECHNICIAN'S COMPLETION REMARKS
                </span>
                <p className="text-sm text-[#4A322E] font-sans leading-relaxed bg-emerald-50/60 p-4 rounded-lg border border-emerald-200 whitespace-pre-wrap">
                  {ticket.completionRemarks && ticket.completionRemarks.trim()
                    ? ticket.completionRemarks
                    : <span className="italic text-slate-500">No remarks were left by the technician.</span>}
                </p>
              </div>
            )}


            {/* Attached Photos, if the requester included any at submission */}
            {(ticket.photoUrls && ticket.photoUrls.length > 0
              ? ticket.photoUrls
              : ticket.photoUrl
                ? [ticket.photoUrl]
                : []
            ).length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-mono tracking-widest text-slate-600 uppercase font-bold block">
                    {(ticket.photoUrls?.length ?? (ticket.photoUrl ? 1 : 0)) > 1 ? "ATTACHED PHOTOS" : "ATTACHED PHOTO"}
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {(ticket.photoUrls && ticket.photoUrls.length > 0 ? ticket.photoUrls : [ticket.photoUrl!]).map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={url}
                          alt={`Attached photo ${i + 1} of the reported issue`}
                          className="max-h-64 w-auto rounded-lg border border-[#E6DDD3] object-contain bg-[#F5F1EC]/50 p-2"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

            <BudgetRequisitionItems
              items={ticket.budgetItems || []}
              total={ticket.budgetItemsTotal || 0}
              editable={isAdmin}
              onSave={
                isAdmin && onSaveBudgetItems
                  ? (items) => onSaveBudgetItems(ticket.id, items)
                  : undefined
              }
            />

            {/* Visual Priority Score Meter and Triage Variables */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">

              {/* Computed priority Dial (5 cols) */}
              <div className="md:col-span-5 border border-[#E6DDD3] rounded-lg p-4 flex flex-col justify-between bg-[#F5F1EC]/30">
                <div className="text-center">
                  <span className="text-xs font-mono tracking-widest text-slate-600 uppercase font-bold">
                    COMPUTED PRIORITY SCORE
                  </span>

                  {/* Big dial circle */}
                  <div className="my-4 relative flex items-center justify-center">
                    <div className="w-24 h-24 rounded-full border-4 border-[#F0EAE4] flex items-center justify-center relative">
                      <span className={`text-3xl sm:text-4xl font-mono font-black ${getPriorityTextClass(ticket.priorityScore)}`}>
                        {ticket.priorityScore}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs font-sans text-slate-700 font-semibold leading-normal">
                    Severity Rating: <span className={`${getPriorityTextClass(ticket.priorityScore)} uppercase font-bold`}>
                      {ticket.priorityScore >= 90 ? "Critical Backlog" : ticket.priorityScore >= 75 ? "Urgent Priority" : "Standard Queue"}
                    </span>
                  </p>
                </div>

                {/* Priority bar indicator */}
                <div className="mt-4">
                  <div className="w-full bg-[#E6DDD3] h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getPriorityColorClass(ticket.priorityScore)}`}
                      style={{ width: `${ticket.priorityScore}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs font-mono text-slate-600 mt-1">
                    <span>ROUTINE</span>
                    <span>CRITICAL</span>
                  </div>
                </div>
              </div>

              {/* Variable Audit Factor bars (7 cols) */}
              <div className="md:col-span-7 border border-[#E6DDD3] rounded-lg p-4 space-y-4">
                <span className="text-xs font-mono tracking-widest text-slate-600 uppercase font-bold block">
                  INTELLIGENCE CONTROL ROOM VARIABLES
                </span>

                <div className="space-y-3">
                  {/* Safety Risk */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="flex items-center gap-1.5 text-[#4A322E]">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                        Safety Risk Rating
                      </span>
                      <span className="text-rose-500 font-mono font-bold">
                        {ticket.safetyRisk}/5 — {getRiskLabel(ticket.safetyRisk)}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`flex-1 h-1.5 rounded-sm transition-all ${level <= ticket.safetyRisk
                            ? "bg-rose-500"
                            : "bg-[#E6DDD3]"
                            }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Operational Impact */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="flex items-center gap-1.5 text-[#4A322E]">
                        <Activity className="w-3.5 h-3.5 text-cyan-accent" />
                        Operational Impact
                      </span>
                      <span className="text-cyan-accent font-mono font-bold">
                        {ticket.operationalImpact}/5
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`flex-1 h-1.5 rounded-sm transition-all ${level <= ticket.operationalImpact
                            ? "bg-[#8C2331]"
                            : "bg-[#E6DDD3]"
                            }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Urgency */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="flex items-center gap-1.5 text-[#4A322E]">
                        <Clock className="w-3.5 h-3.5 text-safety-amber" />
                        Urgency Multiplier
                      </span>
                      <span className="text-safety-amber font-mono font-bold">
                        {ticket.urgency}/5
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`flex-1 h-1.5 rounded-sm transition-all ${level <= ticket.urgency
                            ? "bg-safety-amber"
                            : "bg-[#E6DDD3]"
                            }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Demographics, Staff and Cost breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              {/* Estimated workforce size */}
              <div className="border border-[#E6DDD3] p-3.5 rounded-lg text-center bg-[#F5F1EC]/20">
                <span className="text-xs font-mono tracking-wider text-slate-600 uppercase font-bold block">
                  ESTIMATED WORKFORCE
                </span>
                <div className="flex items-center justify-center gap-1.5 text-[#2B1210] mt-1">
                  <Users className="w-4 h-4 text-slate-600" />
                  <span className="text-lg font-mono font-bold">{ticket.peopleAffected}</span>
                </div>
                <span className="text-sm text-slate-700">estimated number of people working on this request</span>
              </div>

              {/* Cost — label reflects actual status (estimate vs. final) rather
                than always saying "ESTIMATED COST", which would mislabel a
                Finance-approved final amount as a mere estimate. */}
              <div className="border border-[#E6DDD3] p-3.5 rounded-lg text-center bg-[#F5F1EC]/20">
                <span className="text-xs font-mono tracking-wider text-slate-600 uppercase font-bold block">
                  {getJobOrderCostDisplay(ticket).label}
                </span>
                <div className="flex items-center justify-center gap-1 text-[#2B1210] mt-1">
                  <span className="w-4 h-4 flex items-center justify-center text-slate-600 font-bold text-base leading-none">₱</span>
                  <span className="text-lg font-mono font-bold">{formatPeso(getJobOrderCost(ticket) ?? 0).replace("₱", "")}</span>
                </div>
                <span className="text-sm text-slate-700">
                  {getJobOrderCostDisplay(ticket).status === "final"
                    ? "materials & labor, Finance-approved final amount"
                    : getJobOrderCostDisplay(ticket).status === "estimated"
                      ? "materials & labor, PPO's current best estimate"
                      : "awaiting PPO's initial cost estimate"}
                </span>
              </div>

              {/* Date Logged */}
              <div className="border border-[#E6DDD3] p-3.5 rounded-lg text-center bg-[#F5F1EC]/20">
                <span className="text-xs font-mono tracking-wider text-slate-600 uppercase font-bold block">
                  DATE LOGGED
                </span>
                <div className="flex items-center justify-center gap-1.5 text-[#2B1210] mt-1">
                  <Calendar className="w-4 h-4 text-slate-600" />
                  <span className="text-[13px] font-mono font-bold">
                    {new Date(ticket.dateSubmitted).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <span className="text-sm text-slate-700">
                  {new Date(ticket.dateSubmitted).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            {/* Real monetary costs and approved amounts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-[#E6DDD3] p-4 rounded-lg bg-[#F5F1EC]/40">
              <div>
                <span className="text-xs font-mono tracking-wider text-slate-600 uppercase font-bold block">
                  PPO COST ESTIMATE
                </span>
                <div className="text-lg font-mono font-bold text-[#2B1210] mt-1">
                  {ticket.estimatedCost !== undefined ? `₱${ticket.estimatedCost.toLocaleString()}` : "Awaiting Physical Plant Estimate"}
                </div>
                <span className="text-sm text-slate-700 block mt-0.5">
                  Computed average based on job specifics
                </span>
              </div>
              <div>
                <span className="text-xs font-mono tracking-wider text-slate-600 uppercase font-bold block">
                  APPROVED FUNDING AMOUNT
                </span>
                <div className={`text-lg font-mono font-bold mt-1 ${ticket.approvedAmount !== undefined ? "text-emerald-600" : "text-slate-700"}`}>
                  {ticket.approvedAmount !== undefined ? `₱${ticket.approvedAmount.toLocaleString()}` : "Awaiting Finance Approval"}
                </div>
                <span className="text-sm text-slate-700 block mt-0.5">
                  Released amount by Finance Office
                </span>
              </div>
            </div>

            {/* Matched Maintenance Staff & Allocation */}
            <div className="border border-[#E6DDD3] p-4 rounded-xl bg-white shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <span className="text-xs font-mono tracking-widest text-slate-600 uppercase font-bold block">
                  MATCHED MAINTENANCE STAFF &amp; DISPATCH ALLOCATION
                </span>
                {isAdmin && ticket.status !== "Completed" && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditingDispatch) {
                        setIsEditingDispatch(false);
                      } else {
                        handleOpenDispatchEditor();
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-[#7C1D2D]/10 hover:bg-[#7C1D2D]/20 text-[#7C1D2D] transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    {isEditingDispatch ? "Close Staff Editor" : "Override / Edit Staff"}
                  </button>
                )}
              </div>

              {overrideSuccess && (
                <div className="mb-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-mono text-emerald-800 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{overrideSuccess}</span>
                </div>
              )}

              {overrideError && (
                <div className="mb-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-mono text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{overrideError}</span>
                </div>
              )}

              {/* Edit Mode */}
              {isEditingDispatch ? (
                <div className="bg-[#FAF7F5] border border-[#DDD2C8] rounded-xl p-4 space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-[#E6DDD3] pb-2">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-[#7C1D2D]" />
                      <h5 className="font-semibold text-xs font-mono uppercase tracking-wider text-[#2B1210]">
                        Dispatch Override &amp; Maintenance Team Configuration
                      </h5>
                    </div>
                    {isLoadingCandidates && (
                      <span className="text-[11px] font-mono text-slate-500 animate-pulse">
                        Loading match recommendations…
                      </span>
                    )}
                  </div>

                  {/* 1. Lead Technician Selection */}
                  <div>
                    <label className="block text-xs font-mono uppercase text-slate-700 font-bold mb-1">
                      Lead Technician / Assigned Specialist <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={editLeadStaff}
                      onChange={(e) => handleSetLead(e.target.value)}
                      className="w-full bg-white border border-[#DDD2C8] rounded-lg p-2.5 text-xs text-[#2B1210] focus:outline-none focus:border-[#7C1D2D] font-sans"
                    >
                      <option value="Outsource">Recommend Outsource (Specialized External Service)</option>
                      {candidates.length > 0 ? (
                        candidates.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name} — {c.specialty} ({c.matchScore}% Match){c.isAtCapacity ? ` ⚠️ Over Capacity (${c.activeTaskCount}/${c.limit})` : ` (${c.activeTaskCount}/${c.limit} tasks)`}
                          </option>
                        ))
                      ) : staffRoster && staffRoster.length > 0 ? (
                        staffRoster.map((s) => (
                          <option key={s.name} value={s.name}>
                            {s.name} ({s.specialty})
                          </option>
                        ))
                      ) : (
                        <option value={ticket.assignedStaff}>{ticket.assignedStaff}</option>
                      )}
                    </select>
                  </div>

                  {/* 2. Dispatched Team Roster (Multi-person Team) */}
                  {editLeadStaff !== "Outsource" && (
                    <div className="space-y-3 pt-2 border-t border-[#E6DDD3]">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-mono uppercase text-slate-700 font-bold">
                          Assigned Maintenance Team Roster ({editTeam.length} Technicians)
                        </label>
                        <span className="text-[11px] font-mono text-slate-500">
                          {editTeam.length > 1 ? "Multi-technician team" : "Solo technician"}
                        </span>
                      </div>

                      {/* Team Member Badges */}
                      <div className="flex flex-wrap gap-2">
                        {editTeam.map((member) => (
                          <span
                            key={member.id}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono shadow-xs ${
                              member.isLead
                                ? "bg-[#7C1D2D] text-white font-bold"
                                : "bg-white text-[#2B1210] border border-[#DDD2C8]"
                            }`}
                          >
                            <User className="w-3.5 h-3.5" />
                            <span>{member.name}</span>
                            {member.isLead ? (
                              <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-normal">Lead</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSetLead(member.name)}
                                title="Set as Lead Technician"
                                className="text-[10px] text-cyan-700 hover:underline px-1 font-semibold cursor-pointer"
                              >
                                Set Lead
                              </button>
                            )}
                            {member.matchScore > 0 && (
                              <span className="text-[10px] opacity-80">({member.matchScore}%)</span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveStaffFromTeam(member.id)}
                              title={`Remove ${member.name} from team`}
                              className="ml-1 hover:text-red-600 transition-colors p-0.5 rounded cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ))}
                        {editTeam.length === 0 && (
                          <span className="text-xs text-slate-500 font-sans italic">
                            No team members added yet. Pick a lead technician or add matched staff below.
                          </span>
                        )}
                      </div>

                      {/* Add Matched Maintenance Staff Picker */}
                      <div className="bg-white border border-[#E6DDD3] rounded-lg p-3 space-y-2 mt-2 w-full max-w-full overflow-hidden">
                        <span className="text-xs font-mono font-bold uppercase text-slate-700 flex items-center gap-1.5">
                          <UserPlus className="w-3.5 h-3.5 text-[#7C1D2D]" />
                          Add Matched Maintenance Staff to Team
                        </span>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
                          <select
                            value={selectedAddStaffId}
                            onChange={(e) => setSelectedAddStaffId(e.target.value)}
                            className="flex-1 min-w-0 w-full bg-[#FAF7F5] border border-[#DDD2C8] rounded-lg p-2 text-xs text-[#2B1210] focus:outline-none focus:border-[#7C1D2D] font-sans truncate"
                          >
                            <option value="">— Select a matched technician to add —</option>
                            {candidates
                              .filter((c) => !editTeam.some((m) => m.id === c.id))
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} ({c.specialty}) — {c.matchScore}% Accuracy {c.isAtCapacity ? `[⚠️ At Capacity: ${c.activeTaskCount}/${c.limit}]` : `[${c.activeTaskCount}/${c.limit} active]`}
                                </option>
                              ))}
                            {candidates.length === 0 && staffRoster && staffRoster
                              .filter((s) => s.id && !editTeam.some((m) => m.id === s.id))
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name} ({s.specialty})
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            disabled={!selectedAddStaffId}
                            onClick={handleAddStaffToTeam}
                            className="shrink-0 whitespace-nowrap px-4 py-2 bg-[#7C1D2D] hover:bg-[#7C1D2D]/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-mono font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Staff
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. Priority Override Index */}
                  <div className="pt-2 border-t border-[#E6DDD3]">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-mono uppercase text-slate-700 font-bold">Priority Score Index</label>
                      <span className="font-mono text-[#7C1D2D] font-bold text-xs bg-[#7C1D2D]/10 px-2 py-0.5 rounded">
                        {editPriorityScore} / 100
                      </span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={editPriorityScore}
                      onChange={(e) => setEditPriorityScore(Number(e.target.value))}
                      className="w-full accent-[#7C1D2D] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                      <span>10 (MIN)</span>
                      <span>50 (NORMAL)</span>
                      <span>75 (URGENT)</span>
                      <span>100 (CRITICAL)</span>
                    </div>
                  </div>

                  {/* 4. Override Rationale */}
                  <div className="pt-2 border-t border-[#E6DDD3]">
                    <label className="block text-xs font-mono uppercase text-slate-700 font-bold mb-1">
                      Override Explanation / Rationale <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      value={editRationale}
                      onChange={(e) => setEditRationale(e.target.value)}
                      placeholder="e.g. Reassigned to specialist team given height safety requirements and multi-point electrical fault..."
                      rows={2}
                      className="w-full bg-white border border-[#DDD2C8] rounded-lg p-2.5 text-xs text-[#2B1210] focus:outline-none focus:border-[#7C1D2D] resize-none placeholder-slate-400 font-sans"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-2 border-t border-[#E6DDD3]">
                    <button
                      type="button"
                      onClick={() => setIsEditingDispatch(false)}
                      className="px-3 py-1.5 border border-[#DDD2C8] rounded-lg text-xs font-mono text-slate-600 hover:text-black cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSavingOverride || !editRationale.trim()}
                      onClick={handleSaveDispatchOverride}
                      className="px-4 py-1.5 bg-[#7C1D2D] hover:bg-[#7C1D2D]/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-mono font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      {isSavingOverride ? "Saving Override…" : "Save Override"}
                    </button>
                  </div>
                </div>
              ) : (
                /* Normal Read View */
                <div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#FAF7F5] border border-[#E6DDD3] flex items-center justify-center text-slate-700">
                        {ticket.assignedStaff === "Outsource" ? (
                          <AlertTriangle className="w-5 h-5 text-safety-amber" />
                        ) : (
                          <User className="w-5 h-5 text-[#7C1D2D]" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-semibold text-sm text-[#2B1210]">
                            {ticket.assignedStaff}
                          </h5>
                          {ticket.assignedStaffList && ticket.assignedStaffList.find(s => s.name === ticket.assignedStaff)?.isLead && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#7C1D2D]/10 text-[#7C1D2D] font-bold">
                              Lead Technician
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 font-sans mt-0.5">
                          {ticket.assignedStaff === "Outsource"
                            ? "Outsourced to industrial specialists due to certification requirements."
                            : `Assigned specialist for ${ticket.jobType} maintenance.`}
                        </p>
                      </div>
                    </div>

                    {ticket.assignedStaff !== "Outsource" && ticket.matchScore > 0 && (
                      <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-right shrink-0">
                        <span className="text-[10px] font-mono text-emerald-700 uppercase font-bold block">SPECIALTY MATCH</span>
                        <div className="flex items-center gap-1 justify-end text-emerald-800 font-mono font-bold text-sm mt-0.5">
                          <Star className="w-3.5 h-3.5 fill-current text-emerald-600" />
                          <span>{ticket.matchScore}% Accuracy</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Multi-person team roster if assigned */}
                  {ticket.assignedStaffList && ticket.assignedStaffList.length > 1 && (
                    <div className="mt-3 pt-3 border-t border-[#F0EAE4]">
                      <span className="text-[11px] font-mono text-slate-500 uppercase font-bold block mb-2">
                        Dispatched Team Roster ({ticket.assignedStaffList.length} Technicians):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {ticket.assignedStaffList.map((member) => (
                          <span
                            key={member.id}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono ${
                              member.isLead
                                ? "bg-[#7C1D2D] text-white font-bold"
                                : "bg-[#F5F1EC] text-[#2B1210] border border-[#DDD2C8]"
                            }`}
                          >
                            <User className="w-3 h-3" />
                            {member.name} {member.isLead && "(Lead)"}
                            <span className="text-[10px] opacity-75 font-normal">({member.matchScore}%)</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Action to Add Maintenance Staff for PPO */}
                  {isAdmin && ticket.status !== "Completed" && (
                    <div className="mt-3 pt-2.5 border-t border-[#F0EAE4] flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-sans">
                        Need another technician or want to reassign?
                      </span>
                      <button
                        type="button"
                        onClick={handleOpenDispatchEditor}
                        className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-[#7C1D2D] hover:underline cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        + Add / Override Staff
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Institutional Requisition Authorization Slip / Stamps */}
            <div className="space-y-2">
              <span className="text-xs font-mono tracking-widest text-slate-600 uppercase font-bold block">
                INSTITUTIONAL REQUISITION AUTHORIZATION SLIP
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Stamp 1: PPO */}
                <div className={`p-3 rounded-lg border text-center transition-colors ${ticket.ppoApproved
                  ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600"
                  : "bg-[#F5F1EC] border-[#E6DDD3] text-slate-600"
                  }`}>
                  <span className="text-xs font-mono font-bold tracking-wider uppercase block">1. Physical Plant Officer</span>
                  <div className="flex items-center justify-center gap-1.5 mt-2 h-5">
                    {ticket.ppoApproved ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-xs font-bold font-display uppercase tracking-tight">VERIFIED</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-xs font-mono font-medium">Awaiting Eval</span>
                      </>
                    )}
                  </div>
                  <span className="text-xs font-sans mt-2 block border-t border-[#E6DDD3]/50 pt-1 text-slate-700">
                    Engr. Lilibeth P. Gauma
                  </span>
                </div>

                {/* Stamp 2: School Head */}
                <div className={`p-3 rounded-lg border text-center transition-colors ${ticket.schoolHeadApproved
                  ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600"
                  : "bg-[#F5F1EC] border-[#E6DDD3] text-slate-600"
                  }`}>
                  <span className="text-xs font-mono font-bold tracking-wider uppercase block">2. Executive Endorsement</span>
                  <div className="flex items-center justify-center gap-1.5 mt-2 h-5">
                    {ticket.schoolHeadApproved ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-xs font-bold font-display uppercase tracking-tight">ENDORSED</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-xs font-mono font-medium">Awaiting Signature</span>
                      </>
                    )}
                  </div>
                  <span className="text-xs font-sans mt-2 block border-t border-[#E6DDD3]/50 pt-1 text-slate-700">
                    Rev. Fr. Nathaniel B. Gomez, Ph.D.
                  </span>
                </div>

                {/* Stamp 3: Finance Head */}
                <div className={`p-3 rounded-lg border text-center transition-colors ${ticket.financeApproved
                  ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600"
                  : "bg-[#F5F1EC] border-[#E6DDD3] text-slate-600"
                  }`}>
                  <span className="text-xs font-mono font-bold tracking-wider uppercase block">3. Finance Release</span>
                  <div className="flex items-center justify-center gap-1.5 mt-2 h-5">
                    {ticket.financeApproved ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-xs font-bold font-display uppercase tracking-tight">FUNDED</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-xs font-mono font-medium">Awaiting Release</span>
                      </>
                    )}
                  </div>
                  <span className="text-xs font-sans mt-2 block border-t border-[#E6DDD3]/50 pt-1 text-slate-700">
                    Ms. Mary Magdalene Z. Villegas, CPA
                  </span>
                </div>
              </div>
            </div>

            {/* Audit Notes/Logs Section */}
            {ticket.notes && (
              <div className="space-y-2">
                <span className="text-xs font-mono tracking-widest text-slate-600 uppercase font-bold block">
                  ADMINISTRATIVE AUDIT NOTES & REMEDIATION LOGS
                </span>
                <p className="text-sm text-slate-700 font-mono leading-relaxed bg-[#1A0E10]/5 p-3.5 rounded border border-[#E6DDD3] shadow-inner">
                  {ticket.notes}
                </p>
              </div>
            )}

            {/* Finance Officer Additional Notes Section */}
            {ticket.financeNotes && (
              <div className="space-y-2">
                <span className="text-xs font-mono tracking-widest text-slate-600 uppercase font-bold block">
                  FINANCE OFFICER ADDITIONAL NOTES / REMARKS
                </span>
                <p className="text-xs text-slate-600 font-sans leading-relaxed bg-[#1A0E10]/5 p-3.5 rounded border border-[#E6DDD3] shadow-inner italic">
                  "{ticket.financeNotes}"
                </p>
              </div>
            )}

            {ticket.dateCompleted && (
              <div className="flex items-center gap-2 text-xs text-soft-green font-mono font-bold bg-soft-green/5 p-3 rounded-lg border border-soft-green/15">
                <Check className="w-4 h-4" />
                <span>Job order fully resolved and certified on {new Date(ticket.dateCompleted).toLocaleDateString()} at {new Date(ticket.dateCompleted).toLocaleTimeString()}</span>
              </div>
            )}

          </div>

          {/* Footer Actions Panel */}
          <div className="p-4 sm:p-5 border-t border-[#E6DDD3] bg-[#FAF7F5] flex flex-col gap-3">

            {/* Row 1: Utilities (Print/Delete) on the left, PPO parameters on the right */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 h-8.5 px-3 rounded-lg bg-white border border-[#DDD2C8] hover:bg-[#F5F1EC] text-xs font-mono font-medium text-[#4A322E] transition-colors cursor-pointer shadow-2xs"
                  title="Print Job Ticket"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Print Job Ticket</span>
                </button>

                {isAdmin && onDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to permanently delete job order ${ticket.id}? This action cannot be undone.`)) {
                        onDelete(ticket.id);
                      }
                    }}
                    className="flex items-center gap-1.5 h-8.5 px-3 rounded-lg bg-white border border-red-200 text-red-600 font-mono text-xs hover:bg-red-50 hover:border-red-300 transition-colors cursor-pointer shadow-2xs"
                    title="Delete Request"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Request</span>
                  </button>
                )}
              </div>

              {/* PPO Quick Settings (Emergency & Cost Estimate) */}
              {isAdmin && !ticket.ppoApproved && (
                <div className="flex items-center gap-2">
                  {!ticket.isEmergency && (
                    <label className="flex items-center gap-1.5 text-xs font-mono text-amber-900 bg-amber-500/10 border border-amber-500/25 rounded-lg px-2.5 h-8.5 cursor-pointer select-none hover:bg-amber-500/15 transition-colors">
                      <input
                        type="checkbox"
                        checked={modalEmergencyOverride}
                        onChange={(e) => setModalEmergencyOverride(e.target.checked)}
                        className="accent-amber-600 cursor-pointer"
                      />
                      <span>Treat as emergency</span>
                    </label>
                  )}
                  <div className="flex items-center bg-white border border-[#DDD2C8] rounded-lg px-2.5 h-8.5 shadow-2xs focus-within:border-[#7C1D2D] transition-colors">
                    <span className="text-xs text-slate-500 font-mono mr-1 select-none font-semibold">Est ₱</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      className="w-20 bg-transparent text-[#2B1210] text-xs font-mono font-medium focus:outline-none"
                      value={modalPpoCost}
                      onChange={(e) => setModalPpoCost(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Row 2: Decisive Actions */}
            {isAdmin && (
              <>
                {/* School Head (President) Endorsement */}
                {ticket.ppoApproved && !ticket.schoolHeadApproved && onSchoolHeadApprove && (
                  <button
                    type="button"
                    onClick={() => {
                      onSchoolHeadApprove(ticket.id);
                      onClose();
                    }}
                    className="flex items-center justify-center gap-1.5 h-10 w-full rounded-lg bg-red-600 hover:bg-red-700 text-white font-mono font-bold text-xs transition-all cursor-pointer shadow-sm active:scale-[0.99]"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Endorse as President
                  </button>
                )}

                {/* PPO Verify & Approve */}
                {!ticket.ppoApproved && (
                  <div className="flex items-center gap-2.5 w-full">
                    <button
                      type="button"
                      onClick={() => {
                        const est = modalPpoCost.trim() !== "" ? Number(modalPpoCost) : undefined;
                        onApprove?.(ticket.id, est, ticket.isEmergency || modalEmergencyOverride);
                        onClose();
                      }}
                      className="flex-1 flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-[#7C1D2D] hover:bg-[#661623] text-white font-mono font-bold text-xs transition-all cursor-pointer shadow-sm active:scale-[0.99]"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Verify &amp; Approve (PPO)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onOverride?.(ticket.id);
                        onClose();
                      }}
                      className="shrink-0 flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-white border border-[#DDD2C8] hover:bg-[#FAF7F5] font-mono font-bold text-xs text-[#7C1D2D] transition-all cursor-pointer shadow-2xs active:scale-[0.99]"
                      title="Override assigned staff, priority, or details"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Override</span>
                    </button>
                  </div>
                )}
              </>
            )}

            {onUpdateStatus && (
              <>
                {ticket.status === "Pending" && (
                  <button
                    onClick={() => {
                      onUpdateStatus(ticket.id, "In Progress");
                      onClose();
                    }}
                    className="flex items-center justify-center gap-1.5 h-10 w-full rounded-lg bg-[#8C2331] text-white font-mono font-bold text-xs hover:bg-[#8C2331]/85 transition-colors cursor-pointer shadow-sm"
                  >
                    <Wrench className="w-4 h-4" />
                    Start Work Now
                  </button>
                )}
                {ticket.status === "In Progress" && (
                  <button
                    onClick={() => {
                      onUpdateStatus(ticket.id, "Completed");
                      onClose();
                    }}
                    className="flex items-center justify-center gap-1.5 h-10 w-full rounded-lg bg-emerald-600 text-white font-mono font-bold text-xs hover:bg-emerald-700 transition-colors cursor-pointer shadow-sm"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Mark Ticket Completed
                  </button>
                )}
              </>
            )}

            {onFinanceApprove && ticket.ppoApproved && ticket.schoolHeadApproved && !ticket.financeApproved && (
              <div className="flex flex-col gap-2.5 w-full bg-[#F0EAE4]/60 border border-[#E6DDD3]/50 rounded-xl p-3.5">
                <div className="text-xs uppercase font-mono font-bold tracking-wider text-slate-600">
                  Finance Funding Allocation &amp; Remarks
                </div>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="flex gap-2 shrink-0">
                    <div className="flex items-center bg-white border border-[#E6DDD3] rounded-lg px-2.5 h-9 w-[115px]">
                      <span className="text-sm text-slate-500 font-mono mr-1.5 shrink-0">Est ₱</span>
                      <input
                        type="number"
                        placeholder="Est"
                        className="w-full bg-transparent text-[#2B1210] text-xs font-mono focus:outline-none"
                        value={modalFinanceEst}
                        onChange={(e) => {
                          const val = e.target.value;
                          setModalFinanceEst(val);
                          if (!modalFinanceAppr) {
                            setModalFinanceAppr(val);
                          }
                        }}
                      />
                    </div>
                    <div className="flex items-center bg-white border border-[#E6DDD3] rounded-lg px-2.5 h-9 w-[115px]">
                      <span className="text-sm text-slate-500 font-mono mr-1.5 shrink-0">Appr ₱</span>
                      <input
                        type="number"
                        placeholder="Appr"
                        className="w-full bg-transparent text-[#2B1210] text-xs font-mono focus:outline-none"
                        value={modalFinanceAppr}
                        onChange={(e) => setModalFinanceAppr(e.target.value)}
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Type notes or any additional information for this request..."
                    className="flex-1 bg-white border border-[#E6DDD3] rounded-lg px-3 h-9 text-xs font-sans text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-400"
                    value={modalFinanceNotes}
                    onChange={(e) => setModalFinanceNotes(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => {
                    onFinanceApprove(ticket.id, Number(modalFinanceAppr), Number(modalFinanceEst), modalFinanceNotes);
                    onClose();
                  }}
                  className="flex items-center justify-center gap-1.5 h-10 w-full rounded-lg bg-emerald-600 text-white font-mono font-bold text-xs hover:bg-emerald-700 transition-colors cursor-pointer shadow-sm"
                >
                  <span className="w-4 h-4 flex items-center justify-center font-bold text-base leading-none">₱</span>
                  Approve &amp; Fund
                </button>
              </div>
            )}

          </div>

        </div>
      </div>

      <PrintableJobOrder ticket={ticket} />
    </>
  );
};