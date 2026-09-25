import React, { useEffect, useRef, useState, useCallback } from "react";
import { Notification } from "../types";
import { Bell, X } from "lucide-react";
import { NotificationPanel } from "./NotificationPanel";

interface NotificationBellProps {
  notifications: Notification[];
  readIds: Set<string>;
  onMarkAllRead: (ids: string[]) => void;
  title?: string;
  maxVisible?: number;
}

// Returns true when the viewport is narrower than Tailwind's `sm` (640 px).
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications,
  readIds,
  onMarkAllRead,
  title = "Notifications",
  maxVisible = 8,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;
  const hasEmergencyUnread = notifications.some(
    (n) => !readIds.has(n.id) && /emergency|🚨/i.test(n.message)
  );

  const close = useCallback(() => setIsOpen(false), []);

  // Desktop: close on click-outside + Escape.
  // Mobile: Escape still works; click-outside is replaced by the backdrop.
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const handleClick = (e: MouseEvent) => {
      if (
        !isMobile &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, isMobile, close]);

  // Lock body scroll when mobile sheet is open.
  useEffect(() => {
    if (isMobile && isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, isOpen]);

  return (
    <>
      {/* ── Bell Button ─────────────────────────────────────────── */}
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          id="notification-bell-btn"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label={
            hasEmergencyUnread
              ? "Emergency notifications — tap to view"
              : `Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`
          }
          className={`relative p-2 rounded-lg border shadow-xs transition-colors cursor-pointer flex items-center justify-center ${
            hasEmergencyUnread
              ? "bg-red-50 border-red-400 text-red-600 hover:bg-red-100 animate-pulse"
              : "bg-white border-[#E6DDD3] hover:bg-[#F0EAE4] text-[#6B1420] hover:text-[#241012]"
          }`}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#EF4444] border-2 border-white text-[10px] font-mono font-bold text-white flex items-center justify-center leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* ── Desktop Dropdown ────────────────────────────────────── */}
        {isOpen && !isMobile && (
          <div className="absolute right-0 mt-3 w-[22rem] z-50">
            {/* Caret */}
            <div className="absolute -top-1.5 right-4 w-3 h-3 bg-[#FBF8F5] border-t border-l border-[#E6DDD3] rotate-45 z-10" />
            <div className="rounded-xl shadow-2xl overflow-hidden border border-[#E6DDD3]">
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

      {/* ── Mobile Bottom Sheet + Backdrop ──────────────────────── */}
      {isOpen && isMobile && (
        <div className="fixed inset-0 z-[999] flex flex-col justify-end">
          {/* Dimmed backdrop — tap to close */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={close}
            aria-hidden="true"
          />

          {/* Sheet */}
          <div
            className="relative bg-white rounded-t-2xl shadow-2xl flex flex-col"
            style={{ maxHeight: "82vh" }}
          >
            {/* Drag handle pill */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-[#DDD2C8]" />
            </div>

            {/* Sheet header */}
            <div className="flex items-center justify-between px-4 pb-3 pt-1 border-b border-[#E6DDD3] shrink-0">
              <span className="font-display font-bold text-base text-[#241012] truncate pr-2">
                {title}
              </span>
              <button
                type="button"
                onClick={close}
                className="shrink-0 p-2 rounded-lg hover:bg-[#F0EAE4] text-[#6B1420] transition-colors"
                aria-label="Close notifications"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable notification list */}
            <div className="overflow-y-auto flex-1 overscroll-contain">
              <NotificationPanel
                notifications={notifications}
                readIds={readIds}
                onMarkAllRead={onMarkAllRead}
                title={title}
                maxVisible={maxVisible}
                hideHeader
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};