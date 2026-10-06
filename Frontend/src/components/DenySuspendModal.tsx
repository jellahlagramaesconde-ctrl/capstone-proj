import React, { useState, useEffect } from "react";
import { X, Ban, PauseCircle, AlertTriangle, FileText } from "lucide-react";
import { JobOrder } from "../types";

export interface DenySuspendModalProps {
  isOpen: boolean;
  mode: "deny" | "suspend";
  ticket: JobOrder | null;
  actorRole?: string; // "PPO" | "President" | "Finance" | "Admin"
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}

// Role-specific preset suggestions for faster, consistent audit logging
const ROLE_PRESETS: Record<string, { deny: string[]; suspend: string[] }> = {
  PPO: {
    deny: [
      "Duplicate request already being addressed",
      "Out of Physical Plant maintenance scope",
      "Repair unfeasible — requires capital outlay replacement",
      "Lack of necessary materials or technical viability",
      "Insufficient request details or requester unreachable",
    ],
    suspend: [
      "Awaiting replacement parts / material delivery",
      "Safety clearance or hazard mitigation required",
      "Deferred due to ongoing campus activities or exam week",
      "Pending department site inspection or clarification",
    ],
  },
  President: {
    deny: [
      "Disapproved by School Administration",
      "Budget not authorized for this fiscal period",
      "Outside institutional priorities at this time",
      "Referred to department for internal realignment",
    ],
    suspend: [
      "Referred back to PPO for scope & cost re-evaluation",
      "Pending Executive Council review",
      "Deferred pending institutional budget confirmation",
    ],
  },
  Finance: {
    deny: [
      "Department maintenance budget exhausted",
      "Cost exceeds authorized ceiling for department",
      "Missing required canvass / quotation documentation",
      "Unapproved fund charge requested",
    ],
    suspend: [
      "Awaiting next quarter budget release",
      "Pending price quotation / canvass verification",
      "Awaiting funding source reallocation",
    ],
  },
};

export const DenySuspendModal: React.FC<DenySuspendModalProps> = ({
  isOpen,
  mode,
  ticket,
  actorRole = "PPO",
  onConfirm,
  onClose,
}) => {
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Normalize actor role for preset lookup
  const normalizedRole =
    actorRole === "President"
      ? "President"
      : actorRole === "Finance"
      ? "Finance"
      : "PPO";

  const presets =
    mode === "deny"
      ? ROLE_PRESETS[normalizedRole].deny
      : ROLE_PRESETS[normalizedRole].suspend;

  useEffect(() => {
    if (isOpen) {
      setRemarks("");
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, mode]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !ticket) return null;

  const isDeny = mode === "deny";
  const title = isDeny ? "Deny Request" : "Suspend Request (Place on Hold)";
  const actionNoun = isDeny ? "Denial" : "Suspension";

  const handleSelectPreset = (presetText: string) => {
    setRemarks(presetText);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRemarks = remarks.trim();
    if (cleanRemarks.length < 5) {
      setError("Please provide explanatory remarks (at least 5 characters) for accountability.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm(cleanRemarks);
      onClose();
    } catch (err: any) {
      setError(err?.message || `Failed to ${mode} this request. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-[#2B1210] flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between ${
            isDeny
              ? "bg-rose-50/80 border-rose-200"
              : "bg-amber-50/80 border-amber-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isDeny
                  ? "bg-rose-600 text-white shadow-sm shadow-rose-200"
                  : "bg-amber-500 text-white shadow-sm shadow-amber-200"
              }`}
            >
              {isDeny ? <Ban className="w-5 h-5" /> : <PauseCircle className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-slate-900 leading-tight">
                {title}
              </h3>
              <p className="text-xs font-mono text-slate-600 mt-0.5">
                Ticket: <strong className="text-slate-800">{ticket.id}</strong> ({ticket.office})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors disabled:opacity-50 cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-4">
          {/* Informational Callout */}
          <div
            className={`p-3.5 rounded-xl border text-xs flex gap-2.5 items-start ${
              isDeny
                ? "bg-rose-50/60 border-rose-200/80 text-rose-900"
                : "bg-amber-50/60 border-amber-200/80 text-amber-900"
            }`}
          >
            <AlertTriangle
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                isDeny ? "text-rose-600" : "text-amber-600"
              }`}
            />
            <div className="leading-relaxed font-sans">
              <strong>Accountability Note:</strong> Your remarks will be recorded in the{" "}
              <strong>Approval Audit Log</strong> under your account ({actorRole}), displayed
              on the request banner, and sent directly to the requesting department.
            </div>
          </div>

          {/* Quick-Select Presets */}
          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-700 mb-2">
              Common {actionNoun} Reasons (Click to use):
            </label>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset, idx) => {
                const isSelected = remarks === preset;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer font-sans ${
                      isSelected
                        ? isDeny
                          ? "bg-rose-100 border-rose-400 text-rose-900 font-medium shadow-2xs"
                          : "bg-amber-100 border-amber-400 text-amber-900 font-medium shadow-2xs"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mandatory Remarks Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>Remarks &amp; Notes (Required)</span>
              </label>
              <span
                className={`text-[11px] font-mono ${
                  remarks.trim().length >= 5 ? "text-slate-500" : "text-rose-600 font-semibold"
                }`}
              >
                {remarks.trim().length} chars (min 5)
              </span>
            </div>
            <textarea
              rows={3}
              required
              value={remarks}
              onChange={(e) => {
                setRemarks(e.target.value);
                if (error) setError(null);
              }}
              placeholder={
                isDeny
                  ? "Detail specifically why this request cannot be approved or processed..."
                  : "Detail why work is being suspended and what is needed to resume..."
              }
              className={`w-full p-3 text-xs font-sans rounded-xl border bg-slate-50/50 text-slate-900 focus:outline-none focus:bg-white focus:ring-2 transition-all placeholder:text-slate-400 resize-none ${
                isDeny
                  ? "border-slate-300 focus:border-rose-500 focus:ring-rose-500/20"
                  : "border-slate-300 focus:border-amber-500 focus:ring-amber-500/20"
              }`}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-sans text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || remarks.trim().length < 5}
              className={`px-5 py-2.5 rounded-lg text-xs font-mono font-bold text-white transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isDeny
                  ? "bg-rose-600 hover:bg-rose-700 active:scale-[0.99]"
                  : "bg-amber-600 hover:bg-amber-700 active:scale-[0.99]"
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Recording {actionNoun}…</span>
                </>
              ) : (
                <>
                  {isDeny ? <Ban className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                  <span>Confirm {isDeny ? "Denial" : "Suspension"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
