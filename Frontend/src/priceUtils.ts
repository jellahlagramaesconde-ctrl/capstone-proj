import { JobOrder } from "./types";

/**
 * Returns the best available cost figure for a job order:
 *   1. Finance-approved amount (final costing)
 *   2. PPO-estimated cost (first approver estimate)
 *   3. undefined (when awaiting PPO evaluation - no cost yet)
 */
export const getJobOrderCost = (ticket: JobOrder): number | undefined => {
  if (ticket.approvedAmount !== undefined && ticket.approvedAmount !== null) return ticket.approvedAmount;
  if (ticket.estimatedCost !== undefined && ticket.estimatedCost !== null) return ticket.estimatedCost;
  return undefined;
};

/** True when the cost has been estimated by PPO or finalized by Finance. */
export const hasConfirmedCost = (ticket: JobOrder): boolean =>
  (ticket.approvedAmount !== undefined && ticket.approvedAmount !== null) ||
  (ticket.estimatedCost !== undefined && ticket.estimatedCost !== null);

/** Formats a number as Philippine Peso, e.g. 4500 -> "₱4,500". */
export const formatPeso = (value: number): string =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);

/** Formats a ticket's cost with its status (Final, Estimated, or Pending Estimate). */
export const getJobOrderCostDisplay = (ticket: JobOrder): {
  text: string;
  status: "pending" | "estimated" | "final";
  label: string;
  badgeClass: string;
} => {
  if (ticket.approvedAmount !== undefined && ticket.approvedAmount !== null) {
    return {
      text: formatPeso(ticket.approvedAmount),
      status: "final",
      label: "FINAL COST",
      badgeClass: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 font-bold",
    };
  }
  if (ticket.estimatedCost !== undefined && ticket.estimatedCost !== null) {
    return {
      text: `${formatPeso(ticket.estimatedCost)}`,
      status: "estimated",
      label: "ESTIMATED COST (NOT FINAL)",
      badgeClass: "bg-amber-500/10 text-amber-700 border-amber-500/20 font-medium",
    };
  }
  return {
    text: "Pending Estimate",
    status: "pending",
    label: "AWAITING PPO ESTIMATE",
    badgeClass: "bg-gray-100 text-gray-500 border-gray-200 italic",
  };
};

/** Sums confirmed job order costs across a list of tickets. */
export const sumJobOrderCosts = (tickets: JobOrder[]): number =>
  tickets.reduce((sum, t) => sum + (getJobOrderCost(t) ?? 0), 0);