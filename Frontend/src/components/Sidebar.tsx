import React from "react";
import { Role } from "../types";
import { Activity, ShieldCheck, ClipboardList, PenTool, Wrench, RefreshCw, FileSpreadsheet, Sparkles, GraduationCap, Settings as SettingsIcon, Menu } from "lucide-react";

interface SidebarProps {
  currentRole: Role;
  onChangeRole: (role: Role) => void;
  isOpen?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  authType?: "Dept" | "Staff" | "Admin" | null;
  adminSubRole?: string;
  onOpenSettings?: () => void;
  /** Whether the backend actually has Gemini configured right now. */
  aiEnabled?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRole,
  onChangeRole,
  isOpen = false,
  isCollapsed = false,
  onToggleCollapse,
  authType,
  adminSubRole,
  onOpenSettings,
  aiEnabled = false,
}) => {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 bg-white text-[#2B1210] flex flex-col h-screen border-r border-[#E6DDD3] shrink-0 justify-between select-none lg:relative lg:translate-x-0 transition-all duration-300 ease-in-out ${isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
        } ${isCollapsed ? "lg:w-20" : "lg:w-64 w-64"}`}
    >
      <div>
        {/* Top: School Logo Mark + Wordmark "JORS COSCA" */}
        <div className={`h-20 px-4 border-b border-[#E6DDD3] flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-md border border-[#E6DDD3] bg-white" title="JORS COSCA">
              <img src="/cosca-seal.png" alt="COSCA Seal" className="w-full h-full object-contain p-0.5" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <h1 className="font-display font-bold text-[15px] tracking-tight text-[#241012] leading-none truncate">
                  JORS COSCA
                </h1>
                <span className="text-[11px] font-mono tracking-[0.15em] text-[#6B1420]/70 block mt-0.5 font-bold uppercase">
                  Facilities Portal
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Role Switching Navigation */}
        <div className="p-3 space-y-4">
          {!isCollapsed && (
            <p className="text-[11px] font-mono uppercase text-slate-600 px-3 tracking-widest font-bold">
              YOUR NAVIGATION PANELS
            </p>
          )}

          <div className="space-y-1.5">
            {(!authType || authType === "Admin") && (
              <button
                onClick={() => onChangeRole("Admin")}
                title="Admin & Approvers Desk"
                className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all cursor-pointer ${isCollapsed ? "justify-center" : ""
                  } ${currentRole === "Admin"
                    ? "bg-[#F0EAE4] text-[#6B1420] font-medium border border-[#E6DDD3]"
                    : "text-slate-700 hover:bg-[#F5F1EC] hover:text-[#241012]"
                  }`}
              >
                <ShieldAlert className="w-5 h-5 shrink-0 text-[#6B1420]" />
                {!isCollapsed && (
                  <div className="flex flex-col min-w-0">
                    <span className="font-display font-medium text-sm leading-none">Admin &amp; Approvers</span>
                    <span className="text-xs font-sans text-slate-600 mt-1">Main Management Desk</span>
                  </div>
                )}
              </button>
            )}

            {(!authType || authType === "Dept") && (
              <button
                onClick={() => onChangeRole("Dept")}
                title="Department Requests"
                className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all cursor-pointer ${isCollapsed ? "justify-center" : ""
                  } ${currentRole === "Dept"
                    ? "bg-[#F0EAE4] text-[#6B1420] font-medium border border-[#E6DDD3]"
                    : "text-slate-700 hover:bg-[#F5F1EC] hover:text-[#241012]"
                  }`}
              >
                <ClipboardList className="w-5 h-5 shrink-0 text-[#6B1420]" />
                {!isCollapsed && (
                  <div className="flex flex-col min-w-0">
                    <span className="font-display font-medium text-sm leading-none">Department Staff</span>
                    <span className="text-xs font-sans text-slate-600 mt-1">Report Items &amp; Track Repairs</span>
                  </div>
                )}
              </button>
            )}

            {(!authType || authType === "Staff") && (
              <button
                onClick={() => onChangeRole("Staff")}
                title="Maintenance Workers"
                className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all cursor-pointer ${isCollapsed ? "justify-center" : ""
                  } ${currentRole === "Staff"
                    ? "bg-[#F0EAE4] text-[#6B1420] font-medium border border-[#E6DDD3]"
                    : "text-slate-700 hover:bg-[#F5F1EC] hover:text-[#241012]"
                  }`}
              >
                <Wrench className="w-5 h-5 shrink-0 text-[#6B1420]" />
                {!isCollapsed && (
                  <div className="flex flex-col min-w-0">
                    <span className="font-display font-medium text-sm leading-none">Maintenance Workers</span>
                    <span className="text-xs font-sans text-slate-600 mt-1">View Assigned Repair Jobs</span>
                  </div>
                )}
              </button>
            )}

            {/* AI Reports is available ONLY for Admin PPO access */}
            {(!authType || (authType === "Admin" && adminSubRole === "PPO")) && (
              <button
                onClick={() => onChangeRole("Report")}
                title="Smart Reports & Analytics"
                className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all cursor-pointer ${isCollapsed ? "justify-center" : ""
                  } ${currentRole === "Report"
                    ? "bg-[#F0EAE4] text-[#6B1420] font-medium border border-[#E6DDD3]"
                    : "text-slate-700 hover:bg-[#F5F1EC] hover:text-[#241012]"
                  }`}
              >
                <FileSpreadsheet className="w-5 h-5 shrink-0 text-[#6B1420]" />
                {!isCollapsed && (
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-display font-medium text-sm leading-none">Smart Reports</span>
                      <span className="flex items-center gap-0.5 px-1 py-0.25 bg-[#6B1420]/10 text-[#6B1420] rounded-sm text-xs font-mono font-bold uppercase tracking-wider animate-pulse">
                        <Sparkles className="w-2 h-2" /> {aiEnabled ? "AI" : "RULES"}
                      </span>
                    </div>
                    <span className="text-xs font-sans text-slate-600 mt-1">Summaries &amp; Downloads</span>
                  </div>
                )}
              </button>
            )}

            {/* SETTINGS MENU ITEM */}
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                title="System Settings & User Accounts"
                className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all cursor-pointer border border-transparent text-slate-700 hover:bg-[#F5F1EC] hover:text-[#6B1420] ${isCollapsed ? "justify-center" : ""
                  }`}
              >
                <SettingsIcon className="w-5 h-5 shrink-0 text-[#6B1420]" />
                {!isCollapsed && (
                  <div className="flex flex-col min-w-0">
                    <span className="font-display font-medium text-sm leading-none text-[#241012]">Settings</span>
                    <span className="text-xs font-sans text-slate-600 mt-1">User Accounts &amp; Help</span>
                  </div>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Institution Name Footer */}
      <footer className={`p-4 border-t border-[#E6DDD3] bg-[#F5F1EC] ${isCollapsed ? "text-center" : ""}`}>
        {!isCollapsed ? (
          <>
            <div className="flex items-center gap-2">
              <img src="/cosca-seal.png" alt="COSCA" className="w-7 h-7 object-contain shrink-0 opacity-80" />
              <div className="min-w-0">
                <p className="font-display text-[11px] font-bold text-[#4A322E] leading-tight">Colegio de Santa Catalina</p>
                <p className="font-display text-[11px] font-bold text-[#4A322E] leading-tight mt-0.5">de Alejandria (COSCA)</p>
              </div>
            </div>
          </>
        ) : (
          <div className="flex justify-center">
            <img src="/cosca-seal.png" alt="COSCA" className="w-8 h-8 object-contain opacity-80" />
          </div>
        )}
      </footer>
    </aside>
  );
};

// Internal icon helpers for cleaner styling
const ShieldAlert: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </svg>
);