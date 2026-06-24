import type { PlanRow } from "./flatten";

const COLUMNS: (keyof PlanRow)[] = [
  "id", "name", "issuer", "metal", "type",
  "premium", "premium_w_credit", "deductible", "moop", "oopc",
  "hsa_eligible", "quality_rating", "plan_url", "benefits_url",
];

function escape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: PlanRow[]): string {
  const lines = rows.map((r) => COLUMNS.map((c) => escape(r[c])).join(","));
  return [COLUMNS.join(","), ...lines].join("\n");
}

export function downloadCsv(rows: PlanRow[], filename = "healthcare-plans.csv"): void {
  const blob = new Blob([toCsv(rows)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
