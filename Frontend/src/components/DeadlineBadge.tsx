import React, { useEffect, useState } from "react";
import { Clock, Calendar, AlertTriangle, ChevronRight } from "lucide-react";

interface DeadlineBadgeProps {
  severity?: "Regular" | "Moderate" | "Emergency";
  deadline?: string;            // ISO timestamp
  isCompleted?: boolean;
  status?: "Pending" | "In Progress" | "Completed" | "Denied" | "Suspended";
  /** If provided, renders an "Extend" button (PPO-only use) */
  onExtend?: () => void;
  /** Show compact version (no label text, just icon + time) */
  compact?: boolean;
}

function formatCountdown(deadline: Date, isEmergency: boolean): string {
  const diffMs = deadline.getTime() - Date.now();
  if (diffMs <= 0) return "OVERDUE";

  const totalMinutes = Math.floor(diffMs / 60000);
  const totalHours   = Math.floor(diffMs / 3600000);
  const days         = Math.floor(diffMs / 86400000);

  if (isEmergency || totalHours < 24) {
    if (totalHours >= 1) {
      const mins = totalMinutes % 60;
      return mins > 0 ? `${totalHours}h ${mins}m left` : `${totalHours}h left`;
    }
    return `${totalMinutes}m left`;
  }
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

const SEVERITY_CONFIG = {
  Emergency: {
    label: "EMERGENCY",
    pill: "bg-red-100 text-red-700 border-red-300",
    icon: "🚨",
  },
  Moderate: {
    label: "MODERATE",
    pill: "bg-amber-100 text-amber-700 border-amber-300",
    icon: "⚠️",
  },
  Regular: {
    label: "REGULAR",
    pill: "bg-emerald-100 text-emerald-700 border-emerald-300",
    icon: "🟢",
  },
};

export const DeadlineBadge: React.FC<DeadlineBadgeProps> = ({
  severity = "Regular",
  deadline,
  isCompleted = false,
  status,
  onExtend,
  compact = false,
}) => {
  const [, setTick] = useState(0);

  const isSuspended = status === "Suspended";
  const isDenied = status === "Denied";
  const isDone = isCompleted || status === "Completed";
  const isInactive = isDone || isSuspended || isDenied;

  // Re-render every minute so the countdown stays live (if active)
  useEffect(() => {
    if (!deadline || isInactive) return;
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, [deadline, isInactive]);

  const cfg = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.Regular;

  if (!deadline) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${cfg.pill}`}>
        <span>{cfg.icon}</span>
        <span>{cfg.label}</span>
      </span>
    );
  }

  const deadlineDate = new Date(deadline);
  const isOverdue = !isInactive && deadlineDate.getTime() < Date.now();
  const countdown = isDenied
    ? "CANCELLED"
    : isSuspended
    ? "PAUSED"
    : isDone
    ? "Completed"
    : formatCountdown(deadlineDate, severity === "Emergency");

  if (compact) {
    return (
      <span
        title={`${cfg.label} · Deadline: ${deadlineDate.toLocaleString()}`}
        className={`inline-flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded-full border
          ${isOverdue
            ? "bg-red-100 text-red-700 border-red-400 animate-pulse"
            : isDenied
              ? "bg-slate-100 text-slate-500 border-slate-300 line-through"
              : isSuspended
                ? "bg-amber-100 text-amber-800 border-amber-300"
                : isDone
                  ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                  : cfg.pill}`}
      >
        <Clock className="w-3 h-3" />
        <span>{isOverdue ? "OVERDUE" : countdown}</span>
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Severity pill */}
      <span className={`inline-flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${cfg.pill}`}>
        <span>{cfg.icon}</span>
        <span>{cfg.label}</span>
      </span>

      {/* Countdown chip */}
      <span
        title={`Deadline: ${deadlineDate.toLocaleString()}`}
        className={`inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full border
          ${isOverdue
            ? "bg-red-100 text-red-700 border-red-400 font-bold animate-pulse"
            : isDenied
              ? "bg-slate-100 text-slate-500 border-slate-300 font-mono line-through"
              : isSuspended
                ? "bg-amber-100 text-amber-800 border-amber-300 font-mono font-semibold"
                : isDone
                  ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                  : "bg-slate-100 text-slate-600 border-slate-300"}`}
      >
        {isOverdue ? (
          <AlertTriangle className="w-3 h-3" />
        ) : (
          <Calendar className="w-3 h-3" />
        )}
        <span>{isOverdue ? "OVERDUE" : countdown}</span>
      </span>

      {/* PPO Extend button */}
      {onExtend && !isInactive && (
        <button
          type="button"
          onClick={onExtend}
          title="Extend deadline (PPO only)"
          className="inline-flex items-center gap-0.5 text-xs font-mono text-[#6B1420] hover:text-[#8C2331] underline underline-offset-2 cursor-pointer"
        >
          Extend
          <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};
