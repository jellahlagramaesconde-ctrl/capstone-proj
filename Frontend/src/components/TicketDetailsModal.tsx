import React, { useState, useEffect } from "react";
import { JobOrder } from "../types";
import { getJobOrderCost, getJobOrderCostDisplay, formatPeso } from "../priceUtils";
import { PrintableJobOrder } from "./PrintableJobOrder";
import {
  X,
  Calendar,
  MapPin,
  User,
  Clock,
  Sparkles,
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
  Trash2
} from "lucide-react";
interface TicketDetailsModalProps {
  isOpen: boolean;
  ticket: JobOrder | null;
  onClose: () => void;
  isAdmin?: boolean;
  onApprove?: (ticketId: string, estimatedCost?: number, emergencyOverride?: boolean) => void;
  onOverride?: (ticketId: string) => void;
  onUpdateStatus?: (ticketId: string, status: "Pending" | "In Progress" | "Completed") => void;
  onFinanceApprove?: (ticketId: string, approvedAmount?: number, estimatedCost?: number, financeNotes?: string) => void;
  onSchoolHeadApprove?: (ticketId: string) => void;
  onDelete?: (ticketId: string) => void;
  onSaveBudgetItems?: (ticketId: string, items: { qty: number; unit?: string; description: string; unitCost: number }[]) => Promise<void>; // ADD THIS
}

export const TicketDetailsModal: React.FC<TicketDetailsModalProps> = ({
  isOpen,
  ticket,
  onClose,
  isAdmin = false,
  onApprove,
  onOverride,
  onUpdateStatus,
  onFinanceApprove,
  onSchoolHeadApprove,
  onDelete,
  onSaveBudgetItems, // ADD THIS
}) => {
  if (!isOpen || !ticket) return null;

  // Local states for inputs in the modal
  const [modalPpoCost, setModalPpoCost] = useState<string>("");
  const [modalFinanceEst, setModalFinanceEst] = useState<string>("");
  const [modalFinanceAppr, setModalFinanceAppr] = useState<string>("");
  const [modalFinanceNotes, setModalFinanceNotes] = useState<string>("");
  const [modalEmergencyOverride, setModalEmergencyOverride] = useState<boolean>(false);

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
    }
  }, [ticket, isOpen]);

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
    window.print();
  };

  return (
    <>
      <div className="fixed inset-0 bg-[#241012]/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto">
        {/* Modal Container */}
        <div className="bg-white border border-[#E6DDD3] rounded-t-xl sm:rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[95vh] sm:max-h-[90vh] sm:my-8">

          {/* Header - Styled like an official physical plant requisition form header */}
          <div className="p-3.5 sm:p-5 border-b border-[#E6DDD3] bg-[#F5F1EC] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded bg-[#6B1420]/10 text-[#6B1420]">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#6B1420] uppercase tracking-wider">
                    COSCA Facilities Workorder
                  </span>
                  <span className="text-xs bg-[#E6DDD3] px-2 py-0.5 rounded-sm font-mono font-bold text-slate-600">
                    {ticket.id}
                  </span>
                </div>
                <h3 className="font-display font-semibold text-lg text-[#241012] mt-0.5">
                  Requisition Details Sheet
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-600 hover:text-[#241012] hover:bg-[#F0EAE4] transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Form Body */}
          <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 overflow-y-auto flex-1">

            {/* Emergency bypass banner — shown to every role (PPO, School Head,
              Finance, Dept, Staff) so it's never ambiguous that School Head
              and Finance sign-off was auto-set rather than genuinely reviewed. */}
            {ticket.emergencyBypassed && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-sm font-sans leading-relaxed">
                  <span className="font-bold text-red-700">Emergency Bypass — PPO Approved Directly.</span>
                  <span className="text-red-700/90">
                    {" "}This request skipped normal School Head and Finance review. The Physical
                    Plant Officer approved it under the emergency protocol and dispatched staff
                    immediately. School Head/Finance sign-off shown below was auto-recorded, not
                    a manual endorsement.
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

            {/* Description Section */}
            <div className="space-y-2">
              <span className="text-xs font-mono tracking-widest text-slate-600 uppercase font-bold block">
                DETAILED ISSUE REPORT
              </span>
              <p className="text-sm text-[#4A322E] font-sans leading-relaxed bg-[#F5F1EC]/50 p-4 rounded-lg border border-[#F0EAE4]">
                {ticket.description}
              </p>
            </div>

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
                      <span className={`text-4xl font-mono font-black ${getPriorityTextClass(ticket.priorityScore)}`}>
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

            {/* Allocation & Assigned Staff */}
            <div className="border border-[#E6DDD3] p-4 rounded-lg bg-[#F5F1EC]">
              <span className="text-xs font-mono tracking-widest text-slate-600 uppercase font-bold block mb-3">
                DISPATCH & REQUISITION ALLOCATION
              </span>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white border border-[#E6DDD3] flex items-center justify-center text-slate-700">
                    {ticket.assignedStaff === "Outsource" ? (
                      <AlertTriangle className="w-5 h-5 text-safety-amber" />
                    ) : (
                      <User className="w-5 h-5 text-[#6B1420]" />
                    )}
                  </div>
                  <div>
                    <h5 className="font-semibold text-sm text-[#2B1210]">
                      {ticket.assignedStaff}
                    </h5>
                    <p className="text-sm text-slate-700 font-sans mt-0.5">
                      {ticket.assignedStaff === "Outsource"
                        ? "Outsourced to industrial specialists due to certification requirements."
                        : "Internal Physical Plant Maintenance Roster Specialist."}
                    </p>
                  </div>
                </div>

                {ticket.assignedStaff !== "Outsource" && ticket.matchScore > 0 && (
                  <div className="bg-[#6B1420]/10 border border-[#6B1420]/20 p-2 rounded-lg text-right">
                    <span className="text-xs font-mono text-slate-600 uppercase block">SPECIALTY MATCH</span>
                    <div className="flex items-center gap-1 justify-end text-[#6B1420] font-mono font-bold text-sm mt-0.5">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>{ticket.matchScore}% Accuracy</span>
                    </div>
                  </div>
                )}
              </div>
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
          <div className="p-5 border-t border-[#E6DDD3] bg-[#F5F1EC] flex flex-col gap-3">

            {/* Row 1: Secondary actions — Print & Delete */}
            <div className="flex items-center justify-between">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-white border border-[#E6DDD3] hover:bg-[#F0EAE4] text-xs font-mono text-[#4A322E] transition-colors cursor-pointer shadow-xs"
              >
                <Printer className="w-4 h-4" />
                Print Job Ticket
              </button>

              {isAdmin && onDelete && (
                <button
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to permanently delete job order ${ticket.id}? This action cannot be undone.`)) {
                      onDelete(ticket.id);
                    }
                  }}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-white border border-red-200 text-red-500 font-mono text-xs hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Request
                </button>
              )}
            </div>

            {/* Row 2: Primary workflow actions */}
            {isAdmin && (
              <>
                {/* School Head (President) Endorsement */}
                {ticket.ppoApproved && !ticket.schoolHeadApproved && onSchoolHeadApprove && (
                  <button
                    onClick={() => {
                      onSchoolHeadApprove(ticket.id);
                      onClose();
                    }}
                    className="flex items-center justify-center gap-1.5 h-10 w-full rounded-lg bg-red-600 hover:bg-red-700 text-white font-mono font-bold text-xs transition-all cursor-pointer shadow-sm"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Endorse as President
                  </button>
                )}

                {/* PPO Verify & Approve */}
                {!ticket.ppoApproved && (
                  <div className="flex flex-col gap-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {!ticket.isEmergency && (
                        <label className="flex items-center gap-1.5 text-xs font-mono text-safety-amber bg-safety-amber/10 border border-safety-amber/20 rounded-lg px-3 h-9 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={modalEmergencyOverride}
                            onChange={(e) => setModalEmergencyOverride(e.target.checked)}
                            className="accent-safety-amber cursor-pointer"
                          />
                          Treat as emergency
                        </label>
                      )}
                      <div className="flex items-center bg-white border border-[#E6DDD3] rounded-lg px-2.5 h-9">
                        <span className="text-sm text-slate-500 font-mono mr-1">Est ₱</span>
                        <input
                          type="number"
                          placeholder="Cost"
                          className="w-16 bg-transparent text-[#2B1210] text-xs font-mono focus:outline-none"
                          value={modalPpoCost}
                          onChange={(e) => setModalPpoCost(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const est = modalPpoCost ? Number(modalPpoCost) : undefined;
                          onApprove?.(ticket.id, est, ticket.isEmergency || modalEmergencyOverride);
                          onClose();
                        }}
                        className="flex items-center justify-center gap-1.5 h-10 flex-1 rounded-lg bg-[#6B1420] text-white font-mono font-bold text-xs hover:bg-[#7D1A28] transition-all cursor-pointer shadow-sm"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Verify &amp; Approve (PPO)
                      </button>
                      <button
                        onClick={() => {
                          onOverride?.(ticket.id);
                          onClose();
                        }}
                        className="flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-safety-amber/10 border border-safety-amber/20 hover:bg-safety-amber/20 font-mono font-bold text-xs text-safety-amber transition-all cursor-pointer"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Override
                      </button>
                    </div>
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