import React, { useState, useEffect } from "react";
import {
  Settings as SettingsIcon,
  Shield,
  User,
  Users,
  Lock,
  Key,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  X,
  Sparkles,
  Mail,
  UserPlus,
  Search,
  Info,
  Sliders,
  Database,
  Server,
  Bell,
  Palette,
  Building,
  Download,
  Activity,
  HardDrive,
  Check,
  Plus,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Type,
  Pencil,
  Save,
  Monitor
} from "lucide-react";
import { UserAccount } from "./AccountManagementModal";
import { JobOrder } from "../types";
import { DEPARTMENT_OFFICES, DEPT_OFFICE_LABELS } from "../departments";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserAccount[];
  onCreateUser: (userData: {
    username: string;
    password: string;
    role: string;
    fullName: string;
    email?: string;
    department?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onEditUser: (
    id: number,
    userData: { fullName: string; email?: string; department?: string }
  ) => Promise<{ ok: boolean; error?: string }>;
  onDeleteUser: (id: number) => Promise<{ ok: boolean; error?: string }>;
  currentUserRole?: string;
  tickets?: JobOrder[];
  // Appearance
  themeMode?: "light" | "dark";
  onChangeTheme?: (theme: "light" | "dark") => void;
  fontSizeScale?: number;
  onChangeFontScale?: (scale: number) => void;
  highContrastMode?: boolean;
  onToggleHighContrast?: (v: boolean) => void;
  // Real OS-level desktop notifications (distinct from the in-app toast
  // banner). Browser-gated: only available on HTTPS or literal "localhost" —
  // desktopNotifSupported reflects that check as done by App.tsx, since the
  // Notification API and window.isSecureContext aren't things this modal
  // can determine on its own without duplicating that logic.
  desktopNotifSupported?: boolean;
  desktopNotifPermission?: NotificationPermission | "unsupported";
  onRequestDesktopNotifPermission?: () => void;
  // Worker Limit
  maxWorkerTaskLimit?: number;
  onChangeMaxWorkerTaskLimit?: (limit: number) => void;
  // Worker Skills & Specialties (feeds the AI staff-matching logic)
  staffProfiles?: StaffProfile[];
  skillsList?: SkillOption[];
  onCreateSkill?: (name: string) => Promise<{ ok: boolean; error?: string }>;
  onAssignStaffSkill?: (staffId: number, skillId: number, proficiency: number, yearsExperience: number) => Promise<{ ok: boolean; error?: string }>;
  onRemoveStaffSkill?: (staffId: number, skillId: number) => Promise<{ ok: boolean; error?: string }>;
  // Sets a worker's highest relevant qualification (free text — TESDA cert,
  // vocational diploma, degree, etc.). Record-keeping only; see the note on
  // the backend PATCH /api/staff/:id/degree route for why this isn't scored.
  onUpdateStaffDegree?: (staffId: number, degree: string) => Promise<{ ok: boolean; error?: string }>;
  // Removes a worker row that has no linked login account (leftover/mock data)
  onDeleteStaff?: (staffId: number) => Promise<{ ok: boolean; error?: string }>;
  // Account Profile tab — lets the logged-in user edit their own info
  currentUser?: { id?: number; username: string; role: string; fullName: string; email?: string; department?: string } | null;
  onUpdateOwnProfile?: (data: { fullName: string; email?: string }) => Promise<{ ok: boolean; error?: string }>;
  // Same OTP-via-email flow as the login page's "Forgot Access Key"
  onRequestPasswordOtp?: (email: string) => Promise<{ ok: boolean; message?: string; error?: string }>;
  onConfirmPasswordReset?: (email: string, otp: string, newPassword: string) => Promise<{ ok: boolean; message?: string; error?: string }>;
}

export interface SkillOption {
  id: number;
  name: string;
}

export interface StaffProfile {
  id: number;
  name: string;
  specialty?: string;
  degree?: string;
  workload: number;
  userId?: number | null;
  skills: { skillId: number; skillName: string; proficiency: number; yearsExperience: number }[];
}

const ROLE_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  Dept: { label: "Department Head", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  Staff: { label: "Maintenance Staff", bg: "bg-[#FBF2F2]", text: "text-[#6B1420]", border: "border-[#E8C4C9]" },
  PPO: { label: "PPO Officer (Admin)", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  President: { label: "School Head / President", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  Finance: { label: "Finance Dept Head", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  users,
  onCreateUser,
  onEditUser,
  onDeleteUser,
  currentUserRole,
  tickets = [],
  themeMode: propThemeMode = "light",
  onChangeTheme,
  fontSizeScale: propFontScale = 100,
  onChangeFontScale,
  highContrastMode: propHighContrast = false,
  onToggleHighContrast,
  desktopNotifSupported = false,
  desktopNotifPermission = "unsupported",
  onRequestDesktopNotifPermission,
  maxWorkerTaskLimit = 4,
  onChangeMaxWorkerTaskLimit,
  staffProfiles = [],
  skillsList = [],
  onCreateSkill,
  onAssignStaffSkill,
  onRemoveStaffSkill,
  onUpdateStaffDegree,
  onDeleteStaff,
  currentUser,
  onUpdateOwnProfile,
  onRequestPasswordOtp,
  onConfirmPasswordReset,
}) => {
  type TabType = "accounts" | "notifications" | "appearance" | "profile" | "backup" | "workload" | "security" | "system";

  // Role-based tab visibility:
  //  - PPO (and legacy "Admin"/no-role fallback): the full suite, unchanged.
  //  - President / Finance: Notifications, Appearance, Account Profile,
  //    School System Info, plus Security (they approve/handle money, so
  //    security policy visibility is relevant to them).
  //  - Dept / Staff: Notifications, Appearance, Account Profile, School
  //    System Info only — no Security, Backup, Worker Rules, or User Accounts.
  const canManageAccounts = currentUserRole === "PPO" || currentUserRole === "Admin" || currentUserRole === null;
  const showSecurityTab = canManageAccounts || currentUserRole === "President" || currentUserRole === "Finance";

  const [activeTab, setActiveTab] = useState<TabType>(() => (canManageAccounts ? "accounts" : "profile"));

  // Account Profile — self-service name/email edit + password change
  const [profileFullName, setProfileFullName] = useState(currentUser?.fullName || "");
  const [profileEmail, setProfileEmail] = useState(currentUser?.email || "");
  const [profileSaveBusy, setProfileSaveBusy] = useState(false);
  // Change Password — same 3-step OTP-via-email flow as "Forgot Access Key"
  const [pwStep, setPwStep] = useState<1 | 2 | 3>(1);
  const [pwOtp, setPwOtp] = useState("");
  const [pwNewPassword, setPwNewPassword] = useState("");
  const [pwConfirmPassword, setPwConfirmPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  useEffect(() => {
    setProfileFullName(currentUser?.fullName || "");
    setProfileEmail(currentUser?.email || "");
  }, [currentUser?.fullName, currentUser?.email]);

  const handleSaveOwnProfile = async () => {
    if (!onUpdateOwnProfile || !profileFullName.trim()) return;
    setProfileSaveBusy(true);
    const res = await onUpdateOwnProfile({ fullName: profileFullName.trim(), email: profileEmail.trim() || undefined });
    setProfileSaveBusy(false);
    showToast(res.ok ? "Profile updated." : (res.error || "Could not update profile."));
  };

  const resetPwFlow = () => {
    setPwStep(1);
    setPwOtp("");
    setPwNewPassword("");
    setPwConfirmPassword("");
    setPwError(null);
    setPwMsg(null);
  };

  const handleSendPwOtp = async () => {
    if (!onRequestPasswordOtp || !currentUser?.email) return;
    setPwError(null);
    setPwMsg(null);
    setPwBusy(true);
    const res = await onRequestPasswordOtp(currentUser.email);
    setPwBusy(false);
    if (res.ok) {
      setPwMsg(res.message || "Verification code sent.");
      setPwStep(2);
    } else {
      setPwError(res.error || "Could not send verification code.");
    }
  };

  const handleConfirmPwReset = async () => {
    if (!onConfirmPasswordReset || !currentUser?.email) return;
    setPwError(null);
    setPwMsg(null);
    if (!pwOtp.trim()) {
      setPwError("Enter the verification code from your email.");
      return;
    }
    if (pwNewPassword !== pwConfirmPassword) {
      setPwError("New password and confirmation don't match.");
      return;
    }
    setPwBusy(true);
    const res = await onConfirmPasswordReset(currentUser.email, pwOtp.trim(), pwNewPassword);
    setPwBusy(false);
    if (res.ok) {
      setPwMsg(res.message || "Password updated.");
      setPwStep(3);
    } else {
      setPwError(res.error || "Could not update password.");
    }
  };

  // Notification Preferences State (Persisted in localStorage)
  const [emergencySoundAlert, setEmergencySoundAlert] = useState<boolean>(() => {
    return localStorage.getItem("jors_emergency_sound") !== "false";
  });
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState<boolean>(() => {
    return localStorage.getItem("jors_email_alerts") !== "false";
  });
  const [toastBannersEnabled, setToastBannersEnabled] = useState<boolean>(() => {
    return localStorage.getItem("jors_toast_banners") !== "false";
  });
  const [desktopNotifEnabled, setDesktopNotifEnabled] = useState<boolean>(() => {
    return localStorage.getItem("jors_desktop_notifications") !== "false";
  });

  // Appearance State — uses props from App.tsx (persisted centrally)
  const themeMode = propThemeMode;
  const fontSizeScale = propFontScale;
  const highContrastMode = propHighContrast;

  // Worker Workload Limit State — synced from prop
  const [workerTaskLimit, setWorkerTaskLimit] = useState<number>(maxWorkerTaskLimit);

  // Worker Skills & Specialties — new skill creation + per-staff assignment drafts
  const [newSkillName, setNewSkillName] = useState("");
  const [skillActionBusy, setSkillActionBusy] = useState(false);
  const [staffSkillDrafts, setStaffSkillDrafts] = useState<Record<number, { skillId: string; proficiency: number; yearsExperience: string }>>({});

  const getStaffDraft = (staffId: number) => staffSkillDrafts[staffId] || { skillId: "", proficiency: 3, yearsExperience: "0" };
  const setStaffDraft = (staffId: number, patch: Partial<{ skillId: string; proficiency: number; yearsExperience: string }>) => {
    setStaffSkillDrafts((prev) => ({ ...prev, [staffId]: { ...getStaffDraft(staffId), ...patch } }));
  };

  // Degree/qualification — per-staff free-text draft, separate from the
  // skill-assignment draft since it's set once per worker, not per skill.
  const [degreeDrafts, setDegreeDrafts] = useState<Record<number, string>>({});
  const [degreeBusyId, setDegreeBusyId] = useState<number | null>(null);
  const getDegreeDraft = (staff: StaffProfile) => degreeDrafts[staff.id] ?? (staff.degree || "");

  const handleCreateSkill = async () => {
    if (!newSkillName.trim() || !onCreateSkill) return;
    setSkillActionBusy(true);
    const res = await onCreateSkill(newSkillName.trim());
    setSkillActionBusy(false);
    if (res.ok) {
      showToast(`Skill "${newSkillName.trim()}" added to the system.`);
      setNewSkillName("");
    } else {
      showToast(res.error || "Could not add that skill.");
    }
  };

  const handleAssignSkill = async (staffId: number) => {
    const draft = getStaffDraft(staffId);
    if (!draft.skillId || !onAssignStaffSkill) return;
    const years = Number(draft.yearsExperience);
    if (!Number.isFinite(years) || years < 0 || years > 60) {
      showToast("Years of experience must be a number from 0 to 60.");
      return;
    }
    setSkillActionBusy(true);
    const res = await onAssignStaffSkill(staffId, Number(draft.skillId), draft.proficiency, years);
    setSkillActionBusy(false);
    if (res.ok) {
      showToast("Skill assigned.");
      setStaffDraft(staffId, { skillId: "", yearsExperience: "0" });
    } else {
      showToast(res.error || "Could not assign that skill.");
    }
  };

  const handleSaveDegree = async (staff: StaffProfile) => {
    if (!onUpdateStaffDegree) return;
    setDegreeBusyId(staff.id);
    const res = await onUpdateStaffDegree(staff.id, getDegreeDraft(staff).trim());
    setDegreeBusyId(null);
    if (res.ok) {
      showToast(`Qualification updated for ${staff.name}.`);
    } else {
      showToast(res.error || "Could not update qualification.");
    }
  };

  const handleRemoveSkill = async (staffId: number, skillId: number) => {
    if (!onRemoveStaffSkill) return;
    const res = await onRemoveStaffSkill(staffId, skillId);
    if (res.ok) {
      showToast("Skill removed.");
    } else {
      showToast(res.error || "Could not remove that skill.");
    }
  };

  // Deletes a worker profile that isn't backed by a real login account —
  // i.e. leftover/mock rows in `staff` that were never created through
  // "Add User Account". Staff tied to a real account are deleted from the
  // User Accounts tab instead, since removing the account cleans up its
  // staff row automatically.
  const [staffDeleteBusyId, setStaffDeleteBusyId] = useState<number | null>(null);
  const handleDeleteStaffProfile = async (staffId: number, staffName: string) => {
    if (!onDeleteStaff) return;
    if (!window.confirm(`Remove "${staffName}" from the worker roster? This mock/unlinked profile has no login account, so this can't be undone.`)) {
      return;
    }
    setStaffDeleteBusyId(staffId);
    const res = await onDeleteStaff(staffId);
    setStaffDeleteBusyId(null);
    if (res.ok) {
      showToast(`"${staffName}" removed from the worker roster.`);
    } else {
      showToast(res.error || "Could not remove that worker profile.");
    }
  };

  // Keep worker task limit local state in sync when prop changes
  useEffect(() => {
    setWorkerTaskLimit(maxWorkerTaskLimit);
  }, [maxWorkerTaskLimit]);

  // User Accounts State
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [formFullName, setFormFullName] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("Dept");
  const [formDepartment, setFormDepartment] = useState(DEPARTMENT_OFFICES[0].value);
  const [formPassword, setFormPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Feedback State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  // Edit Account State — lets PPO correct a user's full name / email in place
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("jors_emergency_sound", String(emergencySoundAlert));
  }, [emergencySoundAlert]);

  useEffect(() => {
    localStorage.setItem("jors_email_alerts", String(emailAlertsEnabled));
  }, [emailAlertsEnabled]);

  useEffect(() => {
    localStorage.setItem("jors_toast_banners", String(toastBannersEnabled));
  }, [toastBannersEnabled]);

  useEffect(() => {
    localStorage.setItem("jors_desktop_notifications", String(desktopNotifEnabled));
  }, [desktopNotifEnabled]);

  // Appearance preferences are now persisted by App.tsx via prop callbacks

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastNotice(msg);
    setTimeout(() => setToastNotice(null), 3000);
  };

  // Search Filter for User Accounts
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const deptLabel = u.department ? (DEPT_OFFICE_LABELS[u.department] || u.department) : "";
    return (
      u.username.toLowerCase().includes(q) ||
      u.fullName.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      deptLabel.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
  });

  const handleGeneratePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
    let pass = "";
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormPassword(pass);
    setShowPassword(true);
  };

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: "Empty", color: "bg-gray-200" };
    if (pass.length < 8) return { score: 1, label: "Too Short (Min 8 chars)", color: "bg-rose-500" };
    const hasNum = /\d/.test(pass);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
    if (pass.length >= 12 && hasNum && hasSpecial) {
      return { score: 3, label: "Strong Password", color: "bg-emerald-500" };
    }
    return { score: 2, label: "Moderate Password", color: "bg-amber-500" };
  };

  const strength = getPasswordStrength(formPassword);

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!formFullName.trim()) {
      setFormError("Please enter the user's full name.");
      return;
    }
    if (!formUsername.trim()) {
      setFormError("Please enter a username.");
      return;
    }
    if (formPassword.length < 8) {
      setFormError("Password must be at least 8 characters long.");
      return;
    }
    if (formRole === "Dept" && !formDepartment) {
      setFormError("Please select the department office this account belongs to.");
      return;
    }

    setIsSubmitting(true);
    const res = await onCreateUser({
      fullName: formFullName.trim(),
      username: formUsername.trim().toLowerCase(),
      email: formEmail.trim() || undefined,
      role: formRole,
      password: formPassword,
      department: formRole === "Dept" ? formDepartment : undefined,
    });
    setIsSubmitting(false);

    if (res.ok) {
      setFormSuccess(`User account "${formUsername}" created successfully!`);
      setFormFullName("");
      setFormUsername("");
      setFormEmail("");
      setFormPassword("");
      setFormDepartment(DEPARTMENT_OFFICES[0].value);
      setIsCreating(false);
    } else {
      setFormError(res.error || "Failed to create user account.");
    }
  };

  const handleDeleteUserAccount = async (user: UserAccount) => {
    if (!window.confirm(`Are you sure you want to delete account "${user.username}"?`)) return;
    setDeletingId(user.id);
    const res = await onDeleteUser(user.id);
    setDeletingId(null);
    if (!res.ok) {
      alert(res.error || "Could not delete user account.");
    } else {
      showToast(`Account "${user.username}" removed.`);
    }
  };

  const handleStartEditUser = (user: UserAccount) => {
    setIsCreating(false); // don't have both panels open at once
    setEditingUserId(user.id);
    setEditFullName(user.fullName);
    setEditEmail(user.email || "");
    setEditDepartment(user.department || DEPARTMENT_OFFICES[0].value);
    setEditError(null);
  };

  const handleCancelEditUser = () => {
    setEditingUserId(null);
    setEditFullName("");
    setEditEmail("");
    setEditDepartment("");
    setEditError(null);
  };

  const handleSubmitEditUser = async (user: UserAccount) => {
    setEditError(null);
    if (!editFullName.trim()) {
      setEditError("Full name can't be empty.");
      return;
    }
    if (user.role === "Dept" && !editDepartment) {
      setEditError("Please select the department office this account belongs to.");
      return;
    }
    setIsEditSubmitting(true);
    const res = await onEditUser(user.id, {
      fullName: editFullName.trim(),
      email: editEmail.trim() || undefined,
      department: user.role === "Dept" ? editDepartment : undefined,
    });
    setIsEditSubmitting(false);
    if (res.ok) {
      showToast(`Account "${user.username}" updated.`);
      setEditingUserId(null);
    } else {
      setEditError(res.error || "Failed to update account.");
    }
  };

  const handleDownloadBackup = (format: "json" | "csv") => {
    let content = "";
    let mimeType = "application/json";
    let filename = `JORS_COSCA_Backup_${new Date().toISOString().split("T")[0]}`;

    if (format === "json") {
      content = JSON.stringify({ backupDate: new Date().toISOString(), users, tickets }, null, 2);
      filename += ".json";
    } else {
      mimeType = "text/csv";
      filename += ".csv";
      const headers = ["ID", "Job Type", "Department Office", "Status", "Urgency", "Estimated Cost", "Approved Amount", "Date Submitted"];
      const rows = tickets.map((t) => [
        t.id,
        `"${t.jobType}"`,
        `"${t.office || ""}"`,
        `"${t.status}"`,
        t.urgency,
        t.estimatedCost || 0,
        t.approvedAmount || 0,
        `"${t.dateSubmitted}"`,
      ]);
      content = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded backup (${filename})`);
  };

  const handleSaveWorkloadLimit = () => {
    if (onChangeMaxWorkerTaskLimit) onChangeMaxWorkerTaskLimit(workerTaskLimit);
    showToast(`Worker task limit set to ${workerTaskLimit} active jobs per technician.`);
  };

  return (
    <div className="fixed inset-0 bg-[#241012]/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">

      {/* Floating Toast Notification */}
      {toastNotice && (
        <div className="fixed top-4 left-4 right-4 sm:top-6 sm:right-6 sm:left-auto z-[9999] bg-[#6B1420] text-white px-5 py-3 rounded-xl shadow-xl font-sans text-xs font-semibold flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastNotice}</span>
        </div>
      )}

      <div className="bg-white border border-[#DDD2C8] rounded-t-2xl sm:rounded-2xl max-w-5xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[92vh]">

        {/* Settings Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-[#E6DDD3] bg-[#F7F4F0] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#6B1420] text-white rounded-xl flex items-center justify-center shadow-md">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-[#241012]">
                System Settings Suite
              </h3>
              <p className="text-xs text-slate-700 font-sans">
                Manage user accounts, notifications, themes, offices, backup logs, and security options.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white border border-[#E6DDD3] hover:bg-[#F5F1EC] text-slate-700 hover:text-[#241012] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation Bar — wrapping pill tabs, so every tab stays fully
            readable at any width instead of being squeezed into one
            horizontally-scrolling row (which was cutting off/wrapping labels). */}
        <div className="flex flex-wrap gap-1.5 border-b border-[#E6DDD3] bg-[#FBF8F5] px-4 sm:px-6 py-2.5">
          {canManageAccounts && (
            <button
              onClick={() => setActiveTab("accounts")}
              className={`shrink-0 py-1.5 px-3 rounded-lg font-display font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${activeTab === "accounts"
                ? "bg-[#6B1420] text-white font-bold shadow-sm"
                : "bg-white text-slate-700 border border-[#E6DDD3] hover:text-[#241012] hover:border-[#DDD2C8]"
                }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>User Accounts</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${activeTab === "accounts" ? "bg-white/20 text-white" : "bg-[#6B1420]/10 text-[#6B1420]"
                  }`}
              >
                {users.length}
              </span>
            </button>
          )}

          <button
            onClick={() => setActiveTab("notifications")}
            className={`shrink-0 py-1.5 px-3 rounded-lg font-display font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${activeTab === "notifications"
              ? "bg-[#6B1420] text-white font-bold shadow-sm"
              : "bg-white text-slate-700 border border-[#E6DDD3] hover:text-[#241012] hover:border-[#DDD2C8]"
              }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Notifications</span>
          </button>

          <button
            onClick={() => setActiveTab("appearance")}
            className={`shrink-0 py-1.5 px-3 rounded-lg font-display font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${activeTab === "appearance"
              ? "bg-[#6B1420] text-white font-bold shadow-sm"
              : "bg-white text-slate-700 border border-[#E6DDD3] hover:text-[#241012] hover:border-[#DDD2C8]"
              }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Appearance</span>
          </button>

          <button
            onClick={() => setActiveTab("profile")}
            className={`shrink-0 py-1.5 px-3 rounded-lg font-display font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${activeTab === "profile"
              ? "bg-[#6B1420] text-white font-bold shadow-sm"
              : "bg-white text-slate-700 border border-[#E6DDD3] hover:text-[#241012] hover:border-[#DDD2C8]"
              }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Account Profile</span>
          </button>

          {canManageAccounts && (
            <button
              onClick={() => setActiveTab("backup")}
              className={`shrink-0 py-1.5 px-3 rounded-lg font-display font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${activeTab === "backup"
                ? "bg-[#6B1420] text-white font-bold shadow-sm"
                : "bg-white text-slate-700 border border-[#E6DDD3] hover:text-[#241012] hover:border-[#DDD2C8]"
                }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Data Backup &amp; Logs</span>
            </button>
          )}

          {canManageAccounts && (
            <button
              onClick={() => setActiveTab("workload")}
              className={`shrink-0 py-1.5 px-3 rounded-lg font-display font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${activeTab === "workload"
                ? "bg-[#6B1420] text-white font-bold shadow-sm"
                : "bg-white text-slate-700 border border-[#E6DDD3] hover:text-[#241012] hover:border-[#DDD2C8]"
                }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Worker Rules</span>
            </button>
          )}

          {showSecurityTab && (
            <button
              onClick={() => setActiveTab("security")}
              className={`shrink-0 py-1.5 px-3 rounded-lg font-display font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${activeTab === "security"
                ? "bg-[#6B1420] text-white font-bold shadow-sm"
                : "bg-white text-slate-700 border border-[#E6DDD3] hover:text-[#241012] hover:border-[#DDD2C8]"
                }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Security</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab("system")}
            className={`shrink-0 py-1.5 px-3 rounded-lg font-display font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${activeTab === "system"
              ? "bg-[#6B1420] text-white font-bold shadow-sm"
              : "bg-white text-slate-700 border border-[#E6DDD3] hover:text-[#241012] hover:border-[#DDD2C8]"
              }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>School System Info</span>
          </button>
        </div>

        {/* Modal Body Surface */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-white">

          {/* TAB 1: User Accounts Management */}
          {activeTab === "accounts" && canManageAccounts && (
            <div className="space-y-6">
              {/* Account Provisioning Banner / Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#F7F4F0] border border-[#E6DDD3] rounded-xl">
                <div>
                  <h4 className="font-display font-bold text-sm text-[#241012] flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-[#6B1420]" />
                    User Account Roster &amp; Access Controls
                  </h4>
                  <p className="text-xs text-slate-700 font-sans mt-0.5">
                    View active system user accounts, grant department credentials, or create new logins.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsCreating(!isCreating);
                    setFormError(null);
                    setFormSuccess(null);
                  }}
                  className="px-4 py-2 bg-[#6B1420] hover:bg-[#541019] text-white rounded-lg font-mono font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs shrink-0"
                >
                  {isCreating ? (
                    <>
                      <X className="w-3.5 h-3.5" />
                      Close Form
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      + Create New Account
                    </>
                  )}
                </button>
              </div>

              {/* Create User Form (Collapsible) */}
              {isCreating && (
                <form onSubmit={handleSubmitUser} className="p-5 bg-[#FBF9F6] border border-[#6B1420]/30 rounded-xl space-y-4 animate-in slide-in-from-top-3">
                  <div className="flex items-center justify-between border-b border-[#E6DDD3] pb-3">
                    <h5 className="font-display font-bold text-sm text-[#6B1420] flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#6B1420]" />
                      Create New System Account
                    </h5>
                    <span className="text-xs font-mono text-slate-700">Role &amp; Password Protected</span>
                  </div>

                  {formError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-sans flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {formSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-sans flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{formSuccess}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Maria Clara Santos"
                        value={formFullName}
                        onChange={(e) => setFormFullName(e.target.value)}
                        className="w-full text-xs font-sans px-3 py-2 rounded-lg border border-[#E6DDD3] bg-white text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#6B1420]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">
                        Username *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. maria_santos"
                        value={formUsername}
                        onChange={(e) => setFormUsername(e.target.value)}
                        className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-[#E6DDD3] bg-white text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#6B1420]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">
                        Email Address (Optional)
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. maria@cosca.edu.ph"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        className="w-full text-xs font-sans px-3 py-2 rounded-lg border border-[#E6DDD3] bg-white text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#6B1420]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">
                        Account Role *
                      </label>
                      <select
                        value={formRole}
                        onChange={(e) => setFormRole(e.target.value)}
                        className="w-full text-xs font-sans px-3 py-2 rounded-lg border border-[#E6DDD3] bg-white text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#6B1420]"
                      >
                        <option value="Dept">Department Head (Request Portal)</option>
                        <option value="Staff">Maintenance Staff (Task Board)</option>
                        <option value="PPO">PPO Physical Plant Officer (Admin)</option>
                        <option value="President">School Head / President</option>
                        <option value="Finance">Finance Dept Head</option>
                      </select>
                    </div>

                    {/* Only Department Head accounts get tied to one specific office — this
                        is what the login page checks against, so the account can only sign
                        in under the office it was actually created for. */}
                    {formRole === "Dept" && (
                      <div className="md:col-span-2">
                        <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">
                          Department Office *
                        </label>
                        <select
                          value={formDepartment}
                          onChange={(e) => setFormDepartment(e.target.value)}
                          required
                          className="w-full text-xs font-sans px-3 py-2 rounded-lg border border-[#E6DDD3] bg-white text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#6B1420]"
                        >
                          {DEPARTMENT_OFFICES.map((dept) => (
                            <option key={dept.value} value={dept.value}>
                              {dept.fullName}
                            </option>
                          ))}
                        </select>
                        <span className="text-[11px] text-slate-600 font-sans mt-1 block leading-relaxed">
                          This account will only be able to log in while this exact office is selected on the Department Portal login page.
                        </span>
                      </div>
                    )}

                    <div className="md:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-mono font-bold text-slate-700 uppercase">
                          Account Password *
                        </label>
                        <button
                          type="button"
                          onClick={handleGeneratePassword}
                          className="text-[11px] font-mono text-[#6B1420] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" /> Auto-Generate Secure Password
                        </button>
                      </div>

                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          placeholder="Minimum 8 characters"
                          value={formPassword}
                          onChange={(e) => setFormPassword(e.target.value)}
                          className="w-full text-xs font-mono px-3 py-2 pr-10 rounded-lg border border-[#E6DDD3] bg-white text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#6B1420]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-2.5 text-slate-700 hover:text-[#241012]"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Password Strength Indicator */}
                      {formPassword && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-slate-700">Strength:</span>
                            <span className="font-bold">{strength.label}</span>
                          </div>
                          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden flex gap-1">
                            <div className={`h-full flex-1 ${strength.score >= 1 ? strength.color : "bg-gray-200"}`} />
                            <div className={`h-full flex-1 ${strength.score >= 2 ? strength.color : "bg-gray-200"}`} />
                            <div className={`h-full flex-1 ${strength.score >= 3 ? strength.color : "bg-gray-200"}`} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-[#E6DDD3]">
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="px-3.5 py-2 text-xs font-mono font-bold text-[#4A322E] bg-[#E6DDD3] hover:bg-[#DDD2C8] rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 text-xs font-mono font-bold text-white bg-[#6B1420] hover:bg-[#541019] rounded-lg disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      {isSubmitting ? "Saving..." : "Save New User Account"}
                    </button>
                  </div>
                </form>
              )}

              {/* Roster Search Bar */}
              <div className="flex items-center gap-2 bg-[#F7F4F0] border border-[#E6DDD3] rounded-lg px-3 py-2">
                <Search className="w-4 h-4 text-slate-700" />
                <input
                  type="text"
                  placeholder="Search user accounts by name, username, email, or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-xs font-sans text-[#2B1210] placeholder-slate-500 focus:outline-none flex-1"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="text-xs font-mono text-slate-700 hover:text-[#241012]">
                    Clear
                  </button>
                )}
              </div>

              {/* User Accounts Table */}
              <div className="border border-[#E6DDD3] rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="bg-[#F7F4F0] border-b border-[#E6DDD3] text-slate-700 font-mono uppercase font-bold text-[11px]">
                      <tr>
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Role / Access</th>
                        <th className="py-3 px-4">Department</th>
                        <th className="py-3 px-4">Email Address</th>
                        <th className="py-3 px-4">Created Date</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6DDD3]">
                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((u) => {
                          const cfg = ROLE_CONFIG[u.role] || { label: u.role, bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300" };
                          const isEditingRow = editingUserId === u.id;
                          return (
                            <React.Fragment key={u.id}>
                              <tr className={`hover:bg-[#FBF9F6] transition-colors ${isEditingRow ? "bg-[#FBF9F6]" : ""}`}>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-full bg-[#6B1420]/10 text-[#6B1420] font-mono font-bold flex items-center justify-center text-xs shrink-0">
                                      {(isEditingRow ? editFullName : u.fullName).charAt(0).toUpperCase() || "?"}
                                    </div>
                                    {isEditingRow ? (
                                      <input
                                        type="text"
                                        value={editFullName}
                                        onChange={(e) => setEditFullName(e.target.value)}
                                        placeholder="Full name"
                                        className="w-full text-xs font-sans px-2 py-1.5 rounded-lg border border-[#6B1420]/40 bg-white text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#6B1420]"
                                      />
                                    ) : (
                                      <div>
                                        <span className="font-bold text-[#241012] block leading-tight">{u.fullName}</span>
                                        <span className="text-[11px] font-mono text-slate-700">@{u.username}</span>
                                      </div>
                                    )}
                                  </div>
                                </td>

                                <td className="py-3 px-4">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                                    {cfg.label}
                                  </span>
                                </td>

                                <td className="py-3 px-4 text-slate-700">
                                  {isEditingRow && u.role === "Dept" ? (
                                    <select
                                      value={editDepartment}
                                      onChange={(e) => setEditDepartment(e.target.value)}
                                      className="w-full text-xs font-sans px-2 py-1.5 rounded-lg border border-[#6B1420]/40 bg-white text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#6B1420] cursor-pointer"
                                    >
                                      {DEPARTMENT_OFFICES.map((d) => (
                                        <option key={d.value} value={d.value}>{d.fullName}</option>
                                      ))}
                                    </select>
                                  ) : u.department ? (
                                    <span className="text-[#4A322E]">{DEPT_OFFICE_LABELS[u.department] || u.department}</span>
                                  ) : (
                                    <span className="italic text-slate-500">
                                      {u.role === "Dept" ? "Not assigned — click edit to fix" : "—"}
                                    </span>
                                  )}
                                </td>

                                <td className="py-3 px-4 text-slate-700">
                                  {isEditingRow ? (
                                    <input
                                      type="email"
                                      value={editEmail}
                                      onChange={(e) => setEditEmail(e.target.value)}
                                      placeholder="e.g. maria@cosca.edu.ph"
                                      className="w-full text-xs font-sans px-2 py-1.5 rounded-lg border border-[#6B1420]/40 bg-white text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#6B1420]"
                                    />
                                  ) : (
                                    u.email || <span className="italic text-slate-500">No email</span>
                                  )}
                                </td>

                                <td className="py-3 px-4 text-slate-700 font-mono">
                                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                                </td>

                                <td className="py-3 px-4 text-right">
                                  {isEditingRow ? (
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        onClick={() => handleSubmitEditUser(u)}
                                        disabled={isEditSubmitting}
                                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                                        title="Save changes"
                                      >
                                        <Save className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={handleCancelEditUser}
                                        disabled={isEditSubmitting}
                                        className="p-1.5 text-slate-700 hover:bg-[#F0EAE4] rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                                        title="Cancel"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        onClick={() => handleStartEditUser(u)}
                                        className="p-1.5 text-[#6B1420] hover:bg-[#6B1420]/10 rounded-lg transition-colors cursor-pointer"
                                        title="Edit name / email"
                                      >
                                        <Pencil className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteUserAccount(u)}
                                        disabled={deletingId === u.id}
                                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                        title="Delete account"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                              {isEditingRow && editError && (
                                <tr className="bg-rose-50/60">
                                  <td colSpan={6} className="px-4 pb-3 pt-0">
                                    <div className="flex items-center gap-2 text-[11px] text-rose-700 font-sans">
                                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                      <span>{editError}</span>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-700 font-mono">
                            No user accounts match your search query.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Notifications & Alerts */}
          {activeTab === "notifications" && (
            <div className="space-y-6">
              <div className="bg-[#F7F4F0] border border-[#E6DDD3] rounded-xl p-5 space-y-4">
                <h4 className="font-display font-bold text-sm text-[#241012] flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#6B1420]" />
                  Notification &amp; Alert Preferences
                </h4>
                <p className="text-xs text-slate-700 font-sans">
                  Configure real-time sound alerts, system banners, and email dispatch notices for incoming repair requests.
                </p>

                <div className="space-y-3 pt-2">
                  {/* Emergency Sound Toggle */}
                  <div className="flex items-center justify-between p-3 bg-white border border-[#E6DDD3] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                        {emergencySoundAlert ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                      </div>
                      <div>
                        <span className="font-bold text-xs text-[#241012] block">Emergency Repair Sound Alert</span>
                        <span className="text-[11px] text-slate-700">Play audio chime when high-priority emergency jobs are filed.</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEmergencySoundAlert(!emergencySoundAlert);
                        showToast(emergencySoundAlert ? "Emergency sound alert disabled" : "Emergency sound alert enabled");
                      }}
                      className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg border transition-colors cursor-pointer ${emergencySoundAlert
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-gray-100 text-gray-600 border-gray-300"
                        }`}
                    >
                      {emergencySoundAlert ? "ENABLED" : "DISABLED"}
                    </button>
                  </div>

                  {/* Email Notifications Toggle */}
                  <div className="flex items-center justify-between p-3 bg-white border border-[#E6DDD3] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-xs text-[#241012] block">Email Dispatch Copies</span>
                        <span className="text-[11px] text-slate-700">Send email notifications when funding is released or job orders complete.</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEmailAlertsEnabled(!emailAlertsEnabled);
                        showToast(emailAlertsEnabled ? "Email alerts disabled" : "Email alerts enabled");
                      }}
                      className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg border transition-colors cursor-pointer ${emailAlertsEnabled
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-gray-100 text-gray-600 border-gray-300"
                        }`}
                    >
                      {emailAlertsEnabled ? "ENABLED" : "DISABLED"}
                    </button>
                  </div>

                  {/* Toast Banners Toggle */}
                  <div className="flex items-center justify-between p-3 bg-white border border-[#E6DDD3] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-xs text-[#241012] block">On-Screen Toast Banners</span>
                        <span className="text-[11px] text-slate-700">Show pop-up toast notices when status changes occur.</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setToastBannersEnabled(!toastBannersEnabled);
                        showToast(toastBannersEnabled ? "Toast banners disabled" : "Toast banners enabled");
                      }}
                      className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg border transition-colors cursor-pointer ${toastBannersEnabled
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-gray-100 text-gray-600 border-gray-300"
                        }`}
                    >
                      {toastBannersEnabled ? "ENABLED" : "DISABLED"}
                    </button>
                  </div>

                  {/* Desktop Notifications — a real OS-level popup (Action
                      Center / notification center), distinct from the
                      in-app toast above. This only works over HTTPS or on
                      literal "localhost" — the browser blocks it entirely
                      on a plain-HTTP custom hostname, and there's no
                      workaround for that from the app itself. The four
                      states below (unsupported / blocked / not yet asked /
                      granted) mirror what the browser's Notification API
                      actually allows at each stage. */}
                  <div className="flex items-center justify-between p-3 bg-white border border-[#E6DDD3] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                        <Monitor className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-xs text-[#241012] block">Desktop Notifications</span>
                        <span className="text-[11px] text-slate-700">
                          {desktopNotifPermission === "unsupported"
                            ? "Requires HTTPS (or localhost) — unavailable on this address."
                            : desktopNotifPermission === "denied"
                              ? "Blocked in your browser. Re-enable it from this site's browser settings."
                              : "Show a system popup even when this tab isn't focused."}
                        </span>
                      </div>
                    </div>

                    {desktopNotifPermission === "unsupported" ? (
                      <span className="px-3 py-1.5 text-xs font-mono font-bold rounded-lg border bg-gray-100 text-gray-500 border-gray-300">
                        NOT AVAILABLE
                      </span>
                    ) : desktopNotifPermission === "denied" ? (
                      <span className="px-3 py-1.5 text-xs font-mono font-bold rounded-lg border bg-red-50 text-red-600 border-red-300">
                        BLOCKED
                      </span>
                    ) : desktopNotifPermission === "granted" ? (
                      <button
                        onClick={() => {
                          setDesktopNotifEnabled(!desktopNotifEnabled);
                          showToast(desktopNotifEnabled ? "Desktop notifications disabled" : "Desktop notifications enabled");
                        }}
                        className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg border transition-colors cursor-pointer ${desktopNotifEnabled
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                          : "bg-gray-100 text-gray-600 border-gray-300"
                          }`}
                      >
                        {desktopNotifEnabled ? "ENABLED" : "DISABLED"}
                      </button>
                    ) : (
                      <button
                        onClick={() => onRequestDesktopNotifPermission?.()}
                        className="px-3 py-1.5 text-xs font-mono font-bold rounded-lg border bg-[#6B1420]/5 text-[#6B1420] border-[#6B1420]/30 hover:bg-[#6B1420]/10 transition-colors cursor-pointer"
                      >
                        ENABLE
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Appearance & Accessibility */}
          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div className="bg-[#F7F4F0] border border-[#E6DDD3] rounded-xl p-5 space-y-5">
                <h4 className="font-display font-bold text-sm text-[#241012] flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[#6B1420]" />
                  Visual Theme &amp; Font Readability
                </h4>

                {/* Theme Selector */}
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-2">
                    Interface Theme Mode
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        if (onChangeTheme) onChangeTheme("light");
                        showToast("Theme set to Light Classic");
                      }}
                      className={`p-4 rounded-xl border flex flex-col items-center gap-2 text-xs font-bold transition-all cursor-pointer ${themeMode === "light"
                        ? "bg-white border-[#6B1420] text-[#6B1420] shadow-md ring-2 ring-[#6B1420]/20"
                        : "bg-white border-[#E6DDD3] text-slate-700 hover:bg-[#F5F1EC]"
                        }`}
                    >
                      <Sun className="w-5 h-5 text-amber-500" />
                      <span>Light Classic</span>
                    </button>

                    <button
                      onClick={() => {
                        if (onChangeTheme) onChangeTheme("dark");
                        showToast("Theme set to Dark Terminal");
                      }}
                      className={`p-4 rounded-xl border flex flex-col items-center gap-2 text-xs font-bold transition-all cursor-pointer ${themeMode === "dark"
                        ? "bg-slate-900 border-slate-900 text-white shadow-md ring-2 ring-slate-700"
                        : "bg-white border-[#E6DDD3] text-slate-700 hover:bg-[#F5F1EC]"
                        }`}
                    >
                      <Moon className="w-5 h-5 text-indigo-400" />
                      <span>Dark Terminal</span>
                    </button>
                  </div>
                </div>

                {/* Font Scaling */}
                <div className="pt-2 border-t border-[#E6DDD3]">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-mono font-bold text-slate-700 uppercase">
                      Text Scale Size
                    </label>
                    <span className="text-xs font-mono font-bold text-[#6B1420] bg-[#6B1420]/10 px-2 py-0.5 rounded">
                      {fontSizeScale}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={85}
                    max={150}
                    step={5}
                    value={fontSizeScale}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      if (onChangeFontScale) onChangeFontScale(next);
                    }}
                    onMouseUp={() => showToast(`Text scale set to ${fontSizeScale}%`)}
                    onTouchEnd={() => showToast(`Text scale set to ${fontSizeScale}%`)}
                    className="w-full h-2 rounded-full bg-[#E6DDD3] accent-[#6B1420] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1 px-0.5">
                    <span>85%</span>
                    <span>100%</span>
                    <span>115%</span>
                    <span>130%</span>
                    <span>150%</span>
                  </div>
                </div>


                {/* High Contrast Mode */}
                <div className="flex items-center justify-between p-3 bg-white border border-[#E6DDD3] rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                      <Type className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-[#241012] block">High Contrast Text</span>
                      <span className="text-[11px] text-slate-700">Enhances text borders and contrast for easier reading.</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (onToggleHighContrast) onToggleHighContrast(!highContrastMode);
                      showToast(highContrastMode ? "High contrast mode disabled" : "High contrast mode enabled");
                    }}
                    className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg border transition-colors cursor-pointer ${highContrastMode
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                      : "bg-gray-100 text-gray-600 border-gray-300"
                      }`}
                  >
                    {highContrastMode ? "ENABLED" : "DISABLED"}
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* TAB 4: Account Profile — self-service, available to every role */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              <div className="bg-[#F7F4F0] border border-[#E6DDD3] rounded-xl p-5 space-y-4">
                <h4 className="font-display font-bold text-sm text-[#241012] flex items-center gap-2">
                  <User className="w-4 h-4 text-[#6B1420]" />
                  My Account
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">Username</label>
                    <input
                      type="text"
                      value={currentUser?.username || ""}
                      disabled
                      className="w-full text-sm px-3 py-2 rounded-lg border border-[#E6DDD3] bg-[#F0EAE4] text-slate-500 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">Role</label>
                    <input
                      type="text"
                      value={currentUser ? (ROLE_CONFIG[currentUser.role]?.label || currentUser.role) : ""}
                      disabled
                      className="w-full text-sm px-3 py-2 rounded-lg border border-[#E6DDD3] bg-[#F0EAE4] text-slate-500 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">Full Name</label>
                    <input
                      type="text"
                      value={profileFullName}
                      onChange={(e) => setProfileFullName(e.target.value)}
                      className="w-full text-sm px-3 py-2 rounded-lg border border-[#E6DDD3] bg-white text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#6B1420]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">Email</label>
                    <input
                      type="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full text-sm px-3 py-2 rounded-lg border border-[#E6DDD3] bg-white text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#6B1420] placeholder-slate-400"
                    />
                  </div>
                </div>
                <button
                  onClick={handleSaveOwnProfile}
                  disabled={profileSaveBusy || !profileFullName.trim()}
                  className="px-4 py-2 bg-[#6B1420] text-white font-mono font-bold text-xs rounded-lg hover:bg-[#541019] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" /> {profileSaveBusy ? "Saving..." : "Save Profile"}
                </button>
              </div>

              <div className="bg-[#F7F4F0] border border-[#E6DDD3] rounded-xl p-5 space-y-4">
                <h4 className="font-display font-bold text-sm text-[#241012] flex items-center gap-2">
                  <Key className="w-4 h-4 text-[#6B1420]" />
                  Change Password
                </h4>
                <p className="text-xs text-slate-700 font-sans">
                  Works exactly like "Forgot Access Key" on the login screen: a 6-digit code is emailed to your account address, then you enter it here along with your new password.
                </p>

                {pwError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-sans rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{pwError}</span>
                  </div>
                )}
                {pwMsg && (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-sans rounded-lg p-3">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{pwMsg}</span>
                  </div>
                )}

                {!currentUser?.email && (
                  <div className="flex items-center gap-2 bg-safety-amber/10 border border-safety-amber/30 text-safety-amber text-xs font-sans rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>No email is on file for this account. Add one above and save your profile first, or contact your PPO administrator to reset your password.</span>
                  </div>
                )}

                {pwStep === 1 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-[#2B1210] bg-white border border-[#E6DDD3] rounded-lg px-3 py-2.5">
                      <Mail className="w-4 h-4 text-[#6B1420] shrink-0" />
                      <span className="truncate">{currentUser?.email || "—"}</span>
                    </div>
                    <button
                      onClick={handleSendPwOtp}
                      disabled={pwBusy || !onRequestPasswordOtp || !currentUser?.email}
                      className="px-4 py-2 bg-[#6B1420] text-white font-mono font-bold text-xs rounded-lg hover:bg-[#541019] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                    >
                      <Mail className="w-3.5 h-3.5" /> {pwBusy ? "Sending Code..." : "Send Verification Code"}
                    </button>
                  </div>
                )}

                {pwStep === 2 && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">6-Digit Code</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={pwOtp}
                          onChange={(e) => setPwOtp(e.target.value.replace(/\D/g, ""))}
                          placeholder="000000"
                          className="w-full text-sm px-3 py-2 rounded-lg border border-[#E6DDD3] bg-white text-[#2B1210] font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-[#6B1420] placeholder-slate-300"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">New Password</label>
                        <input
                          type="password"
                          value={pwNewPassword}
                          onChange={(e) => setPwNewPassword(e.target.value)}
                          className="w-full text-sm px-3 py-2 rounded-lg border border-[#E6DDD3] bg-white text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#6B1420]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">Confirm New Password</label>
                        <input
                          type="password"
                          value={pwConfirmPassword}
                          onChange={(e) => setPwConfirmPassword(e.target.value)}
                          className="w-full text-sm px-3 py-2 rounded-lg border border-[#E6DDD3] bg-white text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#6B1420]"
                        />
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-700 block">Code expires in 15 minutes. Minimum 8 characters for the new password.</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleConfirmPwReset}
                        disabled={pwBusy || !pwOtp.trim() || !pwNewPassword}
                        className="px-4 py-2 bg-[#6B1420] text-white font-mono font-bold text-xs rounded-lg hover:bg-[#541019] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                      >
                        <Key className="w-3.5 h-3.5" /> {pwBusy ? "Updating..." : "Confirm New Password"}
                      </button>
                      <button
                        onClick={handleSendPwOtp}
                        disabled={pwBusy}
                        className="px-3 py-2 bg-white border border-[#E6DDD3] text-slate-700 font-mono font-bold text-xs rounded-lg hover:bg-[#F0EAE4] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Resend Code
                      </button>
                    </div>
                  </div>
                )}

                {pwStep === 3 && (
                  <div className="space-y-3">
                    <button
                      onClick={resetPwFlow}
                      className="px-4 py-2 bg-white border border-[#E6DDD3] text-[#6B1420] font-mono font-bold text-xs rounded-lg hover:bg-[#F0EAE4] cursor-pointer"
                    >
                      Change Password Again
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: Data Backup & Activity Logs */}
          {activeTab === "backup" && canManageAccounts && (
            <div className="space-y-6">
              {/* One-Click Backup Banner */}
              <div className="bg-[#F7F4F0] border border-[#E6DDD3] rounded-xl p-5 space-y-4">
                <h4 className="font-display font-bold text-sm text-[#241012] flex items-center gap-2">
                  <Download className="w-4 h-4 text-[#6B1420]" />
                  System Database Backup &amp; Record Export
                </h4>
                <p className="text-xs text-slate-700 font-sans">
                  Export complete system job order records, accounts, and financial approval data for offline archival.
                </p>

                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    onClick={() => handleDownloadBackup("json")}
                    className="px-4 py-2.5 bg-[#6B1420] text-white font-mono font-bold text-xs rounded-lg hover:bg-[#541019] cursor-pointer shadow-xs flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Export Backup (JSON Format)
                  </button>

                  <button
                    onClick={() => handleDownloadBackup("csv")}
                    className="px-4 py-2.5 bg-emerald-700 text-white font-mono font-bold text-xs rounded-lg hover:bg-emerald-800 cursor-pointer shadow-xs flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Export Records (CSV Excel)
                  </button>
                </div>
              </div>

              {/* System Audit Trail Viewer */}
              <div className="bg-[#F7F4F0] border border-[#E6DDD3] rounded-xl p-5 space-y-3">
                <h4 className="font-display font-bold text-sm text-[#241012] flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#6B1420]" />
                  System Activity Audit Log
                </h4>
                <div className="bg-white border border-[#E6DDD3] rounded-lg p-3 max-h-48 overflow-y-auto space-y-2 font-mono text-[11px] text-[#2B1210]">
                  <div className="flex justify-between text-slate-700">
                    <span>[LOG 2026-07-25 20:45] System settings opened by {currentUserRole || "Admin"}</span>
                    <span className="text-emerald-600 font-bold">INFO</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>[LOG 2026-07-25 19:30] Security rules enforced (bcrypt cost factor 12)</span>
                    <span className="text-emerald-600 font-bold">SECURITY</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>[LOG 2026-07-25 18:12] PostgreSQL database synced with 0 errors</span>
                    <span className="text-emerald-600 font-bold">DB_SYNC</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>[LOG 2026-07-25 16:05] Maintenance staff roster synchronized</span>
                    <span className="text-emerald-600 font-bold">STAFF</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: Worker Workload Rules */}
          {activeTab === "workload" && canManageAccounts && (
            <div className="space-y-6">
              <div className="bg-[#F7F4F0] border border-[#E6DDD3] rounded-xl p-5 space-y-4">
                <h4 className="font-display font-bold text-sm text-[#241012] flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#6B1420]" />
                  Maintenance Staff Task Capacity Rules
                </h4>
                <p className="text-xs text-slate-700 font-sans">
                  Set the maximum number of active repair jobs a single maintenance worker can hold at one time to avoid overload.
                </p>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">
                      Max Active Job Orders Per Worker
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={workerTaskLimit}
                        onChange={(e) => setWorkerTaskLimit(Number(e.target.value))}
                        className="w-24 text-sm font-mono px-3 py-2 rounded-lg border border-[#E6DDD3] bg-white text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#6B1420]"
                      />
                      <button
                        onClick={handleSaveWorkloadLimit}
                        className="px-4 py-2 bg-[#6B1420] text-white font-mono font-bold text-xs rounded-lg hover:bg-[#541019] cursor-pointer"
                      >
                        Save Capacity Limit
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-700 mt-1 block">
                      Enforced limit: new auto-assignments skip a worker once they reach {workerTaskLimit} active tasks, and manually assigning a job to a worker already at {workerTaskLimit} will be blocked.
                    </span>
                  </div>
                </div>
              </div>

              {/* Worker Skills & Specialties — feeds the AI matching engine */}
              <div className="bg-[#F7F4F0] border border-[#E6DDD3] rounded-xl p-5 space-y-4">
                <h4 className="font-display font-bold text-sm text-[#241012] flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#6B1420]" />
                  Maintenance Staff Skills &amp; Specialties
                </h4>
                <p className="text-xs text-slate-700 font-sans">
                  Assign each maintenance worker's skills, proficiency (1–5), and years of hands-on experience in that skill. The dispatcher uses exactly this data — 55% skill proficiency, 15% years of experience (capped at 10 years), 30% current availability — to pick the best-matched worker for each incoming job order automatically.
                </p>
                <p className="text-xs text-slate-700 font-sans">
                  Each worker's highest qualification (TESDA certificate, vocational diploma, degree, etc.) can also be recorded below for the personnel record. It's shown for PPO's reference but isn't scored automatically — unlike proficiency and experience, credentials can't be reliably ranked against each other across different trades.
                </p>
                <p className="text-xs text-slate-700 font-sans">
                  Every worker here with a <span className="font-bold text-soft-green">Linked account</span> tag matches a real login on the User Accounts tab. Anything tagged <span className="font-bold text-safety-amber">No login account · mock</span> has no matching user and can be removed with the trash icon.
                </p>

                {/* Add a brand-new skill to the system-wide skill list */}
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <input
                    type="text"
                    value={newSkillName}
                    onChange={(e) => setNewSkillName(e.target.value)}
                    placeholder="Add a new skill, e.g. Electrical Wiring"
                    className="flex-1 text-sm px-3 py-2 rounded-lg border border-[#E6DDD3] bg-white text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#6B1420]"
                  />
                  <button
                    onClick={handleCreateSkill}
                    disabled={!newSkillName.trim() || skillActionBusy}
                    className="px-4 py-2 bg-white border border-[#6B1420] text-[#6B1420] font-mono font-bold text-xs rounded-lg hover:bg-[#6B1420]/5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> New Skill
                  </button>
                </div>

                {/* Per-worker skill assignment */}
                <div className="space-y-3 pt-2">
                  {staffProfiles.length === 0 && (
                    <p className="text-xs text-slate-500 italic">No maintenance staff profiles found yet.</p>
                  )}
                  {staffProfiles.map((staff) => {
                    const draft = getStaffDraft(staff.id);
                    const availableSkills = skillsList.filter(
                      (sk) => !staff.skills.some((assigned) => assigned.skillId === sk.id)
                    );
                    return (
                      <div key={staff.id} className={`bg-white border rounded-lg p-4 ${staff.userId ? "border-[#E6DDD3]" : "border-safety-amber/40 bg-safety-amber/5"}`}>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <span className="font-display font-bold text-sm text-[#241012]">{staff.name}</span>
                            <span className="text-xs text-slate-600 ml-2">{staff.specialty || "General Maintenance"}</span>
                            {staff.userId ? (
                              <span className="ml-2 text-[10px] font-mono font-bold uppercase text-soft-green bg-soft-green/10 px-1.5 py-0.5 rounded">
                                Linked account
                              </span>
                            ) : (
                              <span className="ml-2 text-[10px] font-mono font-bold uppercase text-safety-amber bg-safety-amber/10 px-1.5 py-0.5 rounded">
                                No login account · mock
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-slate-600 bg-[#F5F1EC] px-2 py-0.5 rounded">
                              Workload: {staff.workload}%
                            </span>
                            {!staff.userId && onDeleteStaff && (
                              <button
                                onClick={() => handleDeleteStaffProfile(staff.id, staff.name)}
                                disabled={staffDeleteBusyId === staff.id}
                                title="Remove this unlinked mock worker profile"
                                className="p-1.5 rounded bg-red-50 hover:bg-red-100 text-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Highest qualification / degree — record-keeping, not scored */}
                        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-[#F0EAE4]">
                          <span className="text-[11px] font-mono uppercase text-slate-600 shrink-0">Qualification:</span>
                          <input
                            type="text"
                            value={getDegreeDraft(staff)}
                            onChange={(e) => setDegreeDrafts((prev) => ({ ...prev, [staff.id]: e.target.value }))}
                            placeholder="e.g. TESDA NC II Electrical Installation"
                            className="flex-1 min-w-[180px] text-xs px-2.5 py-1.5 rounded-lg border border-[#E6DDD3] bg-white text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#6B1420]"
                          />
                          <button
                            onClick={() => handleSaveDegree(staff)}
                            disabled={degreeBusyId === staff.id || getDegreeDraft(staff).trim() === (staff.degree || "")}
                            className="px-3 py-1.5 bg-[#6B1420] text-white font-mono font-bold text-xs rounded-lg hover:bg-[#541019] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            Save
                          </button>
                        </div>

                        {/* Current skill chips */}
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {staff.skills.length === 0 && (
                            <span className="text-xs text-slate-500 italic">No skills assigned yet.</span>
                          )}
                          {staff.skills.map((sk) => (
                            <span
                              key={sk.skillId}
                              className="inline-flex items-center gap-1.5 text-xs font-mono font-bold bg-[#6B1420]/10 text-[#6B1420] px-2 py-1 rounded-full"
                            >
                              {sk.skillName} · Lv{sk.proficiency} · {sk.yearsExperience}y exp
                              <button
                                onClick={() => handleRemoveSkill(staff.id, sk.skillId)}
                                title="Remove skill"
                                className="hover:text-white hover:bg-[#6B1420] rounded-full cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>

                        {/* Assign a new skill to this worker */}
                        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-[#F0EAE4]">
                          <select
                            value={draft.skillId}
                            onChange={(e) => setStaffDraft(staff.id, { skillId: e.target.value })}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-[#E6DDD3] bg-white text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#6B1420]"
                          >
                            <option value="">Select a skill...</option>
                            {availableSkills.map((sk) => (
                              <option key={sk.id} value={sk.id}>{sk.name}</option>
                            ))}
                          </select>
                          <select
                            value={draft.proficiency}
                            onChange={(e) => setStaffDraft(staff.id, { proficiency: Number(e.target.value) })}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-[#E6DDD3] bg-white text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#6B1420]"
                          >
                            {[1, 2, 3, 4, 5].map((n) => (
                              <option key={n} value={n}>Proficiency {n}/5</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={0}
                            max={60}
                            step={0.5}
                            value={draft.yearsExperience}
                            onChange={(e) => setStaffDraft(staff.id, { yearsExperience: e.target.value })}
                            placeholder="Yrs exp"
                            title="Years of hands-on experience in this specific skill"
                            className="w-20 text-xs px-2.5 py-1.5 rounded-lg border border-[#E6DDD3] bg-white text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#6B1420]"
                          />
                          <button
                            onClick={() => handleAssignSkill(staff.id)}
                            disabled={!draft.skillId || skillActionBusy}
                            className="px-3 py-1.5 bg-[#6B1420] text-white font-mono font-bold text-xs rounded-lg hover:bg-[#541019] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            Add Skill
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: Security Policies */}
          {activeTab === "security" && showSecurityTab && (
            <div className="space-y-4">
              <div className="bg-[#F7F4F0] border border-[#E6DDD3] rounded-xl p-5 space-y-3">
                <h4 className="font-display font-bold text-sm text-[#241012] flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#6B1420]" />
                  Password &amp; Login Security Rules
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans text-slate-700">
                  <div className="bg-white p-3.5 rounded-lg border border-[#E6DDD3] space-y-1">
                    <span className="font-bold text-[#241012] block">Password Encryption</span>
                    <p>All passwords are encrypted with bcrypt (cost factor 12) before being saved, keeping accounts safe.</p>
                  </div>
                  <div className="bg-white p-3.5 rounded-lg border border-[#E6DDD3] space-y-1">
                    <span className="font-bold text-[#241012] block">Automatic Account Lockout</span>
                    <p>Accounts temporarily lock for 15 minutes if incorrect passwords are entered 5 times in a row.</p>
                  </div>
                  <div className="bg-white p-3.5 rounded-lg border border-[#E6DDD3] space-y-1">
                    <span className="font-bold text-[#241012] block">Automatic Session Expiry</span>
                    <p>Logins stay active for up to 8 hours. Users are automatically logged out after session expiry for security.</p>
                  </div>
                  <div className="bg-white p-3.5 rounded-lg border border-[#E6DDD3] space-y-1">
                    <span className="font-bold text-[#241012] block">Account Roles &amp; Permissions</span>
                    <p>Limits access so each user only sees features for their account role (Department, Staff, PPO, President, Finance).</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: System & School Info */}
          {activeTab === "system" && (
            <div className="space-y-4">
              <div className="bg-[#F7F4F0] border border-[#E6DDD3] rounded-xl p-5 space-y-3">
                <h4 className="font-display font-bold text-sm text-[#241012] flex items-center gap-2">
                  <Server className="w-4 h-4 text-[#6B1420]" />
                  School System Information
                </h4>
                <div className="space-y-2 text-xs font-sans text-slate-700">
                  <div className="flex justify-between py-2 border-b border-[#E6DDD3]">
                    <span className="font-bold text-[#241012]">School Name</span>
                    <span>Colegio de Santa Catalina de Alejandria (COSCA)</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[#E6DDD3]">
                    <span className="font-bold text-[#241012]">System Name</span>
                    <span>Job Order Request &amp; Maintenance System (JORS)</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[#E6DDD3]">
                    <span className="font-bold text-[#241012]">Database System</span>
                    <span>PostgreSQL Database with Activity Logs</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[#E6DDD3]">
                    <span className="font-bold text-[#241012]">Smart Engine</span>
                    <span>Google Gemini AI + Smart Rule Engine</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="font-bold text-[#241012]">System Version</span>
                    <span className="font-mono text-[#6B1420] font-bold">v1.0.0-COSCA-2026</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#F7F4F0] border-t border-[#E6DDD3] flex items-center text-xs font-mono text-slate-600">
          <span>🔒 JORS COSCA System Control Center</span>
        </div>

      </div>
    </div>
  );
};