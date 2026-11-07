import type { Currency, Kpi } from "../types";

export const PLATFORM_LABEL: Record<string, string> = { meta: "Meta", google: "Google", tiktok: "TikTok", linkedin: "LinkedIn", multi: "Cross-channel" };

export function money(usd: number | null | undefined, currency: Currency, rate: number, compact = false): string {
  if (usd === null || usd === undefined || !Number.isFinite(usd)) return "—";
  const digits = compact ? 1 : Math.abs(usd / rate) < 100 ? 2 : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    minimumFractionDigits: compact ? 0 : digits,
    maximumFractionDigits: digits,
  }).format(usd / rate);
}

export const ratio = (v: number | null | undefined, digits = 2) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v.toFixed(digits)}x`);

export const pct = (v: number | null | undefined, digits = 1) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(digits)}%`);

export const num = (v: number | null | undefined, digits = 1) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toFixed(digits));

export const signedPct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(digits)}%`;

export function formatKpi(kpi: Kpi, value: number | null, currency: Currency, rate: number): string {
  if (kpi.format === "currency") return money(value, currency, rate, (value ?? 0) / rate >= 10000);
  if (kpi.format === "ratio") return ratio(value);
  return pct(value, 2);
}

export const LOWER_IS_BETTER = new Set(["cpa", "cpm", "frequency", "is_lost"]);

export function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
