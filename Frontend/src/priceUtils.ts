import { JobOrder } from "./types";

export const getJobOrderCost = (ticket: JobOrder): number | undefined => {
  if (ticket.approvedAmount !== undefined && ticket.approvedAmount !== null) return ticket.approvedAmount;
  if (ticket.estimatedCost !== undefined && ticket.estimatedCost !== null) return ticket.estimatedCost;
  return undefined;
};

export const hasConfirmedCost = (ticket: JobOrder): boolean =>
  (ticket.approvedAmount !== undefined && ticket.approvedAmount !== null) ||
  (ticket.estimatedCost !== undefined && ticket.estimatedCost !== null);

export const formatPeso = (value: number): string =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);

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

export const sumJobOrderCosts = (tickets: JobOrder[]): number =>
  tickets.reduce((sum, t) => sum + (getJobOrderCost(t) ?? 0), 0);