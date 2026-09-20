import React from "react";
import { JobOrder } from "../types";

interface PrintableJobOrderProps {
  ticket: JobOrder;
}

// Matches the official COSCA physical Budget Requisition Form exactly:
//   Diocese of Dumaguete letterhead → BUDGET REQUISITION FORM →
//   itemized materials table → Nothing Follows → signature blocks
//   (Requested by: PPO | Noted by: VP-Admin & Finance | Approved by: School President)
export const PrintableJobOrder: React.FC<PrintableJobOrderProps> = ({ ticket }) => {
  const submitted = ticket.dateSubmitted ? new Date(ticket.dateSubmitted) : null;
  const dateStr = submitted
    ? submitted.toLocaleDateString("en-PH", { day: "2-digit", month: "short", year: "2-digit" }).replace(/ /g, "-")
    : "—";

  const items = ticket.budgetItems ?? [];
  const total = ticket.budgetItemsTotal ?? items.reduce((s, i) => s + i.cost, 0);

  // Pad to at least 8 rows so the table always looks like the physical form
  const MIN_ROWS = 8;
  const paddedItems = [
    ...items,
    ...Array(Math.max(0, MIN_ROWS - items.length)).fill(null),
  ];

  const cell: React.CSSProperties = {
    border: "1px solid #000",
    padding: "3px 5px",
    fontSize: "11px",
    fontFamily: "Arial, sans-serif",
    height: "20px",
  };
  const hdr: React.CSSProperties = {
    ...cell,
    fontWeight: "bold",
    textAlign: "center",
    backgroundColor: "#f0f0f0",
  };

  return (
    <div
      className="print-only"
      style={{
        color: "#000",
        background: "#fff",
        padding: "0.55in 0.65in",
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        width: "8.5in",
        boxSizing: "border-box",
      }}
    >
      {/* ── LETTERHEAD ───────────────────────────── */}
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
              <div style={{ fontSize: "11px", marginBottom: "1px" }}>Diocese of Dumaguete</div>
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

      {/* ── FORM TITLE ───────────────────────────── */}
      <div style={{ textAlign: "center", marginBottom: "6px" }}>
        <div style={{ fontWeight: "bold", fontSize: "14px", letterSpacing: "1px" }}>
          BUDGET REQUISITION FORM
        </div>
        <div style={{ fontSize: "12px" }}>(PPO Maintenance Material)</div>
        <div style={{ fontSize: "11px", marginTop: "2px" }}>{dateStr}</div>
      </div>

      {/* ── JOB ORDER INFO LINE ──────────────────── */}
      <div style={{ fontSize: "11px", marginBottom: "4px" }}>
        <strong>Ticket No.:</strong> {ticket.id}
        &nbsp;&nbsp;&nbsp;
        <strong>Office/Dept.:</strong> {ticket.office}
        &nbsp;&nbsp;&nbsp;
        <strong>Type:</strong> {ticket.jobType}
        {ticket.isEmergency && <strong style={{ marginLeft: "8px" }}>🚨 EMERGENCY</strong>}
      </div>

      <div style={{ fontSize: "11px", marginBottom: "8px" }}>
        <strong>Description of Work:</strong> {ticket.description}
      </div>

      {/* Purchase note (mirrors physical form sub-heading) */}
      <div style={{ fontWeight: "bold", fontSize: "11px", marginBottom: "3px" }}>
        Purchase for Maintenance Works.
      </div>

      {/* ── ITEMIZED TABLE ───────────────────────── */}
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
                  ? `₱ ${item.unitCost.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                  : <span style={{ color: "#ccc" }}>₱</span>}
              </td>
              <td style={{ ...cell, textAlign: "right" }}>
                {item
                  ? `₱ ${item.cost.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                  : <span style={{ color: "#ccc" }}>₱</span>}
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
                ? `₱ ${total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                : <span style={{ color: "#ccc" }}>₱</span>}
            </td>
          </tr>
          <tr>
            <td colSpan={6} style={{ ...cell, textAlign: "center", fontStyle: "italic", fontSize: "11px" }}>
              ***** Nothing Follows *****
            </td>
          </tr>
          <tr>
            <td colSpan={6} style={{ ...cell, textAlign: "center", fontSize: "11px" }}>
              Note: For Maintenance works.
            </td>
          </tr>
        </tfoot>
      </table>

      {/* ── SIGNATURE BLOCKS ─────────────────────────
          Layout mirrors the physical form:
          Left:  "Requested by:"  — PPO (Physical Plant Officer)
          Right: "Noted by:"      — VP-Admin and Finance
          Left:  "Approved by:"   — School President
      ──────────────────────────────────────────── */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "30px", fontSize: "11px" }}>
        <tbody>
          {/* Labels row */}
          <tr>
            <td style={{ width: "50%", paddingBottom: "34px", verticalAlign: "bottom" }}>
              <em>Requested by:</em>
            </td>
            <td style={{ width: "50%", paddingBottom: "34px", verticalAlign: "bottom" }}>
              <em>Noted by:</em>
            </td>
          </tr>
          {/* PPO sig / VP-Finance sig */}
          <tr>
            <td style={{ verticalAlign: "top", paddingRight: "60px" }}>
              <div style={{ borderTop: "1px solid #000", paddingTop: "4px" }}>
                <div style={{ fontWeight: "bold", textTransform: "uppercase", fontSize: "11px" }}>
                  Physical Plant Officer
                </div>
                <div style={{ fontSize: "10px", color: "#444" }}>Physical Plant Office</div>
                {ticket.ppoApproved && (
                  <div style={{ fontSize: "10px", color: "#000", marginTop: "2px" }}>✓ Verified &amp; Approved</div>
                )}
              </div>
            </td>
            <td style={{ verticalAlign: "top" }}>
              <div style={{ borderTop: "1px solid #000", paddingTop: "4px" }}>
                <div style={{ fontWeight: "bold", textTransform: "uppercase", fontSize: "11px" }}>
                  VP-Admin and Finance
                </div>
                <div style={{ fontSize: "10px", color: "#444" }}>Finance Department Head</div>
                {ticket.financeApproved && (
                  <div style={{ fontSize: "10px", color: "#000", marginTop: "2px" }}>✓ Funding Released</div>
                )}
              </div>
            </td>
          </tr>
          {/* Approved by label */}
          <tr>
            <td style={{ paddingTop: "30px", paddingBottom: "34px", verticalAlign: "bottom" }}>
              <em>Approved by:</em>
            </td>
            <td />
          </tr>
          {/* School President sig */}
          <tr>
            <td style={{ verticalAlign: "top", paddingRight: "60px" }}>
              <div style={{ borderTop: "1px solid #000", paddingTop: "4px" }}>
                <div style={{ fontWeight: "bold", textTransform: "uppercase", fontSize: "11px" }}>
                  School President
                </div>
                <div style={{ fontSize: "10px", color: "#444" }}>School Directress / President</div>
                {ticket.schoolHeadApproved && (
                  <div style={{ fontSize: "10px", color: "#000", marginTop: "2px" }}>✓ Endorsed</div>
                )}
              </div>
            </td>
            <td />
          </tr>
        </tbody>
      </table>

      {/* ── FOOTER ───────────────────────────────── */}
      <div style={{
        marginTop: "18px", fontSize: "9px", textAlign: "center",
        color: "#888", borderTop: "1px solid #ccc", paddingTop: "4px",
      }}>
        Generated by JORS COSCA — Job Order Request System — Printed {new Date().toLocaleString("en-PH")}
        &nbsp;|&nbsp; Ticket: {ticket.id} &nbsp;|&nbsp; Priority Score: {ticket.priorityScore}/100
      </div>
    </div>
  );
};

