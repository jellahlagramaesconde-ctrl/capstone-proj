import React from "react";
import { JobOrder } from "../types";
import { getJobOrderCost, formatPeso, getJobOrderCostDisplay } from "../priceUtils";
import { AlertTriangle, CheckCircle, ShieldAlert, User, Users, ArrowRight, RefreshCw, Star } from "lucide-react";

interface TicketStubProps {
  ticket: JobOrder;
  isAdmin?: boolean;
  onApprove?: (ticketId: string, estimatedCost?: number) => void;
  onOverride?: (ticketId: string) => void;
  onUpdateStatus?: (ticketId: string, status: "Pending" | "In Progress" | "Completed") => void;
  onClick?: (ticketId: string) => void;
}

export const TicketStub: React.FC<TicketStubProps> = ({
  ticket,
  isAdmin = false,
  onApprove,
  onOverride,
  onUpdateStatus,
  onClick,
}) => {
  const isCompleted = ticket.status === "Completed";
  const isUrgent = ticket.priorityScore >= 75 && !isCompleted;

  // Define color bands based on status and priority
  let priorityColorClass = "bg-cyan-accent";
  let priorityBorderClass = "border-cyan-accent/20";
  let badgeColorClass = "bg-cyan-accent/10 text-cyan-accent";

  if (isCompleted) {
    priorityColorClass = "bg-soft-green";
    priorityBorderClass = "border-soft-green/20";
    badgeColorClass = "bg-soft-green/10 text-soft-green";
  } else if (isUrgent) {
    priorityColorClass = "bg-safety-amber";
    priorityBorderClass = "border-safety-amber/20";
    badgeColorClass = "bg-safety-amber/10 text-safety-amber";
  }

  // Determine priority rating label
  let priorityLabel = "NORMAL";
  if (isUrgent) priorityLabel = "URGENT";
  if (ticket.priorityScore >= 90 && !isCompleted) priorityLabel = "CRITICAL / SAFETY";

  return (
    <div
      onClick={() => onClick?.(ticket.id)}
      className={`relative flex flex-col sm:flex-row w-full border ${priorityBorderClass} rounded-lg bg-white overflow-hidden transition-all ${onClick ? "cursor-pointer hover:border-[#6B1420]/50 hover:shadow-md hover:translate-y-[-1px]" : ""
        } hover:bg-[#F5F1EC] h-full shadow-sm`}
    >
      {/* 1. Left colored edge indicator bar */}
      {/* Left colored edge indicator bar — horizontal strip on mobile, vertical bar on sm+ */}
      <div className={`h-1.5 sm:h-auto sm:w-3.5 ${priorityColorClass} shrink-0`} />

      {/* 2. Main Ticket Body */}
      <div className="flex-1 p-3.5 sm:p-5 sm:pr-4 flex flex-col justify-between min-w-0">
        <div>
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <span className="text-xs font-mono tracking-wider font-semibold text-slate-700 uppercase">
              {ticket.jobType}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${badgeColorClass}`}>
              {priorityLabel}
            </span>
            {ticket.isEmergency && (
              <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-safety-amber text-white animate-pulse">
                🚨 EMERGENCY
              </span>
            )}
          </div>

          {/* Office Name */}
          <h3 className="font-display font-semibold text-lg text-[#241012] group-hover:text-cyan-accent line-clamp-1">
            {ticket.office}
          </h3>

          {/* Issue Description */}
          <p className="text-sm text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
            {ticket.description}
          </p>
        </div>

        {/* Suggested Staff / Assignment Status — shows the whole dispatched
            team when a request needed more than one technician (PPO/AI
            decides team size per request based on urgency/safety risk/
            people affected), falling back to the single lead name for
            tickets that only ever had one. */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            {ticket.assignedStaffList && ticket.assignedStaffList.length > 1 ? (
              <>
                <Users className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <span className="text-slate-700 shrink-0">Team ({ticket.assignedStaffList.length}):</span>
                {ticket.assignedStaffList.map((member) => (
                  <span
                    key={member.id}
                    className="font-semibold text-[#2B1210] bg-[#F5F1EC] border border-[#E6DDD3] rounded px-1.5 py-0.5 flex items-center gap-1"
                    title={member.isLead ? "Team lead" : "Team member"}
                  >
                    {member.isLead && <Star className="w-2.5 h-2.5 fill-current text-cyan-accent" />}
                    {member.name}
                  </span>
                ))}
              </>
            ) : (
              <>
                <User className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <span className="text-slate-700 shrink-0">Assigned:</span>
                <span className={`font-semibold min-w-0 truncate ${ticket.assignedStaff === "Outsource" ? "text-safety-amber font-mono" : "text-[#2B1210]"}`}>
                  {ticket.assignedStaff}
                </span>
                {ticket.assignedStaff !== "Outsource" && ticket.matchScore > 0 && (
                  <span className="text-xs font-mono text-cyan-accent shrink-0 bg-cyan-accent/10 px-1.5 py-0.5 rounded ml-1 flex items-center gap-0.5">
                    <Star className="w-2.5 h-2.5 fill-current" /> {ticket.matchScore}%
                  </span>
                )}
              </>
            )}
          </div>

          {ticket.assignedStaff === "Outsource" && (
            <span className="text-xs bg-safety-amber/15 text-safety-amber px-2 py-0.5 rounded font-mono shrink-0">
              OUTSOURCE SUGGESTED
            </span>
          )}
        </div>
      </div>

      {/* Perforation simulated divider — hidden on mobile where card stacks vertically */}
      <div className="relative hidden sm:flex flex-col justify-between w-0 py-2 shrink-0">
        {/* Dashed line */}
        <div className="h-full border-r-2 border-dashed border-gray-600/40" />
        {/* Perforation holes (perforated paper feel) */}
        <div className="absolute top-0 -left-[6px] w-3 h-3 rounded-full bg-gray-100 border-b border-gray-300" />
        <div className="absolute bottom-0 -left-[6px] w-3 h-3 rounded-full bg-gray-100 border-t border-gray-300" />
      </div>

      {/* 3. Tear-off Stub Section */}
      {/* Tear-off stub — full width below card on mobile, fixed-width right column on sm+ */}
      <div className="w-full sm:w-40 sm:shrink-0 bg-[#F5F1EC] p-3.5 sm:p-5 flex flex-row sm:flex-col justify-between sm:justify-between items-center text-center border-t sm:border-t-0 border-dashed border-gray-300 gap-3 sm:gap-0">
        <div>
          {/* Ticket ID in corners */}
          <div className="font-mono text-xs font-bold text-slate-700 tracking-wider">
            {ticket.id}
          </div>

          {/* Status Badge */}
          <div className="mt-3">
            {ticket.status === "Completed" ? (
              <span className="inline-block text-sm font-mono font-medium px-2.5 py-1 rounded-full bg-soft-green/10 text-soft-green border border-soft-green/20">
                Completed
              </span>
            ) : ticket.status === "In Progress" ? (
              <span className="inline-block text-sm font-mono font-medium px-2.5 py-1 rounded-full bg-cyan-accent/10 text-cyan-accent border border-cyan-accent/20">
                In Progress
              </span>
            ) : !ticket.ppoApproved ? (
              <span className="inline-block text-sm font-mono font-medium px-2.5 py-1 rounded-full bg-[#E6DDD3] text-[#4A322E] border border-[#DDD2C8]">
                Pending PPO
              </span>
            ) : !ticket.schoolHeadApproved ? (
              <span className="inline-block text-sm font-mono font-medium px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 border border-red-500/20">
                Pending School Head
              </span>
            ) : (
              <span className="inline-block text-sm font-mono font-medium px-2.5 py-1 rounded-full bg-[#6B1420]/15 text-[#6B1420] border border-[#6B1420]/25">
                Pending Finance
              </span>
            )}
          </div>

          {/* Cost of this job order */}
          <div className="mt-3 text-center">
            {(() => {
              const costDisplay = getJobOrderCostDisplay(ticket);
              return (
                <>
                  <span className="text-xs font-mono text-slate-600 uppercase tracking-wider block">
                    {costDisplay.label}
                  </span>
                  <span className={`text-sm font-mono ${costDisplay.status === 'pending' ? 'text-slate-500 italic text-xs' : costDisplay.status === 'final' ? 'font-bold text-emerald-700' : 'font-bold text-[#6B1420]'}`}>
                    {costDisplay.text}
                  </span>
                </>
              );
            })()}
          </div>
        </div>

        {/* Bottom Actions or Scores */}
        <div className="w-full">
          {isAdmin ? (
            /* Admin controls: Approve or Override */
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove?.(ticket.id);
                }}
                title={
                  ticket.ppoApproved
                    ? "Verified & Approved by PPO"
                    : "Quick Verify & Approve (PPO)"
                }
                disabled={ticket.status === "Completed" || ticket.status === "In Progress" || ticket.ppoApproved}
                className={`p-1.5 rounded bg-cyan-accent/10 hover:bg-cyan-accent/20 text-cyan-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <CheckCircle className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOverride?.(ticket.id);
                }}
                title="Override and Reprioritize"
                className="p-1.5 rounded bg-safety-amber/10 hover:bg-safety-amber/20 text-safety-amber transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          ) : onUpdateStatus ? (
            /* Staff controls: Update status state togglers */
            <div className="flex flex-col gap-1 w-full">
              {ticket.status === "Pending" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateStatus(ticket.id, "In Progress");
                  }}
                  className="text-xs w-full bg-cyan-accent text-blueprint-navy font-bold py-1.5 px-2.5 rounded hover:bg-cyan-accent/80 transition-colors"
                >
                  Start Work
                </button>
              )}
              {ticket.status === "In Progress" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateStatus(ticket.id, "Completed");
                  }}
                  className="text-xs w-full bg-soft-green text-blueprint-navy font-bold py-1.5 px-2.5 rounded hover:bg-soft-green/80 transition-colors"
                >
                  Mark Done
                </button>
              )}
              {ticket.status === "Completed" && (
                <span className="text-xs font-mono text-soft-green">
                  Done!
                </span>
              )}
            </div>
          ) : (
            /* General users see the computed score as main stat stub */
            <div className="text-center">
              <div className="text-xs font-mono text-slate-700 uppercase">Priority Score</div>
              <div className="text-2xl font-mono font-bold text-[#2B1210] leading-none mt-1">
                {ticket.priorityScore}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};