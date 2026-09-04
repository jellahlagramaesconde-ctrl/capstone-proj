import React, { useState, useEffect } from "react";
import { BudgetItem } from "../types";
import { formatPeso } from "../priceUtils";
import { Plus, Trash2, Save, Receipt } from "lucide-react";

interface DraftRow {
  qty: string;
  unit: string;
  description: string;
  unitCost: string;
}

interface BudgetRequisitionItemsProps {
  items: BudgetItem[];
  total: number;
  /** True only for the PPO — everyone else (Finance, President) gets a
   * read-only view of the same data. */
  editable: boolean;
  /** Omit (or pass undefined) to force read-only rendering even when
   * `editable` is true, e.g. while a save is already in flight. */
  onSave?: (items: { qty: number; unit?: string; description: string; unitCost: number }[]) => Promise<void>;
}

const blankRow = (): DraftRow => ({ qty: "1", unit: "pcs.", description: "", unitCost: "" });

const toDraftRows = (items: BudgetItem[]): DraftRow[] =>
  items.length > 0
    ? items.map((it) => ({
      qty: String(it.qty),
      unit: it.unit || "",
      description: it.description,
      unitCost: String(it.unitCost),
    }))
    : [blankRow()];

// Mirrors the PPO's paper "Budget Requisition Form" (item no. / qty / unit /
// description / unit cost / cost) as a live, editable table. PPO can add,
// edit, and remove rows and save the whole list in one go; Finance/President
// see the exact same layout but read-only, right above their approve action.
export const BudgetRequisitionItems: React.FC<BudgetRequisitionItemsProps> = ({
  items,
  total,
  editable,
  onSave,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [rows, setRows] = useState<DraftRow[]>(toDraftRows(items));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync draft rows whenever the underlying ticket data changes (e.g.
  // after a save, or when a different ticket is opened) — but not while
  // the PPO is actively mid-edit, so a background refresh never clobbers
  // what they're typing.
  useEffect(() => {
    if (!isEditing) setRows(toDraftRows(items));
  }, [items, isEditing]);

  const draftTotal = rows.reduce((sum, r) => {
    const q = Number(r.qty) || 0;
    const c = Number(r.unitCost) || 0;
    return sum + q * c;
  }, 0);

  const updateRow = (index: number, field: keyof DraftRow, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, blankRow()]);

  const removeRow = (index: number) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const startEditing = () => {
    setRows(toDraftRows(items));
    setError(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setRows(toDraftRows(items));
    setError(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    setError(null);
    const cleaned = rows
      .filter((r) => r.description.trim())
      .map((r) => ({
        qty: Number(r.qty),
        unit: r.unit.trim() || undefined,
        description: r.description.trim(),
        unitCost: Number(r.unitCost),
      }));

    if (cleaned.length === 0) {
      setError("Add at least one item with a description.");
      return;
    }
    for (const item of cleaned) {
      if (!Number.isFinite(item.qty) || item.qty <= 0) {
        setError(`"${item.description}": quantity must be a positive number.`);
        return;
      }
      if (!Number.isFinite(item.unitCost) || item.unitCost < 0) {
        setError(`"${item.description}": unit cost must be zero or a positive number.`);
        return;
      }
    }

    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(cleaned);
      setIsEditing(false);
    } catch (err: any) {
      setError(err?.message || "Failed to save the budget requisition.");
    } finally {
      setIsSaving(false);
    }
  };

  const showEmptyState = items.length === 0 && !isEditing;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono tracking-widest text-slate-600 uppercase font-bold flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5" />
          Budget Requisition — Itemized Materials
        </span>
        {editable && !isEditing && (
          <button
            onClick={startEditing}
            className="text-xs font-mono font-bold text-[#6B1420] hover:underline cursor-pointer"
          >
            {items.length > 0 ? "Edit Items" : "+ Add Items"}
          </button>
        )}
      </div>

      {showEmptyState ? (
        <div className="border border-dashed border-[#E6DDD3] rounded-lg p-4 text-center text-sm text-slate-500 italic bg-[#F5F1EC]/40">
          No itemized budget requisition yet.
        </div>
      ) : (
        <div className="border border-[#E6DDD3] rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#F5F1EC] text-slate-600 font-mono uppercase tracking-wider">
                <th className="text-left font-bold px-2.5 py-2 w-10">#</th>
                <th className="text-left font-bold px-2.5 py-2 w-16">Qty</th>
                <th className="text-left font-bold px-2.5 py-2 w-20">Unit</th>
                <th className="text-left font-bold px-2.5 py-2">Description</th>
                <th className="text-right font-bold px-2.5 py-2 w-24">Unit Cost</th>
                <th className="text-right font-bold px-2.5 py-2 w-24">Cost</th>
                {isEditing && <th className="w-8" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6DDD3]">
              {isEditing
                ? rows.map((row, i) => (
                  <tr key={i}>
                    <td className="px-2.5 py-1.5 text-slate-500 font-mono">{i + 1}</td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={row.qty}
                        onChange={(e) => updateRow(i, "qty", e.target.value)}
                        className="w-full bg-white border border-[#E6DDD3] rounded px-1.5 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#6B1420]"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        placeholder="pcs."
                        value={row.unit}
                        onChange={(e) => updateRow(i, "unit", e.target.value)}
                        className="w-full bg-white border border-[#E6DDD3] rounded px-1.5 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#6B1420]"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        placeholder="e.g. Angle Valve Double 1/2x1/2"
                        value={row.description}
                        onChange={(e) => updateRow(i, "description", e.target.value)}
                        className="w-full bg-white border border-[#E6DDD3] rounded px-1.5 py-1 text-xs font-sans focus:outline-none focus:ring-1 focus:ring-[#6B1420]"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        placeholder="0"
                        value={row.unitCost}
                        onChange={(e) => updateRow(i, "unitCost", e.target.value)}
                        className="w-full bg-white border border-[#E6DDD3] rounded px-1.5 py-1 text-xs font-mono text-right focus:outline-none focus:ring-1 focus:ring-[#6B1420]"
                      />
                    </td>
                    <td className="px-2.5 py-1.5 text-right font-mono text-slate-700">
                      {formatPeso((Number(row.qty) || 0) * (Number(row.unitCost) || 0))}
                    </td>
                    <td className="px-1 py-1.5 text-center">
                      <button
                        onClick={() => removeRow(i)}
                        disabled={rows.length <= 1}
                        className="text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
                : items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-2.5 py-1.5 text-slate-500 font-mono">{item.itemNo}</td>
                    <td className="px-2.5 py-1.5 font-mono text-slate-700">{item.qty}</td>
                    <td className="px-2.5 py-1.5 font-mono text-slate-700">{item.unit || "—"}</td>
                    <td className="px-2.5 py-1.5 text-[#2B1210] font-sans">{item.description}</td>
                    <td className="px-2.5 py-1.5 text-right font-mono text-slate-700">{formatPeso(item.unitCost)}</td>
                    <td className="px-2.5 py-1.5 text-right font-mono font-semibold text-[#2B1210]">{formatPeso(item.cost)}</td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#F5F1EC] border-t border-[#E6DDD3]">
                <td colSpan={isEditing ? 4 : 3} />
                <td className="px-2.5 py-2 text-right font-mono font-bold text-slate-600 uppercase text-[11px]" colSpan={isEditing ? 1 : 2}>
                  Total
                </td>
                <td className="px-2.5 py-2 text-right font-mono font-bold text-[#6B1420]">
                  {formatPeso(isEditing ? draftTotal : total)}
                </td>
                {isEditing && <td />}
              </tr>
            </tfoot>
          </table>

          {isEditing && (
            <div className="p-2.5 border-t border-[#E6DDD3] bg-white flex flex-col gap-2">
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={addRow}
                  className="flex items-center gap-1 text-xs font-mono font-bold text-[#6B1420] hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={cancelEditing}
                    disabled={isSaving}
                    className="h-8 px-3 rounded-lg bg-white border border-[#E6DDD3] text-xs font-mono text-slate-600 hover:bg-[#F0EAE4] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#6B1420] text-white text-xs font-mono font-bold hover:bg-[#7D1A28] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isSaving ? "Saving..." : "Save Budget Requisition"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
