import React, { useEffect, useRef, useState } from "react";
import { Notification } from "../types";
import { Bell } from "lucide-react";
import { NotificationPanel } from "./NotificationPanel";

interface NotificationBellProps {
  notifications: Notification[];
  /** IDs already marked read (persisted by the parent, typically via localStorage). */
  readIds: Set<string>;
  /** Called with every currently-visible notification id when the user clicks "Mark all read". */
  onMarkAllRead: (ids: string[]) => void;
  /** Passed straight through to the inner NotificationPanel. */
  title?: string;
  maxVisible?: number;
}

// Compact bell + dropdown, replacing the old full-width "Recent Activity"
// panel that used to sit at the very bottom of every dashboard (easy to
// miss, required scrolling). Lives in the Topbar so it's visible from the
// top on every role's dashboard, and stays hidden until clicked.
//
// This component owns only the button, the badge, and the open/close
// (dropdown positioning + click-outside/Escape-to-close) behavior — the
// actual "what does a notification list look like" rendering is delegated
// to NotificationPanel, so there's one shared implementation instead of
// two near-identical copies of the same list markup.
export const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications,
  readIds,
  onMarkAllRead,
  title = "Notifications",
  maxVisible = 8,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  // Close on click-outside and on Escape, same as any standard dropdown.
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-lg bg-white border border-[#E6DDD3] hover:bg-[#F0EAE4] text-[#6B1420] hover:text-[#241012] shadow-xs transition-colors cursor-pointer flex items-center justify-center"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#EF4444] border-2 border-white text-[10px] font-mono font-bold text-white flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-[23rem] max-w-[92vw] z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Small pointer/caret connecting the dropdown back to the bell */}
          <div className="absolute -top-1.5 right-4 w-3 h-3 bg-white border-t border-l border-[#E6DDD3] rotate-45" />
          <div className="rounded-xl shadow-2xl overflow-hidden">
            <NotificationPanel
              notifications={notifications}
              readIds={readIds}
              onMarkAllRead={onMarkAllRead}
              title={title}
              maxVisible={maxVisible}
            />
          </div>
        </div>
      )}
    </div>
  );
};