import React, { useState } from "react";
import { User, Shield, UserPlus, Search, Key, Trash2, CheckCircle2, AlertCircle, Eye, EyeOff, X, Sparkles, Mail, Lock } from "lucide-react";

export interface UserAccount {
  id: number;
  username: string;
  fullName: string;
  role: string;
  email: string | null;
  department?: string | null;
  createdAt?: string;
}

interface AccountManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserAccount[];
  onCreateUser: (userData: {
    username: string;
    password: string;
    role: string;
    fullName: string;
    email?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onDeleteUser: (id: number) => Promise<{ ok: boolean; error?: string }>;
}

const ROLE_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  Dept: { label: "Department Head", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  Staff: { label: "Maintenance Staff", bg: "bg-[#FBF2F2]", text: "text-[#6B1420]", border: "border-[#E8C4C9]" },
  PPO: { label: "PPO Officer (Admin)", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  President: { label: "School Head / President", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  Finance: { label: "Finance Dept Head", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
};

export const AccountManagementModal: React.FC<AccountManagementModalProps> = ({
  isOpen,
  onClose,
  users,
  onCreateUser,
  onDeleteUser,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [formFullName, setFormFullName] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("Dept");
  const [formPassword, setFormPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  if (!isOpen) return null;

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.username.toLowerCase().includes(q) ||
      u.fullName.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
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

  const handleSubmit = async (e: React.FormEvent) => {
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

    setIsSubmitting(true);
    const res = await onCreateUser({
      fullName: formFullName.trim(),
      username: formUsername.trim().toLowerCase(),
      email: formEmail.trim() || undefined,
      role: formRole,
      password: formPassword,
    });
    setIsSubmitting(false);

    if (res.ok) {
      setFormSuccess(`Account "${formUsername.toLowerCase()}" successfully created!`);
      // Reset form
      setFormFullName("");
      setFormUsername("");
      setFormEmail("");
      setFormPassword("");
      setTimeout(() => {
        setFormSuccess(null);
        setIsCreating(false);
      }, 2000);
    } else {
      setFormError(res.error || "Failed to create user account.");
    }
  };

  const handleDelete = async (user: UserAccount) => {
    if (!confirm(`Are you sure you want to delete account "${user.username}" (${user.fullName})?`)) {
      return;
    }
    setDeletingId(user.id);
    const res = await onDeleteUser(user.id);
    setDeletingId(null);
    if (!res.ok) {
      alert(res.error || "Could not delete user account.");
    }
  };

  return (
    <div className="fixed inset-0 bg-[#241012]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#DDD2C8] rounded-2xl max-w-4xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 shadow-2xl flex flex-col max-h-[90vh]">

        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-[#E6DDD3] bg-[#F7F4F0] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#6B1420] text-white rounded-xl flex items-center justify-center shadow-md">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-lg text-[#241012]">
                  User Account Management
                </h3>
                <span className="text-xs font-mono bg-[#6B1420]/10 text-[#6B1420] px-2 py-0.5 rounded-full font-bold">
                  {users.length} Account{users.length !== 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-xs text-slate-700 font-sans">
                Provision accounts, assign security roles, and manage access credentials.
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

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* Top Bar: Search & Action Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-600 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search username, name, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs font-sans pl-9 pr-3 py-2.5 rounded-xl border border-[#E6DDD3] bg-[#F5F1EC] text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#6B1420] transition-all"
              />
            </div>

            <button
              onClick={() => {
                setIsCreating(!isCreating);
                setFormError(null);
                setFormSuccess(null);
              }}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#6B1420] hover:bg-[#541019] text-white text-xs font-sans font-medium shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <X className="w-4 h-4" />
                  <span>Close Creation Form</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Provision New User Account</span>
                </>
              )}
            </button>
          </div>

          {/* Account Creation Form Panel (Collapsible) */}
          {isCreating && (
            <div className="bg-[#F7F4F0] border border-[#E8C4C9] rounded-xl p-5 shadow-sm space-y-4 animate-in slide-in-from-top-4 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-[#E6DDD3]">
                <h4 className="font-display font-bold text-sm text-[#241012] flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#6B1420]" />
                  Provision New Account Credentials
                </h4>
                <span className="text-[11px] font-mono text-slate-700">Role &amp; Security Scoped</span>
              </div>

              {formError && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-sans rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-sans rounded-lg p-3">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">
                    Full Name / Office Title *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Juan Dela Cruz or Academic Affairs"
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    className="w-full text-xs font-sans px-3 py-2 rounded-lg border border-[#E6DDD3] bg-white text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#6B1420]"
                    required
                  />
                </div>

                {/* Username */}
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">
                    System Username *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. j.delacruz or academic.affairs"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    className="w-full text-xs font-sans px-3 py-2 rounded-lg border border-[#E6DDD3] bg-white text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#6B1420]"
                    required
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">
                    System Role *
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full text-xs font-sans px-3 py-2 rounded-lg border border-[#E6DDD3] bg-white text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#6B1420] cursor-pointer"
                  >
                    <option value="Dept">Department Head (Submits Job Orders)</option>
                    <option value="Staff">Maintenance Staff / Technician (Executes Job Orders)</option>
                    <option value="PPO">PPO Officer (Physical Plant Admin &amp; Approver)</option>
                    <option value="President">School Directress / President (Administrative Endorsement)</option>
                    <option value="Finance">Finance Department Head (Budget Approval &amp; Release)</option>
                  </select>
                </div>

                {/* Email (Optional) */}
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">
                    Registered Gmail / Email (Optional)
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="e.g. user@cosca.edu.ph"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full text-xs font-sans pl-8 pr-3 py-2 rounded-lg border border-[#E6DDD3] bg-white text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#6B1420]"
                    />
                    <Mail className="w-3.5 h-3.5 text-slate-600 absolute left-2.5 top-2.5" />
                  </div>
                </div>

                {/* Password Input & Generator */}
                <div className="sm:col-span-2">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-mono font-bold text-slate-700 uppercase">
                      Account Password *
                    </label>
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="text-[11px] font-mono text-[#6B1420] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      Auto-generate Secure Password
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 8 characters..."
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      className="w-full text-xs font-sans pl-8 pr-10 py-2.5 rounded-lg border border-[#E6DDD3] bg-white text-[#2B1210] focus:outline-none focus:ring-1 focus:ring-[#6B1420]"
                      required
                    />
                    <Lock className="w-3.5 h-3.5 text-slate-600 absolute left-2.5 top-3" />

                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-600 hover:text-[#2B1210] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {formPassword && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full ${strength.color} transition-all duration-300`} style={{ width: `${(strength.score / 3) * 100}%` }} />
                      </div>
                      <span className="text-[11px] font-mono text-slate-700">{strength.label}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-4 py-2 bg-transparent text-slate-700 border border-[#DDD2C8] rounded-lg text-xs font-mono font-bold hover:text-[#241012] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-[#6B1420] hover:bg-[#541019] text-white text-xs font-mono font-bold rounded-lg shadow-sm transition-all disabled:opacity-60 cursor-pointer flex items-center gap-1.5"
                  >
                    {isSubmitting ? "Creating..." : "Confirm & Save Account"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* User Roster Table */}
          <div className="border border-[#E6DDD3] rounded-xl overflow-hidden shadow-xs bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[#F7F4F0] border-b border-[#E6DDD3] text-slate-700 font-mono uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4">User Account</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Email Address</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EAE4]">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => {
                      const roleConfig = ROLE_CONFIG[u.role] || {
                        label: u.role,
                        bg: "bg-gray-100",
                        text: "text-gray-700",
                        border: "border-gray-200",
                      };

                      return (
                        <tr key={u.id} className="hover:bg-[#F9F7F5] transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-[#6B1420]/10 text-[#6B1420] font-mono font-bold flex items-center justify-center text-xs">
                                {u.fullName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-semibold block text-[#241012]">{u.fullName}</span>
                                <span className="text-[11px] font-mono text-slate-700">@{u.username}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-mono font-semibold border ${roleConfig.bg} ${roleConfig.text} ${roleConfig.border}`}>
                              {roleConfig.label}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-slate-700 font-mono">
                            {u.email ? u.email : <span className="text-slate-500 font-sans italic">Not linked</span>}
                          </td>

                          <td className="py-3 px-4 text-slate-700 font-mono">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleDelete(u)}
                              disabled={deletingId === u.id}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete account"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-700 font-mono">
                        No user accounts match your search query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#F7F4F0] border-t border-[#E6DDD3] flex items-center text-xs font-mono text-slate-600">
          <span>🔒 All accounts hashed with bcrypt (Cost Factor 12)</span>
        </div>

      </div>
    </div>
  );
};