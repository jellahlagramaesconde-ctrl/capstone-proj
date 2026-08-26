import React, { useState, useRef } from "react";
import { ClipboardCheck, Sparkles, Send, User, X, Plus, Building2, Upload, Image as ImageIcon } from "lucide-react";

interface NewJobOrderButtonProps {
  onSubmitRequest: (office: string, description: string, requestedByName: string, isEmergency: boolean, photoUrl?: string) => Promise<void>;
  isSubmitting: boolean;
  /** If provided, the office field renders as a dropdown of these labels instead of free text. */
  officeOptions?: string[];
  defaultRequestedBy?: string;
  buttonLabel?: string;
  /** Extra classes for the trigger button, e.g. to fit a specific header layout. */
  className?: string;
  /** Whether the backend actually has Gemini configured right now. Defaults
   * to false (the honest, unproven state) so this never claims "AI Active"
   * before App.tsx has confirmed it via /api/system/ai-status. */
  aiEnabled?: boolean;
}

// Reusable "raise a job order on behalf of an office" control, used by the PPO,
// Finance, and School Head/President desks — mirrors the Dept Dashboard's own
// "NEW JOB ORDER" flow, but lets the requester pick which office it's for since
// admin-side accounts aren't tied to a single department.
export const NewJobOrderButton: React.FC<NewJobOrderButtonProps> = ({
  onSubmitRequest,
  isSubmitting,
  officeOptions,
  defaultRequestedBy = "",
  buttonLabel = "NEW REQUEST",
  className = "",
  aiEnabled = false,
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [office, setOffice] = useState("");
  const [description, setDescription] = useState("");
  const [requestedByName, setRequestedByName] = useState(defaultRequestedBy);
  const [isEmergency, setIsEmergency] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);

  // Photo attachment — same pattern as DeptDashboard's drag-and-drop uploader,
  // so PPO/Finance/School Head raising a request on someone's behalf can
  // attach evidence too, not just Dept accounts.
  const [dragActive, setDragActive] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = (file: File) => {
    setAttachedFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setAttachedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const triggerFileInput = () => fileInputRef.current?.click();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!office.trim() || !description.trim() || !requestedByName.trim()) return;

    await onSubmitRequest(office.trim(), description, requestedByName.trim(), isEmergency, filePreview || undefined);
    setDescription("");
    setIsEmergency(false);
    clearFile();
    setFormSuccess(true);
    setTimeout(() => {
      setFormSuccess(false);
      setIsFormOpen(false);
    }, 4000);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsFormOpen(true)}
        className={`flex items-center gap-2 bg-[#8C2331] text-white font-mono font-bold tracking-wider text-sm py-2.5 px-4 rounded-lg hover:bg-[#8C2331]/80 transition-all cursor-pointer shadow-sm shrink-0 ${className}`}
      >
        <Plus className="w-4 h-4" />
        {buttonLabel}
      </button>

      {isFormOpen && (
        <div className="fixed inset-0 bg-[#1A0E10]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E6DDD3] rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white flex items-center justify-between p-4 sm:p-6 pb-3 border-b border-[#E6DDD3]">
              <h3 className="font-display font-semibold text-base text-[#241012] flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-cyan-accent" /> Submit a Job Order
              </h3>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded text-slate-600 hover:text-[#241012] hover:bg-[#F0EAE4] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-4 sm:p-6 pt-4">

              {/* Requesting Office — dropdown when options are known, free text otherwise */}
              <div>
                <label className="block text-xs font-mono uppercase text-slate-700 mb-1.5 font-bold">Requesting Office</label>
                <div className="relative">
                  {officeOptions && officeOptions.length > 0 ? (
                    <select
                      value={office}
                      onChange={(e) => setOffice(e.target.value)}
                      required
                      className="w-full bg-[#F5F1EC] border border-[#E6DDD3] rounded-lg pl-9 pr-3 py-3 text-sm text-[#2B1210] focus:outline-none focus:border-cyan-accent font-sans appearance-none cursor-pointer"
                    >
                      <option value="" disabled>Select an office...</option>
                      {officeOptions.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={office}
                      onChange={(e) => setOffice(e.target.value)}
                      required
                      placeholder="e.g. Physical Plant Office (PPO)"
                      className="w-full bg-[#F5F1EC] border border-[#E6DDD3] rounded-lg pl-9 pr-3 py-3 text-sm text-[#2B1210] focus:outline-none focus:border-cyan-accent placeholder-slate-500 font-sans"
                    />
                  )}
                  <Building2 className="w-4 h-4 text-slate-600 absolute left-3 top-3.5 pointer-events-none" />
                </div>
                <span className="text-sm text-slate-600 font-sans mt-1.5 block">
                  Select which office this job order is being raised on behalf of.
                </span>
              </div>

              {/* Requested By */}
              <div>
                <label className="block text-xs font-mono uppercase text-slate-700 mb-1.5 font-bold">Requested By</label>
                <div className="relative">
                  <input
                    type="text"
                    value={requestedByName}
                    onChange={(e) => setRequestedByName(e.target.value)}
                    required
                    placeholder="Full name, e.g. Prof. Jellah Esconde"
                    className="w-full bg-[#F5F1EC] border border-[#E6DDD3] rounded-lg pl-9 pr-3 py-3 text-sm text-[#2B1210] focus:outline-none focus:border-cyan-accent placeholder-slate-500 font-sans"
                  />
                  <User className="w-4 h-4 text-slate-600 absolute left-3 top-3.5" />
                </div>
                <span className="text-sm text-slate-600 font-sans mt-1.5 block">
                  Enter the full name of the person authorizing this request, for the PPO's records.
                </span>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-mono uppercase text-slate-700 mb-1.5 font-bold">Issue Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={4}
                  placeholder="Describe the issue in plain language. e.g. Fluorescent bulb is humming near desk 3, or major leak in the server room cooling tower..."
                  className="w-full bg-[#F5F1EC] border border-[#E6DDD3] rounded-lg p-3 text-sm text-[#2B1210] focus:outline-none focus:border-cyan-accent resize-none placeholder-slate-500 font-sans leading-relaxed"
                />
                <div className="flex justify-between items-center text-sm text-slate-600 font-sans mt-1">
                  <span>Please be specific about location and safety indicators.</span>
                  <span className="text-[#6B1420] flex items-center gap-1 font-mono font-bold">
                    <Sparkles className="w-3 h-3 text-cyan-accent" />
                    {aiEnabled ? "AI Triage Active" : "Rule-Based Triage"}
                  </span>
                </div>
              </div>

              {/* Drag & Drop File upload Drop Zone */}
              <div>
                <label className="block text-xs font-mono uppercase text-slate-700 mb-1.5 font-bold">Attach Photo (Optional)</label>

                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={triggerFileInput}
                  className={`border-2 border-dashed rounded-lg p-5 flex flex-col items-center justify-center cursor-pointer transition-all ${dragActive
                    ? "border-[#8C2331] bg-[#8C2331]/5"
                    : attachedFile
                      ? "border-soft-green bg-soft-green/5"
                      : "border-[#DDD2C8] hover:border-cyan-accent bg-[#F5F1EC]"
                    }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />

                  {attachedFile ? (
                    <div className="text-center w-full">
                      {filePreview ? (
                        <img
                          src={filePreview}
                          alt="Attached Preview"
                          className="w-24 h-24 object-cover mx-auto rounded border border-[#E6DDD3] mb-2.5 animate-fade-in"
                        />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-soft-green mx-auto mb-2" />
                      )}
                      <p className="text-xs font-semibold text-[#2B1210] truncate max-w-[200px] mx-auto">
                        {attachedFile.name}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearFile();
                        }}
                        className="text-xs font-mono text-soft-red hover:underline mt-1.5 uppercase font-bold"
                      >
                        Clear File
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-xs text-slate-600 font-semibold">
                        Drag & Drop Photo Here
                      </p>
                      <p className="text-sm text-slate-600 mt-1 font-sans">
                        or click to manually browse system files
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Emergency / Urgent flag */}
              <div className="flex items-start gap-3 bg-safety-amber/5 border border-safety-amber/20 rounded-lg p-3.5">
                <input
                  type="checkbox"
                  id="isEmergencyCheckbox"
                  checked={isEmergency}
                  onChange={(e) => setIsEmergency(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-safety-amber cursor-pointer shrink-0"
                />
                <label htmlFor="isEmergencyCheckbox" className="text-sm font-sans cursor-pointer">
                  <span className="font-semibold text-safety-amber">Emergency / Urgent Safety Issue</span>
                  <span className="block text-slate-700 mt-0.5 leading-relaxed">
                    Check this only for genuinely urgent, safety-critical situations. It lets the Physical Plant Officer dispatch staff immediately on PPO approval alone, skipping School Head and Finance sign-off.
                  </span>
                </label>
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !description.trim() || !requestedByName.trim() || !office.trim()}
                  className="w-full bg-[#8C2331] text-white font-mono font-bold tracking-wider py-3 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-[#8C2331]/80 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting
                    ? aiEnabled
                      ? "PROCESSING AI TRIAGE..."
                      : "PROCESSING TRIAGE..."
                    : "SUBMIT JOB ORDER"}
                </button>
              </div>

              {formSuccess && (
                <div className="bg-soft-green/10 border border-soft-green/20 rounded-lg p-3 text-xs text-soft-green font-sans leading-normal animate-in fade-in">
                  Job order received.{" "}
                  {aiEnabled
                    ? "The AI-prioritized control room dispatcher has triaged your request."
                    : "The control room dispatcher has triaged your request using rule-based logic."}
                </div>
              )}

            </form>
          </div>
        </div>
      )}
    </>
  );
};