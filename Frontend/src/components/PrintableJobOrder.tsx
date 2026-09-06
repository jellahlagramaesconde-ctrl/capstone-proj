import React from "react";
import { JobOrder } from "../types";
import { formatPeso } from "../priceUtils";

interface PrintableJobOrderProps {
  ticket: JobOrder;
}

// Rendered off-screen at all times; only becomes visible via the
// `.print-only` CSS rule in index.css when the browser's print dialog is
// triggered. Deliberately plain — black text, thin rules, no icons, no
// color-coded badges, no buttons — so it reads as a formal paper document
// rather than a printout of the app's UI. Layout mirrors the PPO's
// existing paper Budget Requisition Form (letterhead, itemized table,
// three signature blocks) so the printed output looks familiar to staff
// who already use the paper version.
export const PrintableJobOrder: React.FC<PrintableJobOrderProps> = ({ ticket }) => {
  const submitted = ticket.dateSubmitted ? new Date(ticket.dateSubmitted) : null;
  const staffNames =
    ticket.assignedStaffList && ticket.assignedStaffList.length > 0
      ? ticket.assignedStaffList.map((s) => s.name + (s.isLead ? " (Lead)" : "")).join(", ")
      : ticket.assignedStaff || "Unassigned";

  return (
    <div className="print-only" style={{ color: "#000", background: "#fff", padding: "0.5in", fontFamily: "Arial, sans-serif", fontSize: "12px" }}>
      {/* Letterhead */}
      <div style={{ textAlign: "center", marginBottom: "18px" }}>
        <div style={{ fontWeight: "bold", fontSize: "13px" }}>Diocese of Dumaguete</div>
        <div style={{ fontWeight: "bold", fontSize: "13px" }}>Colegio de Santa Catalina de Alejandria (COSCA), INC.</div>
        <div style={{ fontWeight: "bold", fontSize: "12px", marginTop: "2px" }}>PHYSICAL PLANT OFFICE</div>
        <div style={{ fontSize: "10px", marginTop: "2px" }}>Bishop Epifanio B. Surban Street, Dumaguete City 6200</div>
        <div style={{ fontWeight: "bold", fontSize: "16px", marginTop: "14px", letterSpacing: "0.5px" }}>
          JOB ORDER / WORK REQUISITION FORM
        </div>
      </div>

      {/* Ticket meta */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "12px" }}>
        <tbody>
          <tr>
            <td style={{ padding: "3px 0", fontWeight: "bold", width: "18%" }}>Ticket No.:</td>
            <td style={{ padding: "3px 0", width: "32%" }}>{ticket.id}</td>
            <td style={{ padding: "3px 0", fontWeight: "bold", width: "18%" }}>Date Submitted:</td>
            <td style={{ padding: "3px 0", width: "32%" }}>{submitted ? submitted.toLocaleDateString() : "—"}</td>
          </tr>
          <tr>
            <td style={{ padding: "3px 0", fontWeight: "bold" }}>Office/Dept.:</td>
            <td style={{ padding: "3px 0" }}>{ticket.office}</td>
            <td style={{ padding: "3px 0", fontWeight: "bold" }}>Job Type:</td>
            <td style={{ padding: "3px 0" }}>{ticket.jobType}</td>
          </tr>
          <tr>
            <td style={{ padding: "3px 0", fontWeight: "bold" }}>Status:</td>
            <td style={{ padding: "3px 0" }}>{ticket.status}</td>
            <td style={{ padding: "3px 0", fontWeight: "bold" }}>Assigned To:</td>
            <td style={{ padding: "3px 0" }}>{staffNames}</td>
          </tr>
        </tbody>
      </table>

      {/* Description */}
      <div style={{ marginBottom: "12px" }}>
        <div style={{ fontWeight: "bold", borderBottom: "1px solid #000", marginBottom: "4px", paddingBottom: "2px" }}>
          DESCRIPTION OF WORK
        </div>
        <div>{ticket.description}</div>
      </div>

      {/* Priority assessment */}
      <div style={{ marginBottom: "12px" }}>
        <div style={{ fontWeight: "bold", borderBottom: "1px solid #000", marginBottom: "4px", paddingBottom: "2px" }}>
          PRIORITY ASSESSMENT
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ padding: "2px 0", width: "25%" }}>Safety Risk: {ticket.safetyRisk}/5</td>
              <td style={{ padding: "2px 0", width: "25%" }}>Operational Impact: {ticket.operationalImpact}/5</td>
              <td style={{ padding: "2px 0", width: "25%" }}>Urgency: {ticket.urgency}/5</td>
              <td style={{ padding: "2px 0", width: "25%" }}>People Affected: {ticket.peopleAffected}/5</td>
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: "4px", fontWeight: "bold" }}>
          Computed Priority Score: {ticket.priorityScore} / 100
        </div>
      </div>

      {/* Itemized budget requisition, only if items exist */}
      {ticket.budgetItems && ticket.budgetItems.length > 0 && (
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontWeight: "bold", borderBottom: "1px solid #000", marginBottom: "4px", paddingBottom: "2px" }}>
            BUDGET REQUISITION — ITEMIZED MATERIALS
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000" }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #000", padding: "3px", textAlign: "left" }}>Item No.</th>
                <th style={{ border: "1px solid #000", padding: "3px", textAlign: "left" }}>Qty</th>
                <th style={{ border: "1px solid #000", padding: "3px", textAlign: "left" }}>Unit</th>
                <th style={{ border: "1px solid #000", padding: "3px", textAlign: "left" }}>Description</th>
                <th style={{ border: "1px solid #000", padding: "3px", textAlign: "right" }}>Unit Cost</th>
                <th style={{ border: "1px solid #000", padding: "3px", textAlign: "right" }}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {ticket.budgetItems.map((item) => (
                <tr key={item.id}>
                  <td style={{ border: "1px solid #000", padding: "3px" }}>{item.itemNo}</td>
                  <td style={{ border: "1px solid #000", padding: "3px" }}>{item.qty}</td>
                  <td style={{ border: "1px solid #000", padding: "3px" }}>{item.unit || "—"}</td>
                  <td style={{ border: "1px solid #000", padding: "3px" }}>{item.description}</td>
                  <td style={{ border: "1px solid #000", padding: "3px", textAlign: "right" }}>{formatPeso(item.unitCost)}</td>
                  <td style={{ border: "1px solid #000", padding: "3px", textAlign: "right" }}>{formatPeso(item.cost)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} style={{ border: "1px solid #000", padding: "3px", textAlign: "right", fontWeight: "bold" }}>
                  TOTAL
                </td>
                <td style={{ border: "1px solid #000", padding: "3px", textAlign: "right", fontWeight: "bold" }}>
                  {formatPeso(ticket.budgetItemsTotal ?? 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Cost summary */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "12px" }}>
        <tbody>
          <tr>
            <td style={{ padding: "3px 0", fontWeight: "bold", width: "25%" }}>Estimated Cost:</td>
            <td style={{ padding: "3px 0", width: "25%" }}>
              {ticket.estimatedCost !== undefined ? formatPeso(ticket.estimatedCost) : "—"}
            </td>
            <td style={{ padding: "3px 0", fontWeight: "bold", width: "25%" }}>Approved Amount:</td>
            <td style={{ padding: "3px 0", width: "25%" }}>
              {ticket.approvedAmount !== undefined ? formatPeso(ticket.approvedAmount) : "—"}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Notes */}
      {ticket.notes && (
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontWeight: "bold", borderBottom: "1px solid #000", marginBottom: "4px", paddingBottom: "2px" }}>
            NOTES
          </div>
          <div>{ticket.notes}</div>
        </div>
      )}
      {ticket.financeNotes && (
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontWeight: "bold", borderBottom: "1px solid #000", marginBottom: "4px", paddingBottom: "2px" }}>
            FINANCE NOTES
          </div>
          <div>{ticket.financeNotes}</div>
        </div>
      )}

      <div style={{ textAlign: "center", fontStyle: "italic", margin: "16px 0", fontSize: "11px" }}>
        ***** Nothing Follows *****
      </div>

      {/* Signature blocks */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "40px" }}>
        <tbody>
          <tr>
            <td style={{ width: "33%", textAlign: "center", verticalAlign: "bottom" }}>
              <div style={{ borderTop: "1px solid #000", margin: "0 12px", paddingTop: "4px" }}>
                Physical Plant Officer
                <br />
                {ticket.ppoApproved ? "(Verified & Approved)" : "(Pending)"}
              </div>
            </td>
            <td style={{ width: "33%", textAlign: "center", verticalAlign: "bottom" }}>
              <div style={{ borderTop: "1px solid #000", margin: "0 12px", paddingTop: "4px" }}>
                School Head / President
                <br />
                {ticket.schoolHeadApproved ? "(Endorsed)" : "(Pending)"}
              </div>
            </td>
            <td style={{ width: "33%", textAlign: "center", verticalAlign: "bottom" }}>
              <div style={{ borderTop: "1px solid #000", margin: "0 12px", paddingTop: "4px" }}>
                Finance Officer
                <br />
                {ticket.financeApproved ? "(Funded)" : "(Pending)"}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: "24px", fontSize: "9px", textAlign: "center", color: "#555" }}>
        Printed from JORS COSCA — Smart Job Order Request and Status Monitoring System — {new Date().toLocaleString()}
      </div>
    </div>
  );
};
