import React, { useState, useRef, useMemo } from "react";
import { JobOrder, Notification } from "../types";
import { TicketStub } from "./TicketStub";
import { TicketDetailsModal } from "./TicketDetailsModal";
import { formatPeso, sumJobOrderCosts } from "../priceUtils";
import { Upload, ClipboardCheck, BellRing, Sparkles, Image as ImageIcon, Send, Search, User, X, Plus, Wallet, Building2, ArrowRight, Check, FileText } from "lucide-react";

interface DeptDashboardProps {
  tickets: JobOrder[];
  notifications: Notification[];
  // The real, authenticated department name — no more hardcoded office.
  officeName: string;
  onSubmitRequest: (office: string, description: string, requestedByName: string, isEmergency: boolean, photoUrls?: string[], requiresFunds?: boolean, severity?: "Regular" | "Moderate" | "Emergency") => Promise<void>;
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
  const [severity, setSeverity] = useState<"Regular" | "Moderate" | "Emergency">("Regular");
  const [requiresFunds, setRequiresFunds] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const MAX_PHOTOS = 5;
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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelected(Array.from(e.target.files));
    }
  };

  // Phone camera photos are often several MB before encoding, and become
  // ~33% larger once base64-encoded — easily blowing past the backend's
  // 10mb JSON body limit (see server.ts). Downscaling to a reasonable max
  // width and re-encoding as compressed JPEG keeps every submission well
  // under that limit while staying plenty legible for PPO review.
  const compressImage = (file: File, maxWidth = 1280, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxWidth / img.width);
          const canvas = document.createElement("canvas");
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas not supported"));
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFilesSelected = (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    const room = MAX_PHOTOS - attachedFiles.length;
    const accepted = imageFiles.slice(0, Math.max(0, room));
    if (accepted.length === 0) return;

    setAttachedFiles((prev) => [...prev, ...accepted]);
    accepted.forEach((file) => {
      compressImage(file)
        .then((compressedDataUrl) => setFilePreviews((prev) => [...prev, compressedDataUrl]))
        .catch(() => setFilePreviews((prev) => [...prev, ""]));
    });
  };

  const removeFileAt = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
    setFilePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const clearFiles = () => {
    setAttachedFiles([]);
    setFilePreviews([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !requestedByName.trim()) return;

    await onSubmitRequest(
      officeName,
      description,
      requestedByName.trim(),
      isEmergency || severity === "Emergency",
      filePreviews.filter(Boolean),
      requiresFunds,
      severity
    );
    setDescription("");
    setRequestedByName("");
    setIsEmergency(false);
    setSeverity("Regular");
    setRequiresFunds(false);
    clearFiles();
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#FAF7F5] border border-[#E6DDD3] rounded-2xl sm:rounded-3xl shadow-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto overflow-x-hidden">

            {/* Crimson Header Banner */}
            <div className="sticky top-0 z-10 bg-[#7C1D2D] text-white px-5 sm:px-6 py-4 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-[11px] font-mono tracking-widest uppercase text-white/75 leading-none">
                    JORS · COSCA
                  </p>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5">
                    Job order request
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6">

              {/* Step 1: Requester */}
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-6 h-6 rounded-full bg-[#7C1D2D] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-[#1A0E10] text-sm leading-tight">Requester</h4>
                    <p className="text-[11px] text-slate-500">Para kanino ang request?</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Requesting Office (Pre-filled from session) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Requesting office *</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={officeName}
                        disabled
                        className="w-full bg-[#F0EAE4] border border-[#DDD2C8] rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-700 outline-none font-sans cursor-not-allowed select-none shadow-2xs"
                      />
                      <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    </div>
                  </div>

                  {/* Requested By */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Requested by *</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={requestedByName}
                        onChange={(e) => setRequestedByName(e.target.value)}
                        required
                        placeholder="Prof. May Lin"
                        className="w-full bg-white border border-[#DDD2C8] focus:border-[#7C1D2D] focus:ring-2 focus:ring-[#7C1D2D]/20 rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#2B1210] outline-none placeholder-slate-400 font-sans shadow-2xs"
                      />
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: What needs fixing? */}
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-6 h-6 rounded-full bg-[#7C1D2D] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-[#1A0E10] text-sm leading-tight">What needs fixing?</h4>
                    <p className="text-[11px] text-slate-500">Isama ang location at safety concerns.</p>
                  </div>
                </div>

                <div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    rows={3}
                    maxLength={500}
                    placeholder="Humming ang fluorescent bulb malapit sa desk 3..."
                    className="w-full bg-white border border-[#DDD2C8] focus:border-[#7C1D2D] focus:ring-2 focus:ring-[#7C1D2D]/20 rounded-xl p-3.5 text-sm text-[#2B1210] outline-none resize-none placeholder-slate-400 font-sans leading-relaxed shadow-2xs"
                  />
                  <div className="flex justify-between items-center text-[11px] text-slate-500 font-sans mt-0.5">
                    <span></span>
                    <span className="font-mono text-slate-500">{description.length}/500</span>
                  </div>
                </div>

                {/* Drag & drop upload */}
                <div className="mt-2.5">
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => attachedFiles.length < MAX_PHOTOS && triggerFileInput()}
                    className={`border-2 border-dashed rounded-xl p-4 sm:p-5 flex flex-col items-center justify-center transition-all bg-white shadow-2xs ${attachedFiles.length >= MAX_PHOTOS ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                      } ${dragActive
                        ? "border-[#7C1D2D] bg-[#7C1D2D]/5"
                        : attachedFiles.length > 0
                          ? "border-emerald-500 bg-emerald-50/20"
                          : "border-[#D6CCC2] hover:border-[#7C1D2D]"
                      }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      multiple
                      className="hidden"
                    />

                    {attachedFiles.length > 0 ? (
                      <div className="w-full">
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                          {attachedFiles.map((file, i) => (
                            <div key={i} className="relative group">
                              {filePreviews[i] ? (
                                <img
                                  src={filePreviews[i]}
                                  alt={`Attached preview ${i + 1}`}
                                  className="w-full aspect-square object-cover rounded-lg border border-[#E6DDD3] shadow-xs"
                                />
                              ) : (
                                <div className="w-full aspect-square flex items-center justify-center bg-white rounded-lg border border-[#E6DDD3]">
                                  <ImageIcon className="w-5 h-5 text-slate-400" />
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFileAt(i);
                                }}
                                title={`Remove ${file.name}`}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-bold shadow-xs hover:bg-rose-700 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          {attachedFiles.length < MAX_PHOTOS && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerFileInput();
                              }}
                              className="w-full aspect-square flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#DDD2C8] hover:border-[#7C1D2D] text-slate-400 hover:text-[#7C1D2D] transition-colors"
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#F0EAE4]">
                          <span className="text-[11px] text-slate-500">
                            {attachedFiles.length} of {MAX_PHOTOS} photo{attachedFiles.length === 1 ? "" : "s"} attached
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              clearFiles();
                            }}
                            className="text-[11px] font-mono text-rose-600 hover:underline uppercase font-bold"
                          >
                            Clear All
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-1">
                        <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                        <p className="text-xs sm:text-sm font-semibold text-[#1A0E10]">
                          I-drag ang photos, o mag-click para mag-browse
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Optional, hanggang 5 photos
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 3: Request type */}
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-6 h-6 rounded-full bg-[#7C1D2D] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-[#1A0E10] text-sm leading-tight">Request type</h4>
                    <p className="text-[11px] text-slate-500">Iwanang off pareho kung routine repair.</p>
                  </div>
                </div>

                {/* 2 Interactive Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Needs funds / materials Card */}
                  <div
                    onClick={() => setRequiresFunds(!requiresFunds)}
                    className={`bg-white border rounded-xl p-3.5 cursor-pointer transition-all flex items-start gap-3 shadow-2xs ${requiresFunds
                        ? "border-[#7C1D2D] ring-2 ring-[#7C1D2D]/15 bg-[#7C1D2D]/[0.02]"
                        : "border-[#DDD2C8] hover:border-[#7C1D2D]/40"
                      }`}
                  >
                    <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${requiresFunds ? "bg-[#7C1D2D] border-[#7C1D2D] text-white" : "border-slate-300 bg-white"
                      }`}>
                      {requiresFunds && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div>
                      <span className="font-semibold text-xs sm:text-sm text-[#1A0E10] block leading-tight">
                        Needs funds / materials
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-1 leading-snug">
                        Kailangan ng President endorsement at Finance approval.
                      </span>
                    </div>
                  </div>

                  {/* Emergency / urgent Card */}
                  <div
                    onClick={() => {
                      const next = !isEmergency;
                      setIsEmergency(next);
                      setSeverity(next ? "Emergency" : "Regular");
                    }}
                    className={`bg-white border rounded-xl p-3.5 cursor-pointer transition-all flex items-start gap-3 shadow-2xs ${isEmergency
                        ? "border-red-500 ring-2 ring-red-500/15 bg-red-50/20"
                        : "border-[#DDD2C8] hover:border-red-400/40"
                      }`}
                  >
                    <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isEmergency ? "bg-red-600 border-red-600 text-white" : "border-slate-300 bg-white"
                      }`}>
                      {isEmergency && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div>
                      <span className="font-semibold text-xs sm:text-sm text-[#1A0E10] block leading-tight">
                        Emergency / urgent
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-1 leading-snug">
                        Para lang sa safety-critical. PPO approval lang ang kailangan.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dynamic Approval Route Triage Visualizer */}
                <div className="bg-white border border-[#E8DFD8] rounded-xl p-3 sm:p-3.5 mt-3 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono tracking-wider uppercase text-slate-500 font-semibold mb-2">
                    <Sparkles className="w-3 h-3 text-[#7C1D2D]" />
                    <span>APPROVAL ROUTE · {aiEnabled ? "AI-ASSISTED TRIAGE" : "RULE-BASED TRIAGE"}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="px-2.5 py-1 rounded-md bg-[#7C1D2D] text-white text-[11px] font-semibold tracking-wide shadow-2xs">
                      Submit
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />

                    {isEmergency ? (
                      <span className="px-2.5 py-1 rounded-md bg-red-600 text-white text-[11px] font-semibold tracking-wide shadow-2xs animate-pulse">
                        🚨 Immediate PPO Dispatch
                      </span>
                    ) : requiresFunds ? (
                      <>
                        <span className="px-2.5 py-1 rounded-md bg-[#F2EDE8] text-[#241012] border border-[#DDD2C8] text-[11px] font-medium">
                          PPO review
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="px-2.5 py-1 rounded-md bg-[#F2EDE8] text-[#241012] border border-[#DDD2C8] text-[11px] font-medium">
                          President review
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="px-2.5 py-1 rounded-md bg-[#F2EDE8] text-[#241012] border border-[#DDD2C8] text-[11px] font-medium">
                          Finance release
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="px-2.5 py-1 rounded-md bg-[#F2EDE8] text-[#241012] border border-[#DDD2C8] text-[11px] font-medium">
                          Dispatch
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="px-2.5 py-1 rounded-md bg-[#F2EDE8] text-[#241012] border border-[#DDD2C8] text-[11px] font-medium">
                          PPO review
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="px-2.5 py-1 rounded-md bg-[#F2EDE8] text-[#241012] border border-[#DDD2C8] text-[11px] font-medium">
                          Dispatch
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Success notification */}
              {formSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 font-sans leading-normal animate-in fade-in">
                  Job order received.{" "}
                  {aiEnabled
                    ? "The AI-prioritized control room dispatcher has triaged your request."
                    : "The control room dispatcher has triaged your request using rule-based logic."}{" "}
                  You can track status on the right queue.
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-[#E8DFD8]">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="text-xs sm:text-sm font-semibold text-slate-600 hover:text-black transition-colors px-2 py-1.5 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !description.trim() || !requestedByName.trim()}
                  className="border border-[#7C1D2D] text-[#7C1D2D] hover:bg-[#7C1D2D] hover:text-white font-mono font-bold text-xs sm:text-sm tracking-wider py-2.5 px-5 sm:px-6 rounded-xl transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSubmitting ? "PROCESSING..." : "SUBMIT JOB ORDER"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};