import React from "react";
import { Notification } from "../types";
import { BellRing, Check } from "lucide-react";

interface NotificationPanelProps {
  notifications: Notification[];
  /** IDs already marked read (persisted by the parent, typically via localStorage). */
  readIds: Set<string>;
  /** Called with every currently-visible notification id when the user clicks "Mark all read". */
  onMarkAllRead: (ids: string[]) => void;
  title?: string;
  /** Max rows shown before the list scrolls. Defaults to 6. */
  maxVisible?: number;
}

// Shared "Recent Activity" panel — previously only DeptDashboard had this.
// PPO, President, Finance, and Staff had zero persistent notification history;
// their only signal was a 6-second toast that vanished with nothing to look
// back at. Same visual language as DeptDashboard's old inline block, but
// reusable and with actual unread tracking.
export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications,
  readIds,
  onMarkAllRead,
  title = "Recent Activity & Notifications",
  maxVisible = 6,
}) => {
  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  return (
    <section className="bg-white border border-[#E6DDD3] rounded-xl shadow-sm overflow-hidden">
      {/* Header — icon + title on their own row (title truncates instead of
          wrapping under the badge), "Mark all read" on a second row so
          neither piece ever gets squeezed in a narrow dropdown. */}
      <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-[#E6DDD3] bg-[#FBF8F5]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-cyan-accent/10 flex items-center justify-center shrink-0">
              <BellRing className="w-3.5 h-3.5 text-cyan-accent" />
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
              className="text-xs font-mono text-[#6B1420] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" /> Mark all read
            </button>
          </div>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-10 px-4">
          <BellRing className="w-8 h-8 text-slate-300 mx-auto mb-2 stroke-1" />
          <p className="text-sm text-slate-500 font-sans">No notifications yet.</p>
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto p-2 space-y-1.5">
          {notifications.slice(0, maxVisible * 4).map((notif) => {
            const isUnread = !readIds.has(notif.id);
            return (
              <div
                key={notif.id}
                className={`flex items-start gap-2.5 p-3 rounded-lg text-xs transition-colors ${isUnread
                  ? "bg-[#F5F1EC] hover:bg-[#F0EAE4]"
                  : "bg-white hover:bg-[#FBF8F5] opacity-70"
                  }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isUnread ? "bg-[#8C2331]" : "bg-[#DDD2C8]"
                    }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-slate-700 leading-relaxed font-sans">{notif.message}</p>
                  <div className="flex gap-3 text-[11px] text-slate-500 font-mono mt-1.5">
                    <span>{new Date(notif.timestamp).toLocaleDateString()}</span>
                    <span>{new Date(notif.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};