import React from "react";
import { Role, Notification } from "../types";
import { LogOut, Menu } from "lucide-react";
import { NotificationBell } from "./Notificationbell";

interface TopbarProps {
  currentRole: Role;
  adminSubRole?: string;
  onLogoutClick: () => void;
  unreadCount?: number;
  onToggleSidebar?: () => void;
  onOpenSettings?: () => void;
  // Real, authenticated user info — no more hardcoded per-role names.
  displayName?: string;
  roleLabel?: string;
  // Notification data for the bell dropdown — same data the old bottom-of-
  // page NotificationPanel used per dashboard, now surfaced up here so it's
  // visible without scrolling on every role's dashboard.
  notifications?: Notification[];
  readNotificationIds?: Set<string>;
  onMarkNotificationsRead?: (ids: string[]) => void;
}

const getInitials = (name?: string) => {
  if (!name) return "??";
  const parts = name.replace(/[^A-Za-z\s]/g, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const Topbar: React.FC<TopbarProps> = ({
  currentRole,
  adminSubRole,
  onLogoutClick,
  unreadCount = 0,
  onToggleSidebar,
  onOpenSettings,
  displayName,
  roleLabel,
  notifications = [],
  readNotificationIds = new Set(),
  onMarkNotificationsRead = () => { },
}) => {
  // Title/subtitle describe the current portal/dashboard in simple, clear words
  let title = "School Maintenance & Repair Hub";
  let subtitle = "Colegio de Santa Catalina de Alejandria (COSCA)";

  if (currentRole === "Admin") {
    if (adminSubRole === "President") {
      title = "Principal & President Approval Desk";
      subtitle = "Review and approve department repair requests";
    } else if (adminSubRole === "Finance") {
      title = "Finance & Funding Portal";
      subtitle = "Check approved repairs and release budget";
    } else {
      title = "School Maintenance & Repair Hub";
      subtitle = "Physical Plant Office — Manage all school repairs and worker assignments";
    }
  } else if (currentRole === "Dept") {
    title = "Department Repair Requests";
    subtitle = "Report broken items and check repair progress in real time";
  } else if (currentRole === "Staff") {
    title = "Maintenance Worker Duty Board";
    subtitle = "View your assigned repair tasks and update work status";
  } else if (currentRole === "Report") {
    title = "Smart Reports & Summaries";
    subtitle = "View overall campus repair trends and download reports";
  } else if (currentRole === "Finance") {
    title = "Finance & Funding Portal";
    subtitle = "Check approved repairs and release budget";
  } else if (currentRole === "SchoolHead") {
    title = "Principal & President Approval Desk";
    subtitle = "Review and approve department repair requests";
  }

  // Matches the titles each dashboard's old bottom-of-page notification
  // panel used to show, now carried over to the bell dropdown instead.
  let notifTitle = "Notifications";
  if (currentRole === "Admin") {
    if (adminSubRole === "President") notifTitle = "Endorsement Notifications";
    else if (adminSubRole === "Finance") notifTitle = "Funding Notifications";
    else notifTitle = "PPO Notifications";
  } else if (currentRole === "Staff") {
    notifTitle = "My Dispatch Notifications";
  } else if (currentRole === "Finance") {
    notifTitle = "Funding Notifications";
  } else if (currentRole === "SchoolHead") {
    notifTitle = "Endorsement Notifications";
  }

  // Person-specific info now comes straight from the authenticated account.
  const userName = displayName || "Unknown User";
  const userRoleLabel = roleLabel || currentRole;
  const avatarInitials = getInitials(displayName);

  return (
    <header className="h-16 bg-white/95 backdrop-blur-sm border-b border-[#E6DDD3] flex items-center justify-between px-4 sm:px-6 text-[#2B1210] shrink-0 select-none relative z-10 shadow-sm">
      {/* Left: 3-line Hamburger Menu Button + Page Title + Subtitle */}
      <div className="flex items-center gap-3 min-w-0 pr-4">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg bg-white border border-[#E6DDD3] hover:bg-[#F0EAE4] text-[#6B1420] hover:text-[#241012] shadow-xs transition-colors cursor-pointer shrink-0 flex items-center justify-center"
            title="Toggle Sidebar Menu (Collapse / Expand)"
          >
            <Menu className="w-5 h-5 text-[#6B1420]" />
          </button>
        )}
        <div className="min-w-0">
          <h2 className="font-display font-bold text-sm sm:text-base text-[#241012] tracking-tight leading-none truncate">
            {title}
          </h2>
          <p className="text-[11px] sm:text-xs text-[#6B1420]/70 font-mono tracking-wider mt-0.5 truncate">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Right: Notification Bell, Avatar, and Logout Button */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">

        {/* Notification Bell — dropdown of recent activity, visible from
            the top of every dashboard instead of a panel at the bottom. */}
        <NotificationBell
          notifications={notifications}
          readIds={readNotificationIds}
          onMarkAllRead={onMarkNotificationsRead}
          title={notifTitle}
        />

        {/* User Profile */}
        <div className="flex items-center gap-2 sm:gap-3 pl-3 sm:pl-4 border-l border-[#E6DDD3]">
          <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#6B1420] to-[#3D0C16] border-2 border-[#6B1420]/20 flex items-center justify-center font-display font-bold text-xs sm:text-sm text-white shadow-sm">
            {avatarInitials}
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white" />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#EF4444] border-2 border-white text-[10px] font-mono font-bold text-white flex items-center justify-center"
                title={`${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <div className="hidden md:flex flex-col text-left">
            <span className="font-sans font-semibold text-sm leading-none text-[#2B1210]">{userName}</span>
            <span className="font-mono text-xs text-slate-600 mt-0.5 uppercase tracking-wider">{userRoleLabel}</span>
          </div>
        </div>

        {/* Logout Trigger */}
        <button
          onClick={onLogoutClick}
          className="flex items-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-lg border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444] hover:text-white text-xs font-mono font-semibold transition-all uppercase cursor-pointer bg-white shadow-sm hover:shadow-md hover:border-[#EF4444]"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Log Out</span>
        </button>
      </div>
    </header>
  );
};