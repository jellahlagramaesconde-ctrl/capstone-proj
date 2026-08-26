import React, { useState, useRef, useMemo } from "react";
import { JobOrder, Notification } from "../types";
import { TicketStub } from "./TicketStub";
import { TicketDetailsModal } from "./TicketDetailsModal";
import { formatPeso, sumJobOrderCosts } from "../priceUtils";
import { Upload, ClipboardCheck, BellRing, Sparkles, Image as ImageIcon, Send, Search, User, X, Plus, Wallet } from "lucide-react";

interface DeptDashboardProps {
  tickets: JobOrder[];
  notifications: Notification[];
  // The real, authenticated department name — no more hardcoded office.
  officeName: string;
  onSubmitRequest: (office: string, description: string, requestedByName: string, isEmergency: boolean, photoUrl?: string) => Promise<void>;
  isSubmitting: boolean;
  onTicketClick?: (ticketId: string) => void;
  /** Whether the backend actually has Gemini configured right now. */
  aiEnabled?: boolean;
}

export const DeptDashboard: React.FC<DeptDashboardProps> = ({
  tickets,
  notifications,
  officeName,
  onSubmitRequest,
  isSubmitting,
  onTicketClick,
  aiEnabled = false,
}) => {
  const [description, setDescription] = useState("");
  const [requestedByName, setRequestedByName] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<JobOrder | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Pending" | "In Progress" | "Completed">("All");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      handleFileSelected(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    setAttachedFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const clearFile = () => {
    setAttachedFile(null);
    setFilePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !requestedByName.trim()) return;

    await onSubmitRequest(officeName, description, requestedByName.trim(), isEmergency, filePreview || undefined);
    setDescription("");
    setRequestedByName("");
    setIsEmergency(false);
    clearFile();
    setFormSuccess(true);
    setTimeout(() => {
      setFormSuccess(false);
      setIsFormOpen(false);
    }, 4000);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      ticket.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.jobType.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === "Pending") {
      return ticket.status === "Pending";
    }
    if (statusFilter === "In Progress") {
      return ticket.status === "In Progress";
    }
    if (statusFilter === "Completed") {
      return ticket.status === "Completed";
    }
    return true;
  });

  // Total peso value of the requests currently shown (respects search + status filter)
  const totalFilteredValue = useMemo(() => sumJobOrderCosts(filteredTickets), [filteredTickets]);
  // Total peso value across every request this office has ever submitted
  const totalAllValue = useMemo(() => sumJobOrderCosts(tickets), [tickets]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#F7F4F0] text-[#2B1210]">

      {/* Requests take full width now; submission form opens in a modal via the button below */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h2 className="font-display font-bold text-xl text-[#241012]">Job Order Requests</h2>
          <p className="text-sm text-slate-600 font-sans mt-0.5">Submit new requests and track their status here.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-2 bg-[#8C2331] text-white font-mono font-bold tracking-wider text-sm py-2.5 px-4 rounded-lg hover:bg-[#8C2331]/80 transition-all cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4" />
          NEW REQUEST
        </button>
      </div>

      {/* Total Value Summary */}
      <div className="bg-white border border-[#E6DDD3] rounded-lg p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm mb-6 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded bg-[#6B1420]/10 border border-[#6B1420]/30 flex items-center justify-center text-[#6B1420] shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-mono tracking-wider text-slate-700 uppercase">Total Value — All My Requests</span>
            <p className="text-sm text-slate-600 font-sans mt-0.5">Combined estimated / approved cost of every job order this office has submitted</p>
          </div>
        </div>
        <h4 className="text-2xl sm:text-3xl font-mono font-bold text-[#6B1420] leading-none shrink-0">
          {formatPeso(totalAllValue)}
        </h4>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:gap-8 items-start">

        {/* My Requests (now full width) */}
        <div className="bg-white border border-[#E6DDD3] rounded-lg p-4 sm:p-6 shadow-sm">
          <div className="border-b border-[#E6DDD3] pb-4">
            <h3 className="font-display font-semibold text-base text-[#241012] flex items-center justify-between">
              <span>My Requests ({tickets.length})</span>
              <span className="text-xs font-mono font-normal text-slate-600">Pre-sorted by Submission Date</span>
            </h3>

            {/* Quick Find & Tracking Filter Controls */}
            <div className="mt-4 space-y-3">
              {/* Search Input Box */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search requests by ID, description, or repair type..."
                  className="w-full bg-[#F5F1EC] border border-[#E6DDD3] rounded-lg pl-9 pr-16 py-2 text-xs text-[#2B1210] placeholder-slate-500 focus:outline-none focus:border-cyan-accent focus:ring-1 focus:ring-cyan-accent"
                />
                <Search className="w-4 h-4 text-slate-600 absolute left-3 top-2.5" />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-2 text-xs text-[#6B1420] hover:underline font-mono font-bold"
                  >
                    CLEAR
                  </button>
                )}
              </div>

              {/* Status Filter Pills */}
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-xs font-mono text-slate-600 uppercase mr-1">Status:</span>
                <button
                  type="button"
                  onClick={() => setStatusFilter("All")}
                  className={`px-2.5 py-0.5 rounded text-sm font-medium font-mono transition-all cursor-pointer ${statusFilter === "All"
                    ? "bg-[#E6DDD3] text-[#241012] border border-[#DDD2C8]"
                    : "text-slate-700 hover:bg-[#F0EAE4]"
                    }`}
                >
                  All ({tickets.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("Pending")}
                  className={`px-2.5 py-0.5 rounded text-sm font-medium font-mono transition-all cursor-pointer ${statusFilter === "Pending"
                    ? "bg-[#6B1420]/15 text-[#6B1420] border border-[#6B1420]/30"
                    : "text-slate-700 hover:bg-[#F0EAE4]"
                    }`}
                >
                  Awaiting Approvals ({tickets.filter(t => t.status === "Pending").length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("In Progress")}
                  className={`px-2.5 py-0.5 rounded text-sm font-medium font-mono transition-all cursor-pointer ${statusFilter === "In Progress"
                    ? "bg-cyan-accent/15 text-cyan-accent border border-cyan-accent/30"
                    : "text-slate-700 hover:bg-[#F0EAE4]"
                    }`}
                >
                  Approved & Dispatched ({tickets.filter(t => t.status === "In Progress").length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("Completed")}
                  className={`px-2.5 py-0.5 rounded text-sm font-medium font-mono transition-all cursor-pointer ${statusFilter === "Completed"
                    ? "bg-soft-green/15 text-soft-green border border-soft-green/30"
                    : "text-slate-700 hover:bg-[#F0EAE4]"
                    }`}
                >
                  Completed ({tickets.filter(t => t.status === "Completed").length})
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4 mt-6 max-h-[580px] overflow-y-auto pr-1">
            {filteredTickets.length > 0 && (
              <div className="flex items-center justify-between text-xs font-mono text-slate-700 px-1 pb-1">
                <span>{filteredTickets.length} request{filteredTickets.length !== 1 ? "s" : ""} shown</span>
                <span>
                  Subtotal: <span className="font-bold text-[#6B1420]">{formatPeso(totalFilteredValue)}</span>
                </span>
              </div>
            )}
            {filteredTickets.length > 0 ? (
              filteredTickets.map((ticket) => (
                <TicketStub
                  key={ticket.id}
                  ticket={ticket}
                  isAdmin={false}
                  onClick={(ticketId) => {
                    const found = tickets.find(t => t.id === ticketId) || null;
                    setSelectedTicket(found);
                    onTicketClick?.(ticketId);
                  }}
                />
              ))
            ) : (
              <div className="text-center py-16 border border-dashed border-[#E6DDD3] rounded-lg">
                <ClipboardCheck className="w-10 h-10 text-slate-600 mx-auto stroke-1" />
                <p className="text-sm text-slate-600 mt-2 font-mono">
                  {tickets.length > 0 ? "No matching requests found." : "No requests submitted yet."}
                </p>
                {tickets.length > 0 && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("All");
                    }}
                    className="mt-3 text-xs text-[#6B1420] hover:underline font-mono"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Notifications Panel below */}
      <section className="bg-white border border-[#E6DDD3] rounded-lg p-4 sm:p-6 mt-6 sm:mt-8 shadow-sm">
        <h3 className="font-display font-semibold text-sm text-[#241012] flex items-center gap-2 mb-4 pb-2 border-b border-[#E6DDD3]">
          <BellRing className="w-4 h-4 text-cyan-accent" /> Recent Activity & Status Changes
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {notifications.slice(0, 3).map((notif) => (
            <div key={notif.id} className="bg-[#F5F1EC] border border-[#E6DDD3] p-4 rounded-lg flex flex-col justify-between text-xs shadow-sm">
              <p className="text-slate-600 leading-relaxed font-sans">{notif.message}</p>
              <div className="flex justify-between items-center text-sm text-slate-600 font-mono mt-3 pt-2 border-t border-[#E6DDD3]">
                <span>{new Date(notif.timestamp).toLocaleDateString()}</span>
                <span>{new Date(notif.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Ticket Details Modal */}
      <TicketDetailsModal
        isOpen={!!selectedTicket}
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        isAdmin={false}
      />

      {/* New Job Order Modal — triggered by the "NEW JOB ORDER" button above */}
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

              {/* Office Name (Pre-filled and Disabled — comes from the authenticated account) */}
              <div>
                <label className="block text-xs font-mono uppercase text-slate-700 mb-1.5 font-bold">Requesting Office</label>
                <input
                  type="text"
                  value={officeName}
                  disabled
                  className="w-full bg-[#F0EAE4] border border-[#E6DDD3] rounded-lg p-3 text-sm text-slate-700 font-sans cursor-not-allowed select-none"
                />
                <span className="text-sm text-slate-600 font-sans mt-1.5 block">
                  Office pre-filled based on authenticated department session credentials.
                </span>
              </div>

              {/* Requested By: full name of the department head making the request */}
              <div>
                <label className="block text-xs font-mono uppercase text-slate-700 mb-1.5 font-bold">Requested By (Head of Department)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={requestedByName}
                    onChange={(e) => setRequestedByName(e.target.value)}
                    required
                    placeholder="Full name, e.g. Prof. Mariel D. Santiagu"
                    className="w-full bg-[#F5F1EC] border border-[#E6DDD3] rounded-lg pl-9 pr-3 py-3 text-sm text-[#2B1210] focus:outline-none focus:border-cyan-accent placeholder-slate-500 font-sans"
                  />
                  <User className="w-4 h-4 text-slate-600 absolute left-3 top-3.5" />
                </div>
                <span className="text-sm text-slate-600 font-sans mt-1.5 block">
                  Enter the full name of the person authorizing this request, for the PPO's records.
                </span>
              </div>

              {/* Description Textarea */}
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
                    {aiEnabled ? "AI Assistance Active" : "Rule-Based Assistance"}
                  </span>
                </div>
              </div>

              {/* Emergency / Urgent flag */}
              <div className="flex items-start gap-3 bg-safety-amber/5 border border-safety-amber/20 rounded-lg p-3.5">
                <input
                  type="checkbox"
                  id="deptIsEmergencyCheckbox"
                  checked={isEmergency}
                  onChange={(e) => setIsEmergency(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-safety-amber cursor-pointer shrink-0"
                />
                <label htmlFor="deptIsEmergencyCheckbox" className="text-sm font-sans cursor-pointer">
                  <span className="font-semibold text-safety-amber">Emergency / Urgent Safety Issue (Optional) </span>
                  <span className="block text-slate-700 mt-0.5 leading-relaxed">
                    Check this only for genuinely urgent, safety-critical situations. It lets the Physical Plant Officer dispatch staff immediately upon approval, skipping School Head and Finance sign-off.
                  </span>
                </label>
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
                    /* Attached Preview */
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
                    /* Drag Zone default instruction */
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

              {/* Action buttons */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !description.trim() || !requestedByName.trim()}
                  className="w-full bg-[#8C2331] text-[#1A0E10] font-mono font-bold tracking-wider py-3 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-[#8C2331]/80 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Send className="w-4 h-4 text-blueprint-navy" />
                  {isSubmitting
                    ? aiEnabled
                      ? "PROCESSING AI PARSING..."
                      : "PROCESSING REQUEST..."
                    : "SUBMIT JOB ORDER"}
                </button>
              </div>

              {/* Success notification */}
              {formSuccess && (
                <div className="bg-soft-green/10 border border-soft-green/20 rounded-lg p-3 text-xs text-soft-green font-sans leading-normal animate-in fade-in">
                  Job order received.{" "}
                  {aiEnabled
                    ? "The AI-prioritized control room dispatcher has triaged your request."
                    : "The control room dispatcher has triaged your request using rule-based logic."}{" "}
                  You can track status on the right queue.
                </div>
              )}

            </form>
          </div>
        </div>
      )}

    </div>
  );
};