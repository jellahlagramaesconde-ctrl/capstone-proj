import React from "react";
import { Notification } from "../types";
import { BellRing, Check, BellOff } from "lucide-react";

interface NotificationPanelProps {
  notifications: Notification[];
  readIds: Set<string>;
  onMarkAllRead: (ids: string[]) => void;
  title?: string;
  /** Max rows shown before the list scrolls (desktop). Defaults to 6. */
  maxVisible?: number;
  /**
   * When true, hides the panel's own header row (title + badge + mark-all-read).
   * Used by the mobile bottom-sheet which renders its own header above the panel.
   */
  hideHeader?: boolean;
}

/** Format a notification timestamp compactly.
 *  - Today  → "9:15 PM"
 *  - This year, different day → "Sep 24 · 2:30 PM"
 *  - Older  → "Sep 24, 2025 · 2:30 PM"
 */
function formatTimestamp(raw: string | Date): string {
  const d = typeof raw === "string" ? new Date(raw) : raw;
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  const isThisYear = d.getFullYear() === now.getFullYear();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (isToday) return time;
  const date = d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    ...(isThisYear ? {} : { year: "numeric" }),
  });
  return `${date} · ${time}`;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications,
  readIds,
  onMarkAllRead,
  title = "Recent Activity & Notifications",
  maxVisible = 6,
  hideHeader = false,
}) => {
  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;
  const visible = notifications.slice(0, maxVisible * 4);

  return (
    <section className="bg-white overflow-hidden flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────
           Hidden when the parent (mobile bottom-sheet) renders its
           own header so we don't get a double title row.           */}
      {!hideHeader && (
        <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-[#E6DDD3] bg-[#FBF8F5] shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[#8C2331]/10 flex items-center justify-center shrink-0">
                <BellRing className="w-3.5 h-3.5 text-[#8C2331]" />
              </div>
              <h3 className="font-display font-semibold text-sm text-[#241012] truncate">
                {title}
              </h3>
            </div>
            {unreadCount > 0 && (
              <span className="shrink-0 whitespace-nowrap text-[11px] font-mono font-bold bg-[#8C2331] text-white rounded-full px-2 py-0.5">
                {unreadCount} new
              </span>
            )}
          </div>

          {unreadCount > 0 && (
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={() => onMarkAllRead(notifications.map((n) => n.id))}
                className="text-xs font-mono text-[#6B1420] hover:underline flex items-center gap-1 cursor-pointer py-1"
              >
                <Check className="w-3.5 h-3.5" />
                Mark all read
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── "Mark all read" bar shown inside the sheet below its header */}
      {hideHeader && unreadCount > 0 && (
        <div className="flex justify-between items-center px-4 py-2 bg-[#FBF8F5] border-b border-[#E6DDD3] shrink-0">
          <span className="text-xs font-mono text-[#8C2331] font-bold">
            {unreadCount} unread
          </span>
          <button
            type="button"
            onClick={() => onMarkAllRead(notifications.map((n) => n.id))}
            className="text-xs font-mono text-[#6B1420] hover:underline flex items-center gap-1 cursor-pointer py-1"
          >
            <Check className="w-3.5 h-3.5" />
            Mark all read
          </button>
        </div>
      )}

      {/* ── Notification list ──────────────────────────────────────── */}
      {notifications.length === 0 ? (
        <div className="text-center py-14 px-6">
          <BellOff className="w-10 h-10 text-slate-300 mx-auto mb-3 stroke-1" />
          <p className="text-sm text-slate-500 font-sans">No notifications yet.</p>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Activity will appear here as job orders move through approvals.
          </p>
        </div>
      ) : (
        <ul
          className="overflow-y-auto overscroll-contain p-2 sm:p-2.5 space-y-1.5"
          /* Desktop: cap at ~320 px. Mobile: panel fills the sheet, so no
             explicit max-height here — the sheet container handles it.     */
          style={{ maxHeight: "min(60vh, 420px)" }}
        >
          {visible.map((notif) => {
            const isUnread = !readIds.has(notif.id);
            const isEmergency = /emergency|🚨/i.test(notif.message);

            return (
              <li
                key={notif.id}
                className={`flex items-start gap-3 rounded-xl transition-colors ${
                  isEmergency
                    ? isUnread
                      ? "bg-red-50 border border-red-200"
                      : "bg-red-50/40 border border-red-100 opacity-75"
                    : isUnread
                    ? "bg-[#F5F1EC] border border-[#E6DDD3]"
                    : "bg-white border border-transparent opacity-65"
                }
                /* Mobile: generous padding for touch targets */
                p-3 sm:p-3`}
              >
                {/* Left indicator */}
                {isEmergency ? (
                  <span
                    className={`text-base mt-0.5 shrink-0 leading-none ${
                      isUnread ? "animate-pulse" : "opacity-50"
                    }`}
                  >
                    🚨
                  </span>
                ) : (
                  <span
                    className={`mt-2 shrink-0 w-2 h-2 rounded-full ${
                      isUnread ? "bg-[#8C2331]" : "bg-[#DDD2C8]"
                    }`}
                  />
                )}

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm leading-snug font-sans break-words ${
                      isEmergency
                        ? "text-red-700 font-semibold"
                        : isUnread
                        ? "text-slate-800 font-medium"
                        : "text-slate-600"
                    }`}
                  >
                    {notif.message}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono mt-1.5 leading-none">
                    {formatTimestamp(notif.timestamp)}
                  </p>
                </div>

                {/* Unread dot — right side, only on desktop (mobile has enough
                    visual weight from the bg colour already) */}
                {isUnread && !isEmergency && (
                  <span className="hidden sm:block shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-[#8C2331]" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};