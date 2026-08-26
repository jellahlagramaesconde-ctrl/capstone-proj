import React from "react";
import { AlertOctagon, X } from "lucide-react";

interface LogoutModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const LogoutModal: React.FC<LogoutModalProps> = ({
  isOpen,
  onCancel,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#1A0E10]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
      <div className="bg-[#2A1518] border border-soft-red/30 rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">

        {/* Header */}
        <div className="p-5 border-b border-navy-medium flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-soft-red/10 text-soft-red">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <h3 className="font-display font-semibold text-lg text-white">
              Are you sure to logout?
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-navy-medium/55 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          <p className="text-sm text-gray-300 leading-relaxed font-sans">
            You will be signed out of JORS Facilities Control and will need to authenticate again to manage work orders.
          </p>
        </div>

        {/* Footer actions */}
        <div className="p-5 border-t border-navy-medium/60 bg-navy-dark/30 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-mono font-bold tracking-wide rounded bg-navy-medium text-gray-300 hover:text-white hover:bg-navy-medium/80 transition-colors border border-navy-medium"
          >
            CANCEL
          </button>

          <button
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-mono font-bold tracking-wide rounded bg-soft-red hover:bg-soft-red/80 text-white transition-colors border border-soft-red"
          >
            LOG OUT
          </button>
        </div>
      </div>
    </div>
  );
};