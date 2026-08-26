import React, { useState, useEffect } from "react";
import { JobOrder, Staff, LogEntry, type Notification, Role } from "./types";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { LogoutModal } from "./components/LogoutModal";
import { AdminDashboard } from "./components/AdminDashboard";
import { UserAccount } from "./components/AccountManagementModal";
import { SettingsModal, StaffProfile, SkillOption } from "./components/SettingsModal";
import { DeptDashboard } from "./components/DeptDashboard";
import { StaffDashboard } from "./components/StaffDashboard";
import { ReportDashboard } from "./components/ReportDashboard";
import { FinanceDashboard } from "./components/FinanceDashboard";
import { SchoolHeadDashboard } from "./components/SchoolHeadDashboard";
import { ShieldCheck, ArrowRight, ArrowLeft, Sparkles, AlertCircle, School, GraduationCap, Wrench, Lock, ClipboardList, Building, Eye, EyeOff, Shield, Mail, CheckCircle2, X, User } from "lucide-react";
import { DEPARTMENT_OFFICES, DEPT_OFFICE_LABELS } from "./departments";

// Admin-side desks (PPO, President, Finance) aren't in DEPT_OFFICE_LABELS —
// that list is department/academic offices only. But PPO etc. can also raise
// a job order for themselves (e.g. PPO's own office needs a repair), so the
// office picker on their "New Request" form needs these three added in.
const ADMIN_OFFICE_LABELS = [
  "Physical Plant Office (PPO)",
  "Office of the President",
  "Finance Office",
];

// ---------------------------------------------------------------------
// API base + small fetch helper that always attaches the Bearer token
// ---------------------------------------------------------------------
// Frontend (Vite, port 5173/5174) and backend (Express, port 4000) are now
// separate processes, so we need the backend's full origin — not "/api/...".
// Override with a .env at the frontend root: VITE_API_URL=http://localhost:4000
function sanitizeApiUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, ""); // remove trailing slashes
  if (url && !/^https?:\/\//i.test(url)) {
    console.warn(`[JORS] VITE_API_URL is missing http:// — auto-fixing "${url}" → "http://${url}"`);
    url = `http://${url}`;
  }
  // Only auto-append :4000 for localhost dev URLs. Deployed hosts (Render,
  // Vercel, custom domains, etc.) intentionally have no port — HTTPS traffic
  // goes through 443 — so don't mangle those.
  if (url && /^https?:\/\/(localhost|127\.0\.0\.1)$/i.test(url)) {
    console.warn(`[JORS] VITE_API_URL is missing a port — auto-fixing "${url}" → "${url}:4000"`);
    url = `${url}:4000`;
  }
  return url;
}
const API_BASE = sanitizeApiUrl(import.meta.env.VITE_API_URL || "http://localhost:4000");


interface AuthUser {
  id?: number;
  username: string;
  role: string; // 'Dept' | 'Staff' | 'PPO' | 'President' | 'Finance'
  fullName: string;
  email?: string;
  department?: string; // the office this account is actually registered under (Dept accounts)
}

const ROLE_LABELS: Record<string, string> = {
  Dept: "Department Head",
  Staff: "Maintenance Technician",
  PPO: "Physical Plant Officer",
  President: "School Directress / President",
  Finance: "Finance Department Head",
};

function playAlertBeep(urgent: boolean = true) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();

    const beep = (freq: number, duration: number, delay = 0) => {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(urgent ? 0.15 : 0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      }, delay);
    };

    if (urgent) {
      beep(880, 0.4, 0);
      beep(880, 0.4, 250); // double-beep for emergencies
    } else {
      beep(660, 0.3, 0); // single, softer chime for regular requests
    }
  } catch (e) {
    console.warn("Could not play alert sound:", e);
  }
}

export default function App() {
  // Navigation & Role State
  const [role, setRole] = useState<Role | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Designated Login Portals State
  const [loginDept, setLoginDept] = useState(DEPARTMENT_OFFICES[0].value);
  const [loginDeptUsername, setLoginDeptUsername] = useState("");
  const [loginDeptPassword, setLoginDeptPassword] = useState("");

  const [loginStaff, setLoginStaff] = useState("");
  const [loginStaffPin, setLoginStaffPin] = useState("");

  const [loginAdminRole, setLoginAdminRole] = useState("PPO");
  const [loginAdminUsername, setLoginAdminUsername] = useState("");
  const [loginAdminKey, setLoginAdminKey] = useState("");

  // Portal selection state
  const [selectedPortal, setSelectedPortal] = useState<"Dept" | "Staff" | "Admin" | null>(null);

  // Password visibility states
  const [showDeptPass, setShowDeptPass] = useState(false);
  const [showStaffPin, setShowStaffPin] = useState(false);
  const [showAdminKey, setShowAdminKey] = useState(false);

  // Login Success Sign Notification State & Handler
  const [showLoginSuccess, setShowLoginSuccess] = useState(false);

  // --- Real auth state ---
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(false);

  // Per-portal login UI state (loading + error message)
  const [deptLoginBusy, setDeptLoginBusy] = useState(false);
  const [deptLoginError, setDeptLoginError] = useState<string | null>(null);
  const [staffLoginBusy, setStaffLoginBusy] = useState(false);
  const [staffLoginError, setStaffLoginError] = useState<string | null>(null);
  const [adminLoginBusy, setAdminLoginBusy] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
  const [adminAttemptsRemaining, setAdminAttemptsRemaining] = useState<number | null>(null);

  // --- Gmail Password Recovery Modal States & Handlers ---
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<1 | 2 | 3>(1);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryOtp, setRecoveryOtp] = useState("");
  const [recoveryNewPassword, setRecoveryNewPassword] = useState("");
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryMsg, setRecoveryMsg] = useState<string | null>(null);


  // --- Global System Settings State (Persisted in localStorage) ---
  const [themeMode, setThemeMode] = useState<"light" | "dark">(
    (localStorage.getItem("jors_theme") as "light" | "dark") || "light"
  );
  // Stored as a percentage (85–150) instead of fixed named steps, so the
  // Settings UI can offer a real drag-to-any-value slider instead of only
  // 3 preset buttons.
  const [fontSizeScale, setFontSizeScale] = useState<number>(() => {
    const saved = Number(localStorage.getItem("jors_font_scale"));
    return Number.isFinite(saved) && saved > 0 ? saved : 100;
  });
  const [highContrastMode, setHighContrastMode] = useState<boolean>(() => {
    return localStorage.getItem("jors_high_contrast") === "true";
  });
  const [officeOptions, setOfficeOptions] = useState<string[]>(() => {
    const saved = localStorage.getItem("jors_custom_offices");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return ["High School Office", "College Registrar", "Finance Office", "Science Laboratory", "School Library", "PPO Headquarters"];
  });
  // Default of 4 shown until fetchDatabase() pulls the real value from
  // /api/settings/worker-limit — the limit is now stored server-side
  // (app_settings) so it's shared and actually enforced for every PPO
  // session, not just remembered in one browser's localStorage.
  const [maxWorkerTaskLimit, setMaxWorkerTaskLimit] = useState<number>(4);

  const handleAddOffice = (newOffice: string) => {
    setOfficeOptions((prev) => {
      const updated = [...prev, newOffice];
      localStorage.setItem("jors_custom_offices", JSON.stringify(updated));
      return updated;
    });
  };

  const handleRemoveOffice = (officeName: string) => {
    setOfficeOptions((prev) => {
      const updated = prev.filter((o) => o !== officeName);
      localStorage.setItem("jors_custom_offices", JSON.stringify(updated));
      return updated;
    });
  };

  const handleUpdateMaxWorkerTaskLimit = async (limit: number) => {
    const previous = maxWorkerTaskLimit;
    setMaxWorkerTaskLimit(limit); // optimistic — reverted below if the save fails
    try {
      const res = await authedFetch("/api/settings/worker-limit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error((errorData && errorData.error) || "Failed to save worker task limit.");
      }
    } catch (err: any) {
      console.error(err);
      setMaxWorkerTaskLimit(previous);
      alert(`Unable to save worker task limit: ${err?.message || "unknown error"}`);
    }
  };

  const handleOpenForgotPassword = (defaultEmailOrUser?: string) => {
    setRecoveryStep(1);
    setRecoveryEmail(defaultEmailOrUser || "");
    setRecoveryOtp("");
    setRecoveryNewPassword("");
    setRecoveryError(null);
    setRecoveryMsg(null);

    setIsForgotModalOpen(true);
  };

  const handleSendRecoveryOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    setRecoveryMsg(null);
    setRecoveryBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: recoveryEmail }),
      });
      const data = await res.json();
      setRecoveryBusy(false);
      if (!res.ok) {
        setRecoveryError(data.error || "Could not find account.");
      } else {
        setRecoveryMsg(data.message);

        setRecoveryStep(2);
      }
    } catch (err) {
      setRecoveryBusy(false);
      setRecoveryError("Could not connect to server. Is the backend running?");
    }
  };

  const handleResetPasswordWithOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    setRecoveryMsg(null);
    setRecoveryBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: recoveryEmail,
          otp: recoveryOtp,
          newPassword: recoveryNewPassword,
        }),
      });
      const data = await res.json();
      setRecoveryBusy(false);
      if (!res.ok) {
        setRecoveryError(data.error || "Failed to reset password.");
      } else {
        setRecoveryMsg(data.message);
        setRecoveryStep(3);
      }
    } catch (err) {
      setRecoveryBusy(false);
      setRecoveryError("Could not connect to server.");
    }
  };

  const handleForgotPassword = (portalName: string) => {
    handleOpenForgotPassword(loginDeptUsername);
  };

  const triggerLoginSuccess = (userRole: Role) => {
    setRole(userRole);
    setShowLoginSuccess(true);
    setTimeout(() => {
      setShowLoginSuccess(false);
    }, 3500);
  };

  // Central login call shared by all three portals
  const performLogin = async (
    username: string,
    password: string,
    portal: "Dept" | "Staff" | "Admin",
    extra?: Record<string, unknown>
  ): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string; attemptsRemaining?: number }> => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, portal, ...extra }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429 && data.retryAfterMs) {
          const mins = Math.ceil(data.retryAfterMs / 60000);
          return { ok: false, error: `${data.error} Try again in ~${mins} min.` };
        }
        return { ok: false, error: data.error || "Login failed.", attemptsRemaining: data.attemptsRemaining };
      }

      setAuthToken(data.token);
      setAuthUser(data.user);
      localStorage.setItem("jors_token", data.token);
      return { ok: true, user: data.user };
    } catch (err) {
      console.error(err);
      return { ok: false, error: "Could not reach the server. Is the backend running?" };
    }
  };

  const handleDeptLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeptLoginError(null);
    setDeptLoginBusy(true);
    const result = await performLogin(loginDeptUsername, loginDeptPassword, "Dept", { department: loginDept });
    setDeptLoginBusy(false);

    if (result.ok !== true) {
      setDeptLoginError(result.error);
      return;
    }

    // Guard: the account must belong to the office picked in the
    // "Department Office" dropdown. The backend should return each
    // account's assigned office as `department` on the login response's
    // user object — if what's selected doesn't match, reject the login
    // client-side even though the username/password were valid.
    const accountDept = result.user.department;
    if (accountDept && accountDept !== loginDept) {
      setAuthToken(null);
      setAuthUser(null);
      localStorage.removeItem("jors_token");
      const pickedLabel = DEPT_OFFICE_LABELS[loginDept] || loginDept;
      const actualLabel = DEPT_OFFICE_LABELS[accountDept] || accountDept;
      setDeptLoginError(
        `This account belongs to "${actualLabel}", not "${pickedLabel}". Please select the correct department office and try again.`
      );
      return;
    }

    triggerLoginSuccess("Dept");
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffLoginError(null);
    setStaffLoginBusy(true);
    const result = await performLogin(loginStaff, loginStaffPin, "Staff");
    setStaffLoginBusy(false);
    if (result.ok === true) {
      setLoginStaff(result.user.fullName);
      triggerLoginSuccess("Staff");
    } else {
      setStaffLoginError(result.error);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoginError(null);
    setAdminLoginBusy(true);
    const username = loginAdminUsername.trim();
    if (!username) {
      setAdminLoginError("Please enter the admin username.");
      setAdminLoginBusy(false);
      return;
    }
    const result = await performLogin(username, loginAdminKey, "Admin", { selectedRole: loginAdminRole });
    setAdminLoginBusy(false);
    if (result.ok !== true) {
      setAdminLoginError(result.error);
      if (typeof result.attemptsRemaining === "number") {
        setAdminAttemptsRemaining(result.attemptsRemaining);
      }
      return;
    }

    // Guard: the account's real role must match whatever was picked in the
    // "Designated Executive Role" dropdown. The backend already rejects this
    // server-side before issuing a token — this is just defense in depth,
    // mirroring the same pattern the Dept login uses for its office check.
    if (result.user.role !== loginAdminRole) {
      setAuthToken(null);
      setAuthUser(null);
      localStorage.removeItem("jors_token");
      const roleLabels: Record<string, string> = {
        PPO: "Physical Plant Officer (PPO)",
        President: "School President (Directress)",
        Finance: "Finance Department Head",
      };
      const pickedLabel = roleLabels[loginAdminRole] || loginAdminRole;
      const actualLabel = roleLabels[result.user.role] || result.user.role;
      setAdminLoginError(
        `This account is registered as "${actualLabel}", not "${pickedLabel}". Please select the correct executive role and try again.`
      );
      return;
    }

    setLoginAdminRole(result.user.role);
    triggerLoginSuccess("Admin");
  };

  // Theme Mode (Defaults to "light" as required, with auto system support)


  // Core Database States
  const [jobOrders, setJobOrders] = useState<JobOrder[]>([]);
  const [staffRoster, setStaffRoster] = useState<Staff[]>([]);
  // Detailed staff profiles (name + specialty + workload + assigned skills)
  // and the system-wide skill list, used by the PPO's Worker Rules ->
  // Skills & Specialties editor. Separate from staffRoster above because
  // /api/job-orders' roster doesn't include per-skill detail, and this
  // data is PPO/Admin-only.
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [skillsList, setSkillsList] = useState<SkillOption[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  // Persisted "read" tracking for the notification panels — separate from
  // seenNotificationIds below, which only exists to gate the toast/beep and
  // is intentionally wiped every reload. This one survives reloads via
  // localStorage so a badge count means something across sessions.
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("jors_read_notifications");
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });
  const markNotificationsRead = (ids: string[]) => {
    setReadNotificationIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      try {
        // Cap what we persist so this doesn't grow unbounded over months of use.
        localStorage.setItem("jors_read_notifications", JSON.stringify(Array.from(next).slice(-500)));
      } catch {
        // localStorage can throw in private-browsing/quota-exceeded cases —
        // read-state just won't persist this session, not worth surfacing.
      }
      return next;
    });
  };
  // Emergency alarm: tickets flagged emergency that PPO hasn't approved yet.
  // Session-only (not persisted) — "acknowledged" means "PPO has this open
  // right now", not "silence forever"; if closed without approving, it can
  // nag again rather than staying silently suppressed.
  const [acknowledgedEmergencyIds, setAcknowledgedEmergencyIds] = useState<Set<string>>(new Set());
  const acknowledgeEmergencyTicket = (id: string) => {
    setAcknowledgedEmergencyIds((prev) => new Set(prev).add(id));
  };
  const [userAccounts, setUserAccounts] = useState<UserAccount[]>([]);
  const seenNotificationIds = React.useRef<Set<number | string>>(new Set());
  const isFirstNotifLoad = React.useRef(true);
  const [liveAlert, setLiveAlert] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: number; message: string; exiting: boolean }[]>([]);
  const toastIdCounter = React.useRef(0);

  // Real OS-level desktop notifications (the kind that appear from the
  // system tray / Action Center, even if this tab isn't focused) — distinct
  // from the in-app toast banner above. The browser's Notification API only
  // works in a "secure context": HTTPS, or the literal hostname "localhost".
  // It's unavailable on a plain-HTTP custom hostname like jors.cosca.local,
  // and there is no workaround for that from application code — it's a
  // browser-enforced security boundary, not a bug. desktopNotifSupported is
  // computed once (it can't change during a session) rather than stored in
  // state.
  const desktopNotifSupported =
    typeof window !== "undefined" && "Notification" in window && window.isSecureContext;
  const [desktopNotifPermission, setDesktopNotifPermission] = useState<NotificationPermission | "unsupported">(
    desktopNotifSupported ? Notification.permission : "unsupported"
  );

  // Must be called from a real user gesture (a button click) — browsers
  // silently ignore Notification.requestPermission() called on page load
  // with no click behind it, so this is only ever wired to a button in
  // Settings, never invoked automatically.
  const requestDesktopNotifPermission = async () => {
    if (!desktopNotifSupported) return;
    const result = await Notification.requestPermission();
    setDesktopNotifPermission(result);
  };

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300);
  };

  // Single shared entry point for creating a toast banner. Both the regular
  // notification-polling flow (fetchDatabase, below) and the emergency-alarm
  // flow (further down) route through this instead of duplicating the
  // "check the setting, build the toast object, schedule its dismissal"
  // logic in two places. Respects the same "On-Screen Toast Banners" user
  // preference either way — an emergency toast bypassing that setting would
  // be surprising given the setting's own label makes no such exception.
  //
  // Also fires a real desktop notification alongside the toast when the
  // browser supports it, permission was granted, and the user hasn't
  // disabled the "Desktop Notifications" setting specifically. Gated on
  // document.hidden so it only appears when this tab genuinely isn't the
  // one you're looking at — if it's focused, the toast above already did
  // the job, and a duplicate OS popup would just be noise.
  const pushToast = (message: string, isEmergency = false) => {
    const toastBannersEnabled = localStorage.getItem("jors_toast_banners") !== "false";
    if (toastBannersEnabled) {
      toastIdCounter.current += 1;
      const id = toastIdCounter.current;
      setToasts((prev) => [...prev, { id, message, exiting: false }].slice(-4));
      setTimeout(() => dismissToast(id), 6000);
    }

    const desktopNotifEnabled = localStorage.getItem("jors_desktop_notifications") !== "false";
    if (desktopNotifSupported && desktopNotifPermission === "granted" && desktopNotifEnabled && document.hidden) {
      try {
        new Notification(isEmergency ? "🚨 JORS COSCA — Emergency Alert" : "JORS COSCA", {
          body: message,
          icon: "/cosca-seal.png",
          tag: isEmergency ? undefined : "jors-notification", // emergencies always get their own popup; routine ones collapse into one
        });
      } catch (err) {
        console.warn("Desktop notification failed to display:", err);
      }
    }
  };


  // Modals & Action States
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  // Small helper: attach auth header, and boot the person back to login if
  // the token is missing/expired/rejected.
  const authedFetch = async (url: string, options: RequestInit = {}) => {
    const headers = {
      ...(options.headers || {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    };
    const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
    if (res.status === 401 || res.status === 403) {
      const data = await res.json().catch(() => ({}));
      const message = (data && data.error) || "Request was not authorized.";
      if (res.status === 401) {
        // Session actually invalid/expired -> force back to login
        handleLogoutConfirm();
      }
      throw new Error(message);
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = (data && data.error) || `${res.status} ${res.statusText}`;
      throw new Error(message);
    }
    return res;
  };

  // Sync state from server
  const fetchDatabase = async () => {
    try {
      setNetworkError(null);
      const ordersRes = await authedFetch("/api/job-orders");
      if (!ordersRes.ok) throw new Error("Failed to load active job orders.");
      const ordersData = await ordersRes.json();
      setJobOrders(ordersData.jobOrders || []);
      setStaffRoster(ordersData.staffRoster || []);

      // Worker task capacity limit now lives server-side (app_settings), not
      // just in this browser's localStorage — pull the shared value so every
      // PPO session sees and enforces the same limit.
      try {
        const limitRes = await authedFetch("/api/settings/worker-limit");
        if (limitRes.ok) {
          const limitData = await limitRes.json();
          if (Number.isFinite(limitData.workerTaskLimit)) {
            setMaxWorkerTaskLimit(limitData.workerTaskLimit);
          }
        }
      } catch (limitErr) {
        console.warn("Worker task limit fetch skipped:", limitErr);
      }

      const logsRes = await authedFetch("/api/logs");
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.logs || []);
        const incoming: Notification[] = logsData.notifications || [];
        setNotifications(incoming);

        const freshOnes = incoming.filter((n) => !seenNotificationIds.current.has(n.id));
        incoming.forEach((n) => seenNotificationIds.current.add(n.id));

        if (!isFirstNotifLoad.current && freshOnes.length > 0) {
          const emergencySoundAlert = localStorage.getItem("jors_emergency_sound") !== "false";

          freshOnes.slice(-4).forEach((n) => pushToast(n.message, /emergency/i.test(n.message)));

          if (emergencySoundAlert) {
            const hasEmergency = freshOnes.some((n) => /emergency/i.test(n.message));
            playAlertBeep(hasEmergency);
          }
        }
        isFirstNotifLoad.current = false;
      }

      // Fetch user accounts if logged in as Admin/PPO
      if (authUser?.role === "PPO" || authUser?.role === "Admin") {
        try {
          const usersRes = await authedFetch("/api/users");
          if (usersRes.ok) {
            const usersData = await usersRes.json();
            setUserAccounts(usersData.users || []);
          }
        } catch (uErr) {
          console.warn("User accounts fetch skipped or unpermitted for current session:", uErr);
        }

        // Detailed staff skill profiles + system-wide skill list, for the
        // Settings -> Worker Rules -> Skills & Specialties editor.
        try {
          const staffRes = await authedFetch("/api/staff");
          if (staffRes.ok) {
            const staffData = await staffRes.json();
            setStaffProfiles(staffData.staff || []);
          }
          const skillsRes = await authedFetch("/api/skills");
          if (skillsRes.ok) {
            const skillsData = await skillsRes.json();
            setSkillsList(skillsData.skills || []);
          }
        } catch (sErr) {
          console.warn("Staff skills fetch skipped or unpermitted for current session:", sErr);
        }
      }
    } catch (err: any) {
      console.error("API Fetch Error:", err);
      setNetworkError(err.message || "Server connection is active but empty or starting up.");
      setJobOrders([]);
      setStaffRoster([]);
      setLogs([]);
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (userData: { username: string; password: string; role: string; fullName: string; email?: string; department?: string }) => {
    try {
      const res = await authedFetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchDatabase();
        return { ok: true };
      }
      return { ok: false, error: data.error || "Failed to create user account." };
    } catch (err: any) {
      return { ok: false, error: err.message || "Failed to connect to server." };
    }
  };

  const handleDeleteUser = async (id: number) => {
    try {
      const res = await authedFetch(`/api/users/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        await fetchDatabase();
        return { ok: true };
      }
      return { ok: false, error: data.error || "Failed to delete user account." };
    } catch (err: any) {
      return { ok: false, error: err.message || "Failed to connect to server." };
    }
  };

  // Delete a job order — PPO only. Calls the backend DELETE endpoint and
  // re-fetches all data so the UI automatically drops the removed ticket.
  const handleDeleteJobOrder = async (ticketId: string) => {
    try {
      const res = await authedFetch(`/api/job-orders/${encodeURIComponent(ticketId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        await fetchDatabase();
        return { ok: true };
      }
      return { ok: false, error: data.error || "Failed to delete job order." };
    } catch (err: any) {
      return { ok: false, error: err.message || "Failed to connect to server." };
    }
  };

  // Worker Rules -> Skills & Specialties: add a brand-new skill to the
  // system-wide list, assign a skill+proficiency to a specific worker, or
  // remove one. All three refresh the staff/skills state afterward so the
  // editor and the AI matching logic stay in sync.
  const handleCreateSkill = async (name: string) => {
    try {
      const res = await authedFetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchDatabase();
        return { ok: true };
      }
      return { ok: false, error: data.error || "Failed to create skill." };
    } catch (err: any) {
      return { ok: false, error: err.message || "Failed to connect to server." };
    }
  };

  const handleAssignStaffSkill = async (staffId: number, skillId: number, proficiency: number, yearsExperience: number) => {
    try {
      const res = await authedFetch(`/api/staff/${staffId}/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId, proficiency, yearsExperience }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchDatabase();
        return { ok: true };
      }
      return { ok: false, error: data.error || "Failed to assign skill." };
    } catch (err: any) {
      return { ok: false, error: err.message || "Failed to connect to server." };
    }
  };

  // Sets a worker's highest relevant qualification (record-keeping —
  // see the note on PATCH /api/staff/:id/degree for why it isn't scored).
  const handleUpdateStaffDegree = async (staffId: number, degree: string) => {
    try {
      const res = await authedFetch(`/api/staff/${staffId}/degree`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ degree }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchDatabase();
        return { ok: true };
      }
      return { ok: false, error: data.error || "Failed to update qualification." };
    } catch (err: any) {
      return { ok: false, error: err.message || "Failed to connect to server." };
    }
  };

  const handleRemoveStaffSkill = async (staffId: number, skillId: number) => {
    try {
      const res = await authedFetch(`/api/staff/${staffId}/skills/${skillId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchDatabase();
        return { ok: true };
      }
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.error || "Failed to remove skill." };
    } catch (err: any) {
      return { ok: false, error: err.message || "Failed to connect to server." };
    }
  };

  // Removes a worker profile that has no linked login account — i.e. a
  // leftover/mock `staff` row from testing. Staff rows tied to a real
  // account (staff.userId set) can't be removed this way; deleting the
  // user account itself (handleDeleteUser) cleans those up instead, so the
  // Worker Rules list only ever shows real, exact accounts.
  const handleDeleteStaff = async (staffId: number) => {
    try {
      const res = await authedFetch(`/api/staff/${staffId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await fetchDatabase();
        return { ok: true };
      }
      return { ok: false, error: data.error || "Failed to remove worker profile." };
    } catch (err: any) {
      return { ok: false, error: err.message || "Failed to connect to server." };
    }
  };

  // Lets PPO admins correct a user's full name / email / department office
  // after the account already exists — deliberately does NOT touch username,
  // role, or password (those stay locked down), but department IS editable
  // here since it only ever restricts which office a Dept account can log in
  // as, never expands access, and it's the only way to assign an office to
  // an account that didn't get one at creation time.
  const handleEditUser = async (id: number, userData: { fullName: string; email?: string; department?: string }) => {
    try {
      const res = await authedFetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchDatabase();
        return { ok: true };
      }
      return { ok: false, error: data.error || "Failed to update user account." };
    } catch (err: any) {
      return { ok: false, error: err.message || "Failed to connect to server." };
    }
  };

  // Lets any logged-in role (Dept, Staff, PPO, President, Finance) update
  // their own display name and email from the new Account Profile tab —
  // separate from handleEditUser, which is the PPO-only path for editing
  // someone else's account.
  const handleUpdateOwnProfile = async (data: { fullName: string; email?: string }) => {
    try {
      const res = await authedFetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (res.ok) {
        setAuthUser(resData.user);
        return { ok: true };
      }
      return { ok: false, error: resData.error || "Failed to update profile." };
    } catch (err: any) {
      return { ok: false, error: err.message || "Failed to connect to server." };
    }
  };

  // Self-service password change from the Account Profile tab — reuses the
  // exact same OTP-via-email flow as the login page's "Forgot Access Key"
  // (POST /api/auth/forgot-password + POST /api/auth/reset-password), just
  // invoked with the logged-in user's own account email instead of a typed
  // one, so it's one password-reset code path for the whole app.
  const requestPasswordResetOtp = async (email: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) return { ok: true, message: data.message };
      return { ok: false, error: data.error || "Could not send verification code." };
    } catch (err: any) {
      return { ok: false, error: err.message || "Could not connect to server." };
    }
  };

  const confirmPasswordResetWithOtp = async (email: string, otp: string, newPassword: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      const data = await res.json();
      if (res.ok) return { ok: true, message: data.message };
      return { ok: false, error: data.error || "Failed to reset password." };
    } catch (err: any) {
      return { ok: false, error: err.message || "Could not connect to server." };
    }
  };

  // On first mount: try to restore a session from a previously stored token
  useEffect(() => {
    const restore = async () => {
      const stored = localStorage.getItem("jors_token");
      if (!stored) {
        setIsRestoringSession(false);
        setIsLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${stored}` },
        });
        if (!res.ok) throw new Error("Session expired");
        const data = await res.json();
        setAuthToken(stored);
        setAuthUser(data.user);

        // Re-derive navigation state from the restored role
        if (data.user.role === "Dept") {
          setSelectedPortal("Dept");
          setLoginDept(data.user.username);
          setLoginDept(data.user.department || DEPARTMENT_OFFICES[0].value);
          setRole("Dept");
        } else if (data.user.role === "Staff") {
          setSelectedPortal("Staff");
          setLoginStaff(data.user.fullName);
          setRole("Staff");
        } else {
          setSelectedPortal("Admin");
          setLoginAdminRole(data.user.role);
          setRole("Admin");
        }
      } catch {
        localStorage.removeItem("jors_token");
      } finally {
        setIsRestoringSession(false);
      }
    };
    restore();
  }, []);

  useEffect(() => {
    const checkAiStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/system/ai-status`);
        if (!res.ok) return;
        const data = await res.json();
        setAiEnabled(Boolean(data.aiEnabled));
      } catch {
        // stays false if something goes wrong
      }
    };
    checkAiStatus();
  }, []);

  // Text Scale Size only did anything to the outer wrapper <div>'s own
  // font-size before, which every component's rem-based Tailwind text
  // classes (text-xs, text-sm, etc.) ignore, since rem is relative to the
  // <html> root, not to any ancestor div. Setting it on documentElement
  // instead makes it genuinely cascade through the whole app.
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSizeScale}%`;
  }, [fontSizeScale]);

  // Once a session (fresh login or restored) is active, load the DB
  useEffect(() => {
    if (authToken && !isRestoringSession) {
      fetchDatabase();
    }
  }, [authToken, isRestoringSession]);
  useEffect(() => {
    if (!authToken || isRestoringSession) return;
    const interval = setInterval(() => {
      fetchDatabase();
    }, 15000);
    return () => clearInterval(interval);
  }, [authToken, isRestoringSession]);

  // Repeating emergency alarm — a single beep on arrival was easy to miss if
  // PPO stepped away. This keeps double-beeping every 12s for any emergency
  // ticket still awaiting PPO's initial approval, until PPO either opens it
  // (acknowledgeEmergencyTicket, wired to AdminDashboard's onTicketClick) or
  // actually approves it (which removes it from this list on the next poll).
  const emergencyPendingTickets = React.useMemo(
    () => jobOrders.filter((t) => t.isEmergency && !t.ppoApproved),
    [jobOrders]
  );
  const activeAlarmTickets = React.useMemo(
    () => emergencyPendingTickets.filter((t) => !acknowledgedEmergencyIds.has(t.id)),
    [emergencyPendingTickets, acknowledgedEmergencyIds]
  );
  const isPpoViewer = role === "Admin" && loginAdminRole === "PPO";
  useEffect(() => {
    if (!isPpoViewer || activeAlarmTickets.length === 0) return;
    const alarmInterval = setInterval(() => {
      playAlertBeep(true);
    }, 12000);
    return () => clearInterval(alarmInterval);
  }, [isPpoViewer, activeAlarmTickets.length]);

  // Visual counterpart to the alarm above. The beep is deliberately
  // repetitive (it needs to keep nagging until PPO acts), but a toast
  // firing every 12s alongside it would just stack up as noise — so this
  // fires once per ticket, the moment it first starts alarming, so PPO
  // actually knows what's beeping and where to look even if they're on a
  // different screen when it starts. toastedEmergencyIds never needs
  // pruning: ticket IDs aren't reused, so a stale entry is harmless.
  const toastedEmergencyIds = React.useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isPpoViewer) return;
    for (const ticket of activeAlarmTickets) {
      if (toastedEmergencyIds.current.has(ticket.id)) continue;
      toastedEmergencyIds.current.add(ticket.id);
      pushToast(`🚨 EMERGENCY: Job Order ${ticket.id} (${ticket.office}) is awaiting your approval.`, true);
    }
  }, [isPpoViewer, activeAlarmTickets]);
  useEffect(() => {
    const stillPendingIds = new Set(emergencyPendingTickets.map((t) => t.id));
    setAcknowledgedEmergencyIds((prev) => {
      const pruned = new Set(Array.from(prev).filter((id) => stillPendingIds.has(id)));
      return pruned.size === prev.size ? prev : pruned;
    });
  }, [emergencyPendingTickets]);

  // The DB role this logged-in session actually corresponds to: for Admin
  // portal logins that's loginAdminRole (PPO/President/Finance); for
  // Dept/Staff it's just `role` itself. Backend already scopes Dept/Staff
  // notifications correctly at the query level; for the three Admin roles
  // /api/logs intentionally returns everything (they need cross-office
  // visibility for logs), so we filter to "notifications actually meant for
  // this role" client-side for the panel — the toast/beep above still fires
  // on every new item regardless, by design.
  const myNotificationRole = role === "Admin" ? loginAdminRole : role;
  const myNotifications = React.useMemo(
    () => notifications.filter((n) => n.role === myNotificationRole),
    [notifications, myNotificationRole]
  );
  const myUnreadCount = React.useMemo(
    () => myNotifications.filter((n) => !readNotificationIds.has(n.id)).length,
    [myNotifications, readNotificationIds]
  );

  // Submit Job Request (Screen 2)
  const handleSubmitRequest = async (office: string, description: string, requestedByName: string, isEmergency: boolean = false, photoUrl?: string) => {
    setIsSubmitting(true);
    setNetworkError(null);
    try {
      const res = await authedFetch("/api/job-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ office, description, requestedByName, isEmergency, photoUrl }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const message = (errorData && errorData.error) || `${res.status} ${res.statusText}`;
        setNetworkError(message);
        throw new Error(message);
      }

      await fetchDatabase();
    } catch (err: any) {
      console.error(err);
      const message = err?.message || "Error submitting job order.";
      setNetworkError(message);
      alert(`Error: could not submit this request. ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Change (Screen 3 & general)
  const handleUpdateStatus = async (id: string, status: "Pending" | "In Progress" | "Completed") => {
    try {
      const res = await authedFetch("/api/job-orders/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const message = (errorData && errorData.error) || `${res.status} ${res.statusText}`;
        setNetworkError(message);
        throw new Error(message);
      }
      await fetchDatabase();
    } catch (err: any) {
      console.error(err);
      const message = err?.message || "Failed to update status.";
      setNetworkError(message);
      alert(`Unable to update status: ${message}`);
    }
  };

  // Quick Approve AI suggestion (PPO Verify & Approve)
  const handleApprove = async (
    id: string,
    estimatedCost?: number,
    emergencyOverride?: boolean,
    confirmOverride: boolean = false
  ) => {
    try {
      const body: any = { id, confirmOverride };
      if (estimatedCost !== undefined && Number.isFinite(estimatedCost)) {
        body.estimatedCost = estimatedCost;
      }
      if (emergencyOverride) {
        body.emergencyOverride = true;
      }

      const res = await authedFetch("/api/job-orders/ppo-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        // Capacity-limit hits come back as a warning (409, warning: true)
        // rather than a hard failure — confirm with the PPO, then resend
        // the same approval with confirmOverride: true to proceed.
        if (errorData?.warning) {
          const proceed = window.confirm(errorData.error);
          if (proceed) {
            await handleApprove(id, estimatedCost, emergencyOverride, true);
          }
          return;
        }
        const message = (errorData && errorData.error) || `${res.status} ${res.statusText}`;
        setNetworkError(message);
        throw new Error(message);
      }

      await fetchDatabase();
    } catch (err: any) {
      console.error(err);
      const message = err?.message || "PPO approval failed.";
      setNetworkError(message);
      alert(`Unable to approve request: ${message}`);
    }
  };

  // Finance Department Head Funding Approval
  const handleFinanceApprove = async (id: string, approvedAmount?: number, estimatedCost?: number, financeNotes?: string) => {
    try {
      const res = await authedFetch("/api/job-orders/finance-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, approvedAmount, estimatedCost, financeNotes }),
      });
      if (res.ok) {
        await fetchDatabase();
      } else {
        throw new Error("Failed to approve funding on server.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // School Head Administrative Endorsement
  const handleSchoolHeadApprove = async (id: string) => {
    try {
      const res = await authedFetch("/api/job-orders/school-head-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        await fetchDatabase();
      } else {
        throw new Error("Failed to endorse requisition on server.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Admin Priority/Staff Override (Screen 1)
  const handleOverride = async (
    id: string,
    assignedStaff: string,
    priorityScore: number,
    rationale: string,
    confirmOverride: boolean = false
  ) => {
    try {
      const res = await authedFetch("/api/job-orders/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, assignedStaff, priorityScore, rationale, confirmOverride }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        // Capacity-limit hits come back as a warning (409, warning: true)
        // rather than a hard failure — ask the PPO to confirm, then resend
        // the exact same request with confirmOverride: true to proceed.
        if (errorData?.warning) {
          const proceed = window.confirm(errorData.error);
          if (proceed) {
            await handleOverride(id, assignedStaff, priorityScore, rationale, true);
          }
          return;
        }
        const message = (errorData && errorData.error) || "Failed override on server.";
        throw new Error(message);
      }
      await fetchDatabase();
    } catch (err: any) {
      console.error(err);
      // Previously this error was only logged to the console, so a PPO
      // hitting a blocked reassignment saw nothing happen and no explanation why.
      alert(`Unable to reassign this job order: ${err?.message || "unknown error"}`);
    }
  };

  // Logout / Confirm Sign Out Actions
  const handleLogoutConfirm = () => {
    setIsLogoutModalOpen(false);
    setRole(null); // Triggers signed out screen
    setSelectedPortal(null); // Reset selection
    setLoginDeptPassword(""); // Clear password field
    setLoginStaffPin(""); // Clear pin field
    setLoginAdminKey(""); // Clear admin key field
    setAuthToken(null);
    setAuthUser(null);
    localStorage.removeItem("jors_token");
    setDeptLoginError(null);
    setStaffLoginError(null);
    setAdminLoginError(null);
    setAdminAttemptsRemaining(null);
  };

  if (isLoading || isRestoringSession) {
    return (
      <div className="min-h-screen bg-[#F7F4F0] flex flex-col items-center justify-center text-[#241012] p-6 font-sans">
        <div className="relative mb-8">
          <div className="relative w-24 h-24 rounded-full border-2 border-[#E6DDD3] bg-white flex items-center justify-center overflow-hidden shadow-sm">
            <img src="/cosca-seal.png" alt="COSCA Seal" className="w-full h-full object-contain p-2" />
          </div>
          <div className="absolute inset-[-3px] rounded-full border-2 border-t-[#C41230] border-transparent animate-spin" />
        </div>
        <h2 className="font-display font-bold text-xl text-[#241012] tracking-tight">JORS COSCA</h2>
        <p className="text-xs text-slate-700 font-mono mt-1 tracking-widest animate-pulse">ESTABLISHING SECURE CONNECTION...</p>
      </div>
    );
  }

  return (
    <div
      // Dark mode is driven entirely by this filter, not by swapping
      // Tailwind bg/text classes on the wrapper. Every component underneath
      // hardcodes its own literal light-mode colors (bg-white,
      // bg-[#F7F4F0], etc.) with zero dark: variants anywhere in the app,
      // so invert()+hue-rotate() flips all of them to a working dark
      // palette from one place. The wrapper itself always keeps its LIGHT
      // classes — previously it switched to bg-slate-950 in dark mode,
      // which the filter then re-inverted back toward white, fighting
      // against the rest of the (correctly inverting) app and making dark
      // mode look broken/inconsistent.
      style={themeMode === "dark" ? { filter: "invert(1) hue-rotate(180deg)" } : undefined}
      className={`min-h-screen flex transition-all overflow-hidden select-none bg-[#F7F4F0] text-[#1A0E10] ${highContrastMode ? "contrast-125 font-semibold" : ""}`}>
      {themeMode === "dark" && (
        <style>{`img, video { filter: invert(1) hue-rotate(180deg); }`}</style>
      )}
      {role === null ? (
        /* ═══════════════════════════════════════════════════════════
           COSCA FACILITIES PORTAL — DESIGNATED LOGIN PAGE
           Split-screen: Left branding panel + Right login panel
         ═══════════════════════════════════════════════════════════ */
        <div
          className="w-full min-h-screen flex flex-col items-center justify-center p-4 sm:p-8"
          style={{
            background:
              "radial-gradient(circle at 12% 10%, rgba(196,18,48,0.07), transparent 40%), radial-gradient(circle at 88% 15%, rgba(196,18,48,0.05), transparent 35%), radial-gradient(circle at 50% 100%, rgba(196,18,48,0.06), transparent 45%), #F7F4F0",
          }}
        >
          <div className="w-full max-w-4xl relative rounded-3xl overflow-hidden bg-white shadow-[0_30px_70px_-20px_rgba(138,14,27,0.35),0_10px_25px_-8px_rgba(0,0,0,0.1)]">
            {/* Top gradient accent bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-[#8A0E1B] via-[#C41230] to-[#8A0E1B]" />
            <div className="flex flex-col lg:flex-row">
              {/* ══════════════════════════════════════════════════
                LEFT BRANDING PANEL — light theme (desktop only)
            ══════════════════════════════════════════════════ */}
              <div className="hidden lg:flex lg:w-[320px] xl:w-[340px] shrink-0 flex-col bg-[#FBF2F2] border-r border-[#E8C4C9]">
                {/* Seal + School Name */}
                <div className="flex flex-col items-center text-center px-7 pt-8 pb-5">
                  <div className="w-20 h-20 rounded-full border-2 border-[#E8C4C9] bg-white overflow-hidden shadow-sm flex items-center justify-center mb-4">
                    <img
                      src="/cosca-seal.png"
                      alt="COSCA Official Seal — Colegio de Santa Catalina de Alejandria"
                      className="w-full h-full object-contain p-1.5"
                    />
                  </div>

                  <h1 className="font-display font-bold text-[#241012] text-[15px] leading-snug tracking-tight">
                    Colegio de Santa Catalina<br />de Alejandria
                  </h1>
                  <p className="text-slate-700 text-xs font-sans mt-1 tracking-wide">
                    Dumaguete City, Philippines · Est. 1959
                  </p>

                  <div className="mt-4 w-full border-t border-[#E8C4C9] pt-4">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-mono tracking-widest text-emerald-800 uppercase mb-4">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      System Online · Encrypted
                    </div>
                    <p className="font-display font-bold text-[#241012] text-[20px] leading-tight tracking-tight">
                      COSCA Facilities<br /><span className="text-[#C41230]">Control Portal</span>
                    </p>
                    <div className="mt-2.5 flex items-center justify-center gap-1.5">
                      <span className="h-px flex-1 bg-[#E8C4C9]" />
                      <span className="text-[11px] font-mono text-slate-600 tracking-[0.2em] uppercase">JORS v1.0</span>
                      <span className="h-px flex-1 bg-[#E8C4C9]" />
                    </div>
                  </div>
                </div>

                {/* Spacer to balance height against right panel */}
                <div className="flex-1" />

                {/* Security strip */}
                <div className="px-7 py-4 border-t border-[#E8C4C9]">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {[
                      "bcrypt hashed passwords",
                      "JWT signed sessions",
                      "8-hour session expiry",
                      "5-attempt lockout policy",
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                        <span className="text-[11px] text-slate-600 font-sans leading-snug">{item}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] font-mono text-slate-600 mt-3">
                    JORS COSCA v2.0 · © 2026 · All rights reserved
                  </p>
                </div>
              </div>

              {/* ══════════════════════════════════════════════════
                RIGHT LOGIN PANEL — fitted, no excess whitespace
            ══════════════════════════════════════════════════ */}
              <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-br from-white to-[#FDF9F6]">
                {/* Mobile-only top header bar */}
                <div className="lg:hidden flex items-center gap-3 px-5 py-3.5 bg-[#FBF2F2] border-b border-[#E8C4C9] shrink-0">
                  <div className="w-9 h-9 rounded-full bg-white border border-[#E8C4C9] overflow-hidden shrink-0">
                    <img src="/cosca-seal.png" alt="COSCA Seal" className="w-full h-full object-contain p-0.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-[#241012] text-sm leading-tight truncate">
                      COSCA Facilities Portal
                    </p>
                    <p className="text-slate-700 text-xs font-mono tracking-wider">JORS v1.0</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5 text-[11px] font-mono text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Secure
                  </div>
                </div>

                {/* Fitted login content */}
                <div className="flex flex-col justify-center px-6 sm:px-9 py-7">
                  {selectedPortal === null ? (
                    <div className="w-full animate-fade-in-up">
                      {/* Heading */}
                      <div className="mb-5">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FBF2F2] border border-[#E8C4C9] text-xs font-mono font-semibold text-[#C41230] mb-3">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#C41230] animate-pulse" />
                          🔐 Secure Access Portal
                        </div>
                        <h2 className="font-display font-bold text-[24px] sm:text-[26px] text-[#241012] leading-tight tracking-tight">
                          Welcome to <span className="text-[#C41230]">JORS COSCA</span>
                        </h2>
                        <p className="text-sm text-slate-700 font-sans leading-relaxed mt-1.5">
                          Select your role to begin.
                        </p>
                      </div>

                      {/* Portal cards */}
                      <div className="space-y-2.5 stagger-children">
                        {(
                          [
                            {
                              key: "Dept" as const,
                              icon: <ClipboardList className="w-5 h-5" />,
                              title: "Department Portal",
                              desc: "Submit facility requests & track resolutions in real time",
                              tag: "7 Offices",
                              accent: "#1D4ED8",
                              accentBg: "#EEF1FE",
                            },
                            {
                              key: "Staff" as const,
                              icon: <Wrench className="w-5 h-5" />,
                              title: "Maintenance Staff",
                              desc: "Access daily duty boards & update job order status",
                              tag: "Technicians",
                              accent: "#15803D",
                              accentBg: "#F0FDF4",
                            },
                            {
                              key: "Admin" as const,
                              icon: <Shield className="w-5 h-5" />,
                              title: "Admin Console",
                              desc: "PPO oversight, Finance approvals & President endorsements",
                              tag: "Executives",
                              accent: "#C41230",
                              accentBg: "#FBF2F2",
                            },
                          ] as const
                        ).map((portal) => (
                          <button
                            key={portal.key}
                            onClick={() => setSelectedPortal(portal.key)}
                            className="w-full group portal-card flex items-center gap-3.5 bg-white border border-[#E6DDD3] rounded-xl p-4 shadow-sm hover:shadow-md cursor-pointer text-left relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
                            style={{ ["--accent" as any]: portal.accent }}
                            onMouseEnter={(e) => (e.currentTarget.style.borderColor = portal.accent)}
                            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E6DDD3")}
                          >
                            {/* Animated left border accent */}
                            <div
                              className="absolute top-0 left-0 bottom-0 w-1 rounded-l-2xl opacity-0 group-hover:opacity-100 transition-all duration-300"
                              style={{ background: portal.accent }}
                            />
                            {/* Subtle hover gradient wash */}
                            <div
                              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
                              style={{ background: `linear-gradient(135deg, ${portal.accentBg} 0%, transparent 60%)` }}
                            />
                            <div
                              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-all duration-200 shadow-sm relative z-10"
                              style={{ background: portal.accentBg, color: portal.accent }}
                            >
                              {portal.icon}
                            </div>
                            <div className="flex-1 min-w-0 relative z-10">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <p className="font-display font-bold text-lg text-[#241012] transition-colors">
                                  {portal.title}
                                </p>
                                <span
                                  className="hidden sm:inline-flex items-center text-[11px] font-mono font-semibold px-2.5 py-1 rounded-full border"
                                  style={{ color: portal.accent, background: portal.accentBg, borderColor: portal.accent + "33" }}
                                >
                                  {portal.tag}
                                </span>
                              </div>
                              <p className="text-sm text-slate-700 font-sans leading-relaxed">{portal.desc}</p>
                            </div>
                            <div
                              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-200 relative z-10"
                              style={{ background: portal.accentBg, color: portal.accent }}
                            >
                              <ArrowRight className="w-4 h-4" />
                            </div>
                            <ArrowRight className="w-4 h-4 text-[#C5B8B2] group-hover:opacity-0 transition-all shrink-0 absolute right-5" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full animate-fade-in">
                      {/* Back button */}
                      <button
                        onClick={() => {
                          setSelectedPortal(null);
                          setDeptLoginError(null);
                          setStaffLoginError(null);
                          setAdminLoginError(null);
                        }}
                        className="mb-4 flex items-center gap-2 text-slate-700 hover:text-[#C41230] transition-colors text-xs font-mono group cursor-pointer px-2.5 py-1 rounded-lg hover:bg-[#FBF2F2] border border-transparent hover:border-[#E8C4C9] -ml-2.5"
                      >
                        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                        Back to Portal Selection
                      </button>

                      {/* Card */}
                      <div className="bg-white border border-[#E6DDD3] rounded-2xl shadow-sm overflow-hidden">
                        {/* Gradient card header */}
                        <div className="relative bg-gradient-to-br from-[#8A0E1B] via-[#C41230] to-[#3D0C16] px-5 py-4 overflow-hidden">
                          {/* Background pattern */}
                          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/5 blur-2xl" />
                          <div className="relative flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0 shadow-lg backdrop-blur-sm">
                              {selectedPortal === "Dept" && <ClipboardList className="w-5 h-5 text-white" />}
                              {selectedPortal === "Staff" && <Wrench className="w-5 h-5 text-white" />}
                              {selectedPortal === "Admin" && <Shield className="w-5 h-5 text-white" />}
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-mono text-white/90 uppercase tracking-[0.2em]">
                                {selectedPortal === "Dept"
                                  ? "Department"
                                  : selectedPortal === "Staff"
                                    ? "Maintenance"
                                    : "Administrative"}{" "}
                                Portal
                              </p>
                              <h3 className="font-display font-bold text-white text-lg leading-tight mt-0.5">
                                {selectedPortal === "Dept"
                                  ? "Department Access Desk"
                                  : selectedPortal === "Staff"
                                    ? "Staff Terminal Login"
                                    : "Executive Admin Console"}
                              </h3>
                            </div>
                          </div>
                        </div>

                        <div className="px-5 py-5">
                          {/* Portal tip */}
                          <div className="bg-[#F5F1EC] border border-[#E6DDD3]/60 rounded-xl px-3.5 py-2.5 mb-4 text-xs text-slate-700 leading-relaxed font-sans">
                            💡{" "}
                            {selectedPortal === "Dept" &&
                              "Log in using your registered department credentials. Select your office from the dropdown."}
                            {selectedPortal === "Staff" &&
                              "Use your physical plant service key to access repairs, update status, and track assignments."}
                            {selectedPortal === "Admin" &&
                              "Restricted to PPO supervisors, Finance heads, and the School Directress/President only."}
                          </div>

                          {/* ─── DEPT FORM ─── */}
                          {selectedPortal === "Dept" && (
                            <>
                              {deptLoginError && (
                                <div className="mb-4 flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-sans rounded-xl p-3 leading-relaxed">
                                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                  <span>{deptLoginError}</span>
                                </div>
                              )}
                              <form onSubmit={handleDeptLogin} className="space-y-3.5">
                                <div>
                                  <label className="block text-xs font-mono font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                    Username
                                  </label>
                                  <div className="relative">
                                    <input
                                      type="text"
                                      required
                                      autoComplete="username"
                                      value={loginDeptUsername}
                                      onChange={(e) => setLoginDeptUsername(e.target.value)}
                                      placeholder="e.g. maria.santos"
                                      className="w-full text-sm font-sans pl-9 pr-3 py-3 rounded-xl border border-[#E6DDD3] bg-[#F5F1EC] text-[#2B1210] focus:outline-none focus:ring-2 focus:ring-[#C41230]/25 focus:border-[#C41230] transition-all"
                                    />
                                    <User className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-[11px]" />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-xs font-mono font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                    Department Office
                                  </label>
                                  <select
                                    value={loginDept}
                                    onChange={(e) => setLoginDept(e.target.value)}
                                    className="w-full text-sm font-sans px-3 py-3 rounded-xl border border-[#E6DDD3] bg-[#F5F1EC] text-[#2B1210] focus:outline-none focus:ring-2 focus:ring-[#C41230]/25 focus:border-[#C41230] transition-all cursor-pointer"
                                  >
                                    {DEPARTMENT_OFFICES.map((dept) => (
                                      <option key={dept.value} value={dept.value}>
                                        {dept.fullName}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-mono font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                    Department Access Key
                                  </label>
                                  <div className="relative">
                                    <input
                                      type={showDeptPass ? "text" : "password"}
                                      value={loginDeptPassword}
                                      onChange={(e) => setLoginDeptPassword(e.target.value)}
                                      placeholder="••••••••"
                                      className="w-full text-sm font-sans pl-9 pr-10 py-3 rounded-xl border border-[#E6DDD3] bg-[#F5F1EC] text-[#2B1210] focus:outline-none focus:ring-2 focus:ring-[#C41230]/25 focus:border-[#C41230] transition-all"
                                    />
                                    <Lock className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-[11px]" />
                                    <button
                                      type="button"
                                      onClick={() => setShowDeptPass(!showDeptPass)}
                                      className="absolute right-3 top-[11px] text-slate-600 hover:text-[#C41230] transition-colors cursor-pointer"
                                    >
                                      {showDeptPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                  </div>
                                </div>
                                <button
                                  type="submit"
                                  disabled={deptLoginBusy}
                                  className="w-full mt-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#C41230] hover:bg-[#9C0E24] active:scale-[0.99] text-white font-display font-semibold text-sm shadow-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                  {deptLoginBusy ? (
                                    <>
                                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                      Verifying Credentials…
                                    </>
                                  ) : (
                                    <>
                                      Access Department Terminal
                                      <ArrowRight className="w-4 h-4" />
                                    </>
                                  )}
                                </button>
                              </form>
                              <button
                                type="button"
                                onClick={() => handleOpenForgotPassword(loginDeptUsername)}
                                className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-600 hover:text-[#C41230] text-center w-full font-sans transition-colors cursor-pointer hover:underline"
                              >
                                <Mail className="w-3.5 h-3.5 text-[#C41230]" />
                                Forgot Access Key? Reset via Gmail OTP
                              </button>
                            </>
                          )}

                          {/* ─── STAFF FORM ─── */}
                          {selectedPortal === "Staff" && (
                            <>
                              {staffLoginError && (
                                <div className="mb-4 flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-sans rounded-xl p-3 leading-relaxed">
                                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                  <span>{staffLoginError}</span>
                                </div>
                              )}
                              <form onSubmit={handleStaffLogin} className="space-y-3.5">
                                <div>
                                  <label className="block text-xs font-mono font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                    Technician Username
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    value={loginStaff}
                                    onChange={(e) => setLoginStaff(e.target.value)}
                                    placeholder="e.g. delfin.ramirez"
                                    className="w-full text-sm font-sans px-3 py-3 rounded-xl border border-[#E6DDD3] bg-[#F5F1EC] text-[#2B1210] focus:outline-none focus:ring-2 focus:ring-[#C41230]/25 focus:border-[#C41230] transition-all"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-mono font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                    Personnel Access PIN
                                  </label>
                                  <div className="relative">
                                    <input
                                      type={showStaffPin ? "text" : "password"}
                                      value={loginStaffPin}
                                      onChange={(e) => setLoginStaffPin(e.target.value)}
                                      placeholder="••••"
                                      className="w-full text-sm font-sans pl-9 pr-10 py-3 rounded-xl border border-[#E6DDD3] bg-[#F5F1EC] text-[#2B1210] focus:outline-none focus:ring-2 focus:ring-[#C41230]/25 focus:border-[#C41230] transition-all"
                                    />
                                    <Lock className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-[11px]" />
                                    <button
                                      type="button"
                                      onClick={() => setShowStaffPin(!showStaffPin)}
                                      className="absolute right-3 top-[11px] text-slate-600 hover:text-[#C41230] transition-colors cursor-pointer"
                                    >
                                      {showStaffPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                  </div>
                                </div>
                                <button
                                  type="submit"
                                  disabled={staffLoginBusy}
                                  className="w-full mt-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#C41230] hover:bg-[#9C0E24] active:scale-[0.99] text-white font-display font-semibold text-sm shadow-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                  {staffLoginBusy ? (
                                    <>
                                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                      Verifying…
                                    </>
                                  ) : (
                                    <>
                                      Access Staff Terminal
                                      <ArrowRight className="w-4 h-4" />
                                    </>
                                  )}
                                </button>
                              </form>
                              <button
                                type="button"
                                onClick={() => handleForgotPassword("Maintenance")}
                                className="mt-4 text-xs text-slate-600 hover:text-[#C41230] text-center block w-full font-sans transition-colors cursor-pointer hover:underline"
                              >
                                Forgot your personnel PIN?
                              </button>
                            </>
                          )}

                          {/* ─── ADMIN FORM ─── */}
                          {selectedPortal === "Admin" && (
                            <>
                              {adminAttemptsRemaining !== null && adminAttemptsRemaining > 0 && (
                                <div className="bg-[#FBF2F2] border border-[#E8C4C9]/80 rounded-xl px-4 py-3 mb-4 text-xs text-[#C41230] font-sans flex items-start gap-2.5 leading-relaxed">
                                  <AlertCircle className="w-4 h-4 text-[#C41230] shrink-0 mt-0.5 animate-pulse" />
                                  <div>
                                    <strong className="font-semibold block text-[#4E0F19]">
                                      Failed attempt registered
                                    </strong>
                                    <span>
                                      {adminAttemptsRemaining} remaining before administrative lock-out.
                                    </span>
                                  </div>
                                </div>
                              )}
                              {adminLoginError && (
                                <div className="mb-4 flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-sans rounded-xl p-3 leading-relaxed">
                                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                  <span>{adminLoginError}</span>
                                </div>
                              )}
                              <form onSubmit={handleAdminLogin} className="space-y-3.5">
                                <div>
                                  <label className="block text-xs font-mono font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                    Admin Username
                                  </label>
                                  <div className="relative">
                                    <input
                                      type="text"
                                      value={loginAdminUsername}
                                      onChange={(e) => setLoginAdminUsername(e.target.value)}
                                      placeholder="e.g. ppo.head"
                                      className="w-full text-sm font-sans pl-9 pr-3 py-3 rounded-xl border border-[#E6DDD3] bg-[#F5F1EC] text-[#2B1210] focus:outline-none focus:ring-2 focus:ring-[#C41230]/25 focus:border-[#C41230] transition-all"
                                    />
                                    <GraduationCap className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-[11px]" />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-xs font-mono font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                    Designated Executive Role
                                  </label>
                                  <select
                                    value={loginAdminRole}
                                    onChange={(e) => setLoginAdminRole(e.target.value)}
                                    className="w-full text-sm font-sans px-3 py-3 rounded-xl border border-[#E6DDD3] bg-[#F5F1EC] text-[#2B1210] focus:outline-none focus:ring-2 focus:ring-[#C41230]/25 focus:border-[#C41230] transition-all cursor-pointer"
                                  >
                                    <option value="PPO">Physical Plant Officer (PPO)</option>
                                    <option value="President">School President (Directress)</option>
                                    <option value="Finance">Finance Department Head</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-mono font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                    Administrative Security Key
                                  </label>
                                  <div className="relative">
                                    <input
                                      type={showAdminKey ? "text" : "password"}
                                      value={loginAdminKey}
                                      onChange={(e) => setLoginAdminKey(e.target.value)}
                                      placeholder="••••••••"
                                      className="w-full text-sm font-sans pl-9 pr-10 py-3 rounded-xl border border-[#E6DDD3] bg-[#F5F1EC] text-[#2B1210] focus:outline-none focus:ring-2 focus:ring-[#C41230]/25 focus:border-[#C41230] transition-all"
                                    />
                                    <Lock className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-[11px]" />
                                    <button
                                      type="button"
                                      onClick={() => setShowAdminKey(!showAdminKey)}
                                      className="absolute right-3 top-[11px] text-slate-600 hover:text-[#C41230] transition-colors cursor-pointer"
                                    >
                                      {showAdminKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                  </div>
                                </div>
                                <button
                                  type="submit"
                                  disabled={adminLoginBusy}
                                  className="w-full mt-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#C41230] hover:bg-[#9C0E24] active:scale-[0.99] text-white font-display font-semibold text-sm shadow-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                  {adminLoginBusy ? (
                                    <>
                                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                      Verifying…
                                    </>
                                  ) : (
                                    <>
                                      Unlock Control Deck
                                      <ArrowRight className="w-4 h-4" />
                                    </>
                                  )}
                                </button>
                              </form>

                              <button
                                type="button"
                                onClick={() => handleForgotPassword("Administrator")}
                                className="mt-4 text-xs text-slate-600 hover:text-[#C41230] text-center block w-full font-sans transition-colors cursor-pointer hover:underline"
                              >
                                Forgot your administrative security key?
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Page footer */}
                <div className="mt-auto px-6 sm:px-9 py-4 text-center border-t border-[#E6DDD3]/60">
                  <p className="text-[11px] font-mono text-slate-600">
                    COSCA Facilities Control Portal · JORS v1.0 · © 2026 CoSCA
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* AUTHENTICATED SYSTEM LAYOUT */
        <React.Fragment>
          {/* Floating Login Success Toast Sign */}
          {showLoginSuccess && (
            <div id="login-success-toast" className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-emerald-500 text-white px-6 py-3.5 rounded-2xl shadow-xl font-sans font-semibold text-sm animate-bounce">
              <ShieldCheck className="w-5 h-5 text-white shrink-0 animate-pulse" />
              <span>Login Successfully</span>
            </div>
          )}
          {/* Mobile Overlay backdrop when Sidebar is toggled open */}
          {isSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 lg:hidden cursor-pointer"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}
          {/* Top-right stacking toast notifications — anchored below the
              Topbar (h-16) so nothing overlaps it, and positioned where
              it's immediately visible rather than requiring the user to
              look down at the bottom of the screen. Rendered newest-first
              (render-time reverse only — pushToast still appends to the
              end of the underlying array) so the most recent alert is
              always the one closest to the anchor, at the top of the stack. */}
          {toasts.length > 0 && (
            <div className="fixed top-20 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
              {[...toasts].reverse().map((toast) => (
                <div
                  key={toast.id}
                  className={`pointer-events-auto flex items-start gap-3 bg-[#241012] text-white pl-4 pr-3 py-3.5 rounded-xl shadow-2xl border border-[#6B1420]/30 ${toast.exiting ? 'animate-toast-out' : 'animate-toast-in'}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-[#6B1420] flex items-center justify-center shrink-0 mt-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /><path d="M4 2C2.8 3.7 2 5.7 2 8" /><path d="M22 8c0-2.3-.8-4.3-2-6" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-mono text-[#E8C4C9] uppercase tracking-wider mb-1">New Activity</p>
                    <p className="text-sm font-sans leading-snug">{toast.message}</p>
                    <div className="mt-2.5 h-0.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#6B1420] rounded-full"
                        style={{ animation: 'toast-progress 6s linear both' }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => dismissToast(toast.id)}
                    className="text-white/50 hover:text-white transition-colors cursor-pointer shrink-0 mt-0.5"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Left Sidebar */}
          <Sidebar
            currentRole={role}
            onChangeRole={(newRole) => {
              setRole(newRole);
              setIsSidebarOpen(false);
            }}
            isOpen={isSidebarOpen}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
            authType={selectedPortal}
            adminSubRole={loginAdminRole}
            onOpenSettings={() => setIsSettingsOpen(true)}
            aiEnabled={aiEnabled}
          />

          {/* Right Main Panel Surface */}
          <div className="flex-1 flex flex-col h-screen overflow-hidden">
            {/* Top Navigation Control bar */}
            <Topbar
              currentRole={role}
              adminSubRole={loginAdminRole}
              unreadCount={myUnreadCount}
              onLogoutClick={() => setIsLogoutModalOpen(true)}
              notifications={myNotifications}
              readNotificationIds={readNotificationIds}
              onMarkNotificationsRead={markNotificationsRead}
              onToggleSidebar={() => {
                if (window.innerWidth >= 1024) {
                  setIsSidebarCollapsed((prev) => !prev);
                } else {
                  setIsSidebarOpen((prev) => !prev);
                }
              }}
              onOpenSettings={() => setIsSettingsOpen(true)}
              displayName={authUser?.fullName}
              roleLabel={authUser ? ROLE_LABELS[authUser.role] : undefined}
            />

            {/* Network Error Resiliency Alert banner */}
            {networkError && (
              <div className="bg-safety-amber/15 border-b border-safety-amber/30 text-safety-amber px-6 py-2.5 flex items-center justify-between text-xs font-sans shrink-0">
                <span className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {networkError}
                </span>
                <button
                  onClick={fetchDatabase}
                  className="px-2 py-0.5 bg-safety-amber/10 hover:bg-safety-amber/25 border border-safety-amber/20 rounded font-mono font-bold uppercase text-xs"
                >
                  RETRY CONNECT
                </button>
              </div>
            )}

            {/* Render Dashboard Screen based on current active role */}
            {role === "Admin" && (
              loginAdminRole === "PPO" ? (
                <AdminDashboard
                  tickets={jobOrders}
                  staffRoster={staffRoster}
                  maxWorkerTaskLimit={maxWorkerTaskLimit}
                  logs={logs}
                  userAccounts={userAccounts}
                  onCreateUser={handleCreateUser}
                  onDeleteUser={handleDeleteUser}
                  onDeleteJobOrder={handleDeleteJobOrder}
                  onOverride={handleOverride}
                  onApprove={handleApprove}
                  onUpdateStatus={handleUpdateStatus}
                  onTicketClick={acknowledgeEmergencyTicket}
                  onSchoolHeadApprove={handleSchoolHeadApprove}
                  onFinanceApprove={handleFinanceApprove}
                  onSubmitRequest={handleSubmitRequest}
                  isSubmitting={isSubmitting}
                  officeOptions={[...Object.values(DEPT_OFFICE_LABELS), ...ADMIN_OFFICE_LABELS]}
                  requestedByDefault={authUser?.fullName}
                  aiEnabled={aiEnabled}
                  notifications={myNotifications}
                  readNotificationIds={readNotificationIds}
                  onMarkNotificationsRead={markNotificationsRead}
                />
              ) : loginAdminRole === "President" ? (
                <SchoolHeadDashboard
                  tickets={jobOrders}
                  onSchoolHeadApprove={handleSchoolHeadApprove}
                  displayName={authUser?.fullName}
                  onSubmitRequest={handleSubmitRequest}
                  isSubmitting={isSubmitting}
                  officeOptions={[...Object.values(DEPT_OFFICE_LABELS), ...ADMIN_OFFICE_LABELS]}
                  requestedByDefault={authUser?.fullName}
                  aiEnabled={aiEnabled}
                  notifications={myNotifications}
                  readNotificationIds={readNotificationIds}
                  onMarkNotificationsRead={markNotificationsRead}
                />
              ) : (
                <FinanceDashboard
                  tickets={jobOrders}
                  onFinanceApprove={handleFinanceApprove}
                  onSubmitRequest={handleSubmitRequest}
                  isSubmitting={isSubmitting}
                  officeOptions={[...Object.values(DEPT_OFFICE_LABELS), ...ADMIN_OFFICE_LABELS]}
                  requestedByDefault={authUser?.fullName}
                  aiEnabled={aiEnabled}
                  notifications={myNotifications}
                  readNotificationIds={readNotificationIds}
                  onMarkNotificationsRead={markNotificationsRead}
                />
              )
            )}

            {role === "Dept" && (
              <DeptDashboard
                tickets={jobOrders}
                notifications={notifications}
                officeName={DEPT_OFFICE_LABELS[loginDept] || loginDept}
                onSubmitRequest={handleSubmitRequest}
                isSubmitting={isSubmitting}
                aiEnabled={aiEnabled}
              />
            )}

            {role === "Staff" && (
              <StaffDashboard
                tickets={jobOrders}
                onUpdateStatus={handleUpdateStatus}
                activeStaffName={authUser?.fullName || loginStaff}
                notifications={myNotifications}
                readNotificationIds={readNotificationIds}
                onMarkNotificationsRead={markNotificationsRead}
              />
            )}

            {role === "Report" && (
              <ReportDashboard
                tickets={jobOrders}
                authedFetch={authedFetch}
              />
            )}
          </div>

          {/* Centered Logout Modal */}
          <LogoutModal
            isOpen={isLogoutModalOpen}
            onCancel={() => setIsLogoutModalOpen(false)}
            onConfirm={handleLogoutConfirm}
          />

          {/* System Settings & User Accounts Modal */}
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            users={userAccounts}
            onCreateUser={handleCreateUser}
            onEditUser={handleEditUser}
            onDeleteUser={handleDeleteUser}
            currentUserRole={authUser?.role}
            tickets={jobOrders}
            themeMode={themeMode}
            onChangeTheme={(t) => {
              setThemeMode(t);
              localStorage.setItem("jors_theme", t);
            }}
            fontSizeScale={fontSizeScale}
            onChangeFontScale={(f) => {
              setFontSizeScale(f);
              localStorage.setItem("jors_font_scale", String(f));
            }}
            highContrastMode={highContrastMode}
            onToggleHighContrast={(v) => {
              setHighContrastMode(v);
              localStorage.setItem("jors_high_contrast", String(v));
            }}
            desktopNotifSupported={desktopNotifSupported}
            desktopNotifPermission={desktopNotifPermission}
            onRequestDesktopNotifPermission={requestDesktopNotifPermission}
            maxWorkerTaskLimit={maxWorkerTaskLimit}
            onChangeMaxWorkerTaskLimit={handleUpdateMaxWorkerTaskLimit}
            staffProfiles={staffProfiles}
            skillsList={skillsList}
            onCreateSkill={handleCreateSkill}
            onAssignStaffSkill={handleAssignStaffSkill}
            onRemoveStaffSkill={handleRemoveStaffSkill}
            onUpdateStaffDegree={handleUpdateStaffDegree}
            onDeleteStaff={handleDeleteStaff}
            currentUser={authUser}
            onUpdateOwnProfile={handleUpdateOwnProfile}
            onRequestPasswordOtp={requestPasswordResetOtp}
            onConfirmPasswordReset={confirmPasswordResetWithOtp}
          />
        </React.Fragment>
      )}
      {/* Gmail Password Recovery Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 bg-[#241012]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E6DDD3] rounded-2xl shadow-2xl max-w-md w-full p-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="absolute top-0 left-0 right-0 h-[4px] bg-[#C41230]" />

            <div className="flex items-center justify-between pb-4 border-b border-[#E6DDD3]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#C41230]/10 text-[#C41230]">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-xl text-[#241012]">
                    Gmail Credential Recovery
                  </h3>
                  <p className="text-xs text-slate-600">Account Self-Service Password Reset</p>
                </div>
              </div>
              <button
                onClick={() => setIsForgotModalOpen(false)}
                className="p-1 rounded-lg text-slate-600 hover:text-[#241012] hover:bg-[#F0EAE4] transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {recoveryError && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-sans rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{recoveryError}</span>
                </div>
              )}

              {recoveryMsg && (
                <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-sans rounded-lg p-3">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{recoveryMsg}</p>
                </div>
              )}

              {recoveryStep === 1 && (
                <form onSubmit={handleSendRecoveryOtp} className="space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Enter your registered department Gmail address or username below. A 6-digit verification code will be generated and dispatched.
                  </p>

                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-600 uppercase mb-1">
                      Department Gmail / Email Address
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="e.g. academic.affairs@cosca.edu.ph or it.services"
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                        className="w-full text-sm font-sans pl-9 pr-3 py-2.5 rounded-lg border border-[#E6DDD3] bg-[#F5F1EC] text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#C41230]"
                      />
                      <Mail className="w-4 h-4 text-slate-600 absolute left-3 top-3" />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsForgotModalOpen(false)}
                      className="px-3.5 py-2 text-xs font-mono font-bold rounded bg-[#E6DDD3] text-[#4A322E] hover:bg-[#DDD2C8]"
                    >
                      CANCEL
                    </button>
                    <button
                      type="submit"
                      disabled={recoveryBusy}
                      className="px-4 py-2 text-xs font-mono font-bold rounded bg-[#C41230] text-white hover:bg-[#9C0E24] disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      {recoveryBusy ? "Sending Code..." : "Send Reset Code"}
                      {!recoveryBusy && <ArrowRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </form>
              )}

              {recoveryStep === 2 && (
                <form onSubmit={handleResetPasswordWithOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-600 uppercase mb-1">
                      6-Digit Verification Code (OTP)
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="123456"
                      value={recoveryOtp}
                      onChange={(e) => setRecoveryOtp(e.target.value)}
                      className="w-full text-center tracking-widest font-mono text-lg py-2 rounded-lg border border-[#E6DDD3] bg-[#F5F1EC] text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#C41230]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-600 uppercase mb-1">
                      New Department Access Key
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        required
                        placeholder="Minimum 6 characters"
                        value={recoveryNewPassword}
                        onChange={(e) => setRecoveryNewPassword(e.target.value)}
                        className="w-full text-sm font-sans pl-9 pr-3 py-2.5 rounded-lg border border-[#E6DDD3] bg-[#F5F1EC] text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#C41230]"
                      />
                      <Lock className="w-4 h-4 text-slate-600 absolute left-3 top-3" />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setRecoveryStep(1)}
                      className="px-3.5 py-2 text-xs font-mono font-bold rounded bg-[#E6DDD3] text-[#4A322E] hover:bg-[#DDD2C8]"
                    >
                      BACK
                    </button>
                    <button
                      type="submit"
                      disabled={recoveryBusy}
                      className="px-4 py-2 text-xs font-mono font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                    >
                      {recoveryBusy ? "Updating Password..." : "Confirm New Password"}
                    </button>
                  </div>
                </form>
              )}

              {recoveryStep === 3 && (
                <div className="text-center py-4 space-y-4">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h4 className="font-display font-bold text-lg text-[#241012]">Password Successfully Reset!</h4>
                  <p className="text-xs text-slate-600">Your department access key has been updated. You may now log in using your new password.</p>
                  <button
                    onClick={() => setIsForgotModalOpen(false)}
                    className="w-full py-2.5 rounded-lg bg-[#C41230] text-white font-mono font-bold text-xs hover:bg-[#9C0E24] cursor-pointer"
                  >
                    Return to Login
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}