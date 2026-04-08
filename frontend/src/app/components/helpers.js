// Shared helpers and constants used across all dashboard components

export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const fmt$ = (v) => {
  if (v == null || !isFinite(v)) return "$\u2014";
  return `$${Math.abs(v) < 0.01 ? v.toFixed(4) : v.toFixed(2)}`;
};

export const fmtPct = (v) => {
  if (v == null || !isFinite(v)) return "\u2014";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
};

export const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("en-US", { hour12: false }) : "\u2014";

export const PERIODS = {
  "1H":  { ms: 60 * 60 * 1000, label: "1H", useDaily: false },
  "1D":  { ms: 24 * 60 * 60 * 1000, label: "1D", useDaily: false },
  "1W":  { ms: 7 * 24 * 60 * 60 * 1000, label: "1W", useDaily: true },
  "1M":  { ms: 30 * 24 * 60 * 60 * 1000, label: "1M", useDaily: true },
  "ALL": { ms: Infinity, label: "ALL", useDaily: true },
};

export function filterByPeriod(arr, periodMs) {
  if (!arr || arr.length === 0) return [];
  if (periodMs === Infinity) return arr;
  const cutoff = Date.now() - periodMs;
  return arr.filter(d => d.t >= cutoff);
}

export function fmtDateLabel(ts, useDaily) {
  const d = new Date(ts);
  if (useDaily) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}
