import React from "react";
import { JobOrder } from "../types";

interface PrintableJobOrderProps {
  ticket: JobOrder;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(raw: string | Date | null | undefined): string {
  if (!raw) return "—";
  const d = typeof raw === "string" ? new Date(raw) : raw;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtTime(raw: string | Date | null | undefined): string {
  if (!raw) return "";
  const d = typeof raw === "string" ? new Date(raw) : raw;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
}

// ── shared style tokens ───────────────────────────────────────────────────────

const BASE: React.CSSProperties = {
  fontFamily: "Arial, sans-serif",
  fontSize: "11px",
  color: "#000",
  background: "#fff",
  width: "100%",
  boxSizing: "border-box",
};

const cell: React.CSSProperties = {
  border: "1px solid #000",
  padding: "3px 6px",
  fontSize: "11px",
  fontFamily: "Arial, sans-serif",
  height: "22px",
  verticalAlign: "middle",
};

const hdr: React.CSSProperties = {
  ...cell,
  fontWeight: "bold",
  textAlign: "center",
  backgroundColor: "#e0e0e0",
};

const sectionBar: React.CSSProperties = {
  fontWeight: "bold",
  fontSize: "11px",
  background: "#d0d0d0",
  padding: "2px 5px",
  marginBottom: "3px",
  border: "1px solid #999",
};

// ── Letterhead ────────────────────────────────────────────────────────────────

const Letterhead: React.FC = () => (
  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "6px" }}>
    <tbody>
      <tr>
        <td style={{ width: "72px", verticalAlign: "middle", paddingRight: "10px" }}>
          <div style={{
            width: "64px", height: "64px", borderRadius: "50%",
            border: "2px solid #000", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: "7px", textAlign: "center",
            lineHeight: 1.3, fontWeight: "bold",
          }}>
            COSCA<br />SEAL
          </div>
        </td>
        <td style={{ textAlign: "center", verticalAlign: "middle" }}>
          <div style={{ fontSize: "10px", marginBottom: "1px" }}>Diocese of Dumaguete</div>
          <div style={{ fontWeight: "bold", fontSize: "12px" }}>
            Colegio de Santa Catalina de Alejandria (COSCA), INC.
          </div>
          <div style={{ fontWeight: "bold", fontSize: "12px", marginTop: "2px" }}>
            PHYSICAL PLANT OFFICE
          </div>
          <div style={{ fontSize: "10px", marginTop: "2px" }}>
            Bishop Epifanio B. Surban Street, Dumaguete City 6200
          </div>
        </td>
        <td style={{ width: "72px" }} />
      </tr>
    </tbody>
  </table>
);

const Divider: React.FC<{ page: number; total: number; id: string }> = ({ page, total, id }) => (
  <div style={{
    marginTop: "10px", fontSize: "9px", textAlign: "center",
    color: "#888", borderTop: "1px solid #ccc", paddingTop: "4px",
  }}>
    JORS COSCA &mdash; Job Order Request System &nbsp;|&nbsp; Ticket: {id}
    &nbsp;|&nbsp; Printed: {new Date().toLocaleString("en-PH")}
    &nbsp;|&nbsp; Page {page} of {total}
  </div>
);

// ── PAGE 1: Job Order Request Form ───────────────────────────────────────────

const Page1: React.FC<{ ticket: JobOrder }> = ({ ticket }) => {
  const riskLabel = (v: number) => {
    if (v >= 5) return "Critical";
    if (v === 4) return "High";
    if (v === 3) return "Moderate";
    if (v === 2) return "Minor";
    return "None";
  };

  const staffList = ticket.assignedStaffList ?? [];

  return (
    <div style={BASE}>
      <Letterhead />

      <div style={{ textAlign: "center", marginBottom: "8px" }}>
        <div style={{ fontWeight: "bold", fontSize: "15px", letterSpacing: "1px" }}>
          JOB ORDER REQUEST FORM
        </div>
        <div style={{ fontSize: "11px" }}>Physical Plant Office — JORS COSCA</div>
      </div>

      {/* Section 1: Request Details */}
      <div style={sectionBar}>SECTION 1 — REQUEST DETAILS</div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8px" }}>
        <tbody>
          <tr>
            <td style={{ ...cell, width: "22%", fontWeight: "bold" }}>Ticket No.</td>
            <td style={{ ...cell, width: "28%", fontWeight: "bold", letterSpacing: "0.5px" }}>{ticket.id}</td>
            <td style={{ ...cell, width: "22%", fontWeight: "bold" }}>Date Submitted</td>
            <td style={{ ...cell, width: "28%" }}>{fmt(ticket.dateSubmitted)} {fmtTime(ticket.dateSubmitted)}</td>
          </tr>
          <tr>
            <td style={{ ...cell, fontWeight: "bold" }}>Office / Dept.</td>
            <td style={{ ...cell }}>{ticket.office}</td>
            <td style={{ ...cell, fontWeight: "bold" }}>Job Type</td>
            <td style={{ ...cell }}>{ticket.jobType}</td>
          </tr>
          <tr>
            <td style={{ ...cell, fontWeight: "bold" }}>Status</td>
            <td style={{ ...cell, fontWeight: "bold" }}>{ticket.status}</td>
            <td style={{ ...cell, fontWeight: "bold" }}>Emergency?</td>
            <td style={{ ...cell, fontWeight: "bold", color: ticket.isEmergency ? "#c00" : "#000" }}>
              {ticket.isEmergency ? "YES — EMERGENCY" : "No"}
            </td>
          </tr>
          {ticket.dateCompleted && (
            <tr>
              <td style={{ ...cell, fontWeight: "bold" }}>Date Completed</td>
              <td style={{ ...cell }} colSpan={3}>{fmt(ticket.dateCompleted)} {fmtTime(ticket.dateCompleted)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Section 2: Description */}
      <div style={sectionBar}>SECTION 2 — DESCRIPTION OF WORK</div>
      <div style={{
        border: "1px solid #000", padding: "5px 8px",
        minHeight: "50px", marginBottom: "8px",
        whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: "11px",
      }}>
        {ticket.description || "—"}
      </div>

      {/* Section 3: Priority */}
      <div style={sectionBar}>SECTION 3 — PRIORITY ASSESSMENT</div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8px" }}>
        <thead>
          <tr>
            <th style={hdr}>Safety Risk</th>
            <th style={hdr}>Op. Impact</th>
            <th style={hdr}>Urgency</th>
            <th style={hdr}>People Affected</th>
            <th style={hdr}>Resource Cost</th>
            <th style={{ ...hdr, background: "#bbb" }}>Priority Score</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...cell, textAlign: "center" }}>{ticket.safetyRisk}/5 — {riskLabel(ticket.safetyRisk)}</td>
            <td style={{ ...cell, textAlign: "center" }}>{ticket.operationalImpact}/5</td>
            <td style={{ ...cell, textAlign: "center" }}>{ticket.urgency}/5</td>
            <td style={{ ...cell, textAlign: "center" }}>{ticket.peopleAffected}/5</td>
            <td style={{ ...cell, textAlign: "center" }}>{ticket.resourceCost}/5</td>
            <td style={{ ...cell, textAlign: "center", fontWeight: "bold", fontSize: "13px" }}>
              {ticket.priorityScore}/100
            </td>
          </tr>
        </tbody>
      </table>

      {/* Section 4: Cost */}
      <div style={sectionBar}>SECTION 4 — COST INFORMATION</div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8px" }}>
        <tbody>
          <tr>
            <td style={{ ...cell, width: "25%", fontWeight: "bold" }}>Estimated Cost</td>
            <td style={{ ...cell, width: "25%" }}>
              {ticket.estimatedCost != null
                ? `\u20b1 ${ticket.estimatedCost.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                : "—"}
            </td>
            <td style={{ ...cell, width: "25%", fontWeight: "bold" }}>Approved Amount</td>
            <td style={{ ...cell, width: "25%" }}>
              {ticket.approvedAmount != null
                ? `\u20b1 ${ticket.approvedAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                : "—"}
            </td>
          </tr>
          {ticket.financeNotes && (
            <tr>
              <td style={{ ...cell, fontWeight: "bold" }}>Finance Notes</td>
              <td style={{ ...cell }} colSpan={3}>{ticket.financeNotes}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Section 5: Assigned Staff */}
      <div style={sectionBar}>SECTION 5 — ASSIGNED MAINTENANCE STAFF</div>
      {staffList.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8px" }}>
          <thead>
            <tr>
              <th style={{ ...hdr, width: "5%" }}>#</th>
              <th style={{ ...hdr, width: "55%" }}>Name</th>
              <th style={{ ...hdr, width: "25%" }}>Role</th>
              <th style={{ ...hdr, width: "15%" }}>Match %</th>
            </tr>
          </thead>
          <tbody>
            {staffList.map((s, i) => (
              <tr key={s.id}>
                <td style={{ ...cell, textAlign: "center" }}>{i + 1}</td>
                <td style={{ ...cell }}>{s.name}{s.isLead ? " \u2605 (Lead)" : ""}</td>
                <td style={{ ...cell }}>{s.isLead ? "Lead Technician" : "Technician"}</td>
                <td style={{ ...cell, textAlign: "center" }}>{s.matchScore}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ ...cell, marginBottom: "8px", color: "#666", fontStyle: "italic" }}>
          {ticket.assignedStaff || "No staff assigned yet."}
        </div>
      )}

      {/* Section 6: Approval Status */}
      <div style={sectionBar}>SECTION 6 — APPROVAL CHAIN STATUS</div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8px" }}>
        <thead>
          <tr>
            <th style={hdr}>Approval Level</th>
            <th style={hdr}>Status</th>
            <th style={hdr}>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {[
            { label: "PPO (Physical Plant Officer)", approved: ticket.ppoApproved, note: "Verified & approved for dispatch" },
            { label: "Finance / VP-Admin", approved: ticket.financeApproved, note: "Funding released" },
            { label: "School President", approved: ticket.schoolHeadApproved, note: "Endorsed by School President" },
          ].map(({ label, approved, note }) => (
            <tr key={label}>
              <td style={{ ...cell, fontWeight: "bold" }}>{label}</td>
              <td style={{ ...cell, textAlign: "center", fontWeight: "bold", color: approved ? "#006400" : "#888" }}>
                {approved ? "\u2713 YES" : "Pending"}
              </td>
              <td style={{ ...cell, fontSize: "10px", color: "#444" }}>{note}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Section 7: Notes (optional) */}
      {ticket.notes && (
        <>
          <div style={sectionBar}>SECTION 7 — ADDITIONAL NOTES</div>
          <div style={{
            border: "1px solid #000", padding: "5px 8px",
            minHeight: "36px", marginBottom: "8px",
            whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: "11px",
          }}>
            {ticket.notes}
          </div>
        </>
      )}

      <Divider page={1} total={2} id={ticket.id} />
    </div>
  );
};

// ── PAGE 2: Budget Requisition Form ──────────────────────────────────────────

const Page2: React.FC<{ ticket: JobOrder }> = ({ ticket }) => {
  const submitted = ticket.dateSubmitted ? new Date(ticket.dateSubmitted) : null;
  const dateStr = submitted
    ? submitted.toLocaleDateString("en-PH", { day: "2-digit", month: "short", year: "2-digit" }).replace(/ /g, "-")
    : "—";

  const items = ticket.budgetItems ?? [];
  const total = ticket.budgetItemsTotal ?? items.reduce((s, i) => s + i.cost, 0);
  const MIN_ROWS = 10;
  const paddedItems = [...items, ...Array(Math.max(0, MIN_ROWS - items.length)).fill(null)];

  return (
    <div style={BASE}>
      <Letterhead />

      <div style={{ textAlign: "center", marginBottom: "8px" }}>
        <div style={{ fontWeight: "bold", fontSize: "15px", letterSpacing: "1px" }}>
          BUDGET REQUISITION FORM
        </div>
        <div style={{ fontSize: "11px" }}>(PPO Maintenance Material)</div>
        <div style={{ fontSize: "10px", marginTop: "2px" }}>{dateStr}</div>
      </div>

      <div style={{ fontSize: "11px", marginBottom: "4px" }}>
        <strong>Ticket No.:</strong> {ticket.id}
        &nbsp;&nbsp;&nbsp;
        <strong>Office/Dept.:</strong> {ticket.office}
        &nbsp;&nbsp;&nbsp;
        <strong>Type:</strong> {ticket.jobType}
        {ticket.isEmergency && (
          <strong style={{ marginLeft: "8px", color: "#c00" }}>EMERGENCY</strong>
        )}
      </div>

      <div style={{ fontSize: "11px", marginBottom: "6px" }}>
        <strong>Description of Work:</strong> {ticket.description}
      </div>

      <div style={{ fontWeight: "bold", fontSize: "11px", marginBottom: "4px" }}>
        Purchase for Maintenance Works.
      </div>

      {/* Itemized table */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...hdr, width: "7%" }}>ITEM NO.</th>
            <th style={{ ...hdr, width: "7%" }}>QTY</th>
            <th style={{ ...hdr, width: "8%" }}>UNIT</th>
            <th style={{ ...hdr, width: "46%" }}>DESCRIPTION</th>
            <th style={{ ...hdr, width: "16%" }}>UNIT COST</th>
            <th style={{ ...hdr, width: "16%" }}>COST</th>
          </tr>
        </thead>
        <tbody>
          {paddedItems.map((item, idx) => (
            <tr key={idx}>
              <td style={{ ...cell, textAlign: "center" }}>{item ? item.itemNo : ""}</td>
              <td style={{ ...cell, textAlign: "center" }}>{item ? item.qty : ""}</td>
              <td style={{ ...cell, textAlign: "center" }}>{item ? (item.unit || "pcs.") : ""}</td>
              <td style={{ ...cell }}>{item ? item.description : ""}</td>
              <td style={{ ...cell, textAlign: "right" }}>
                {item
                  ? `\u20b1 ${item.unitCost.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                  : <span style={{ color: "#ccc" }}>\u20b1</span>}
              </td>
              <td style={{ ...cell, textAlign: "right" }}>
                {item
                  ? `\u20b1 ${item.cost.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                  : <span style={{ color: "#ccc" }}>\u20b1</span>}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} style={{ ...cell, textAlign: "center", fontWeight: "bold", fontSize: "12px" }}>
              TOTAL
            </td>
            <td style={{ ...cell, textAlign: "right", fontWeight: "bold", fontSize: "12px" }}>
              {items.length > 0
                ? `\u20b1 ${total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                : <span style={{ color: "#ccc" }}>\u20b1</span>}
            </td>
          </tr>
          <tr>
            <td colSpan={6} style={{ ...cell, textAlign: "center", fontStyle: "italic" }}>
              ***** Nothing Follows *****
            </td>
          </tr>
          <tr>
            <td colSpan={6} style={{ ...cell, textAlign: "center" }}>
              Note: For Maintenance works.
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Signature blocks */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "32px", fontSize: "11px" }}>
        <tbody>
          <tr>
            <td style={{ width: "50%", paddingBottom: "38px", verticalAlign: "bottom" }}>
              <em>Requested by:</em>
            </td>
            <td style={{ width: "50%", paddingBottom: "38px", verticalAlign: "bottom" }}>
              <em>Noted by:</em>
            </td>
          </tr>
          <tr>
            <td style={{ verticalAlign: "top", paddingRight: "60px" }}>
              <div style={{ borderTop: "1px solid #000", paddingTop: "4px" }}>
                <div style={{ fontWeight: "bold", textTransform: "uppercase" }}>Physical Plant Officer</div>
                <div style={{ fontSize: "10px", color: "#444" }}>Physical Plant Office</div>
                {ticket.ppoApproved && (
                  <div style={{ fontSize: "10px", marginTop: "2px" }}>\u2713 Verified &amp; Approved</div>
                )}
              </div>
            </td>
            <td style={{ verticalAlign: "top" }}>
              <div style={{ borderTop: "1px solid #000", paddingTop: "4px" }}>
                <div style={{ fontWeight: "bold", textTransform: "uppercase" }}>VP-Admin and Finance</div>
                <div style={{ fontSize: "10px", color: "#444" }}>Finance Department Head</div>
                {ticket.financeApproved && (
                  <div style={{ fontSize: "10px", marginTop: "2px" }}>\u2713 Funding Released</div>
                )}
              </div>
            </td>
          </tr>
          <tr>
            <td style={{ paddingTop: "32px", paddingBottom: "38px", verticalAlign: "bottom" }}>
              <em>Approved by:</em>
            </td>
            <td />
          </tr>
          <tr>
            <td style={{ verticalAlign: "top", paddingRight: "60px" }}>
              <div style={{ borderTop: "1px solid #000", paddingTop: "4px" }}>
                <div style={{ fontWeight: "bold", textTransform: "uppercase" }}>School President</div>
                <div style={{ fontSize: "10px", color: "#444" }}>School Directress / President</div>
                {ticket.schoolHeadApproved && (
                  <div style={{ fontSize: "10px", marginTop: "2px" }}>\u2713 Endorsed</div>
                )}
              </div>
            </td>
            <td />
          </tr>
        </tbody>
      </table>

      <Divider page={2} total={2} id={ticket.id} />
    </div>
  );
};

// ── Root export ───────────────────────────────────────────────────────────────

// Matches the official COSCA physical Budget Requisition Form exactly:
//   Page 1: Job Order Request Form (request details, priority, cost, staff, approvals)
//   Page 2: Budget Requisition Form (itemized materials table + signature blocks)
export const PrintableJobOrder: React.FC<PrintableJobOrderProps> = ({ ticket }) => (
  <div className="print-only">
    <Page1 ticket={ticket} />
    {/* CSS page break — both properties for cross-browser support */}
    <div style={{ pageBreakAfter: "always", breakAfter: "page" }} />
    <Page2 ticket={ticket} />
  </div>
);
