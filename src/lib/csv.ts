import type { PlanRow } from "./flatten";

// Full column order used when no explicit selection is passed.
const DEFAULT_COLUMNS: (keyof PlanRow)[] = [
  "id", "name", "issuer", "metal", "type",
  "premium", "premium_w_credit", "deductible", "moop", "oopc",
  "pcp", "specialist", "er", "generic_drug", "specialist_referral",
  "sbc_baby", "sbc_diabetes", "sbc_fracture",
  "hsa_eligible", "quality_rating",
  "plan_url", "benefits_url", "formulary_url", "network_url",
];

function escape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: PlanRow[], columns: (keyof PlanRow)[] = DEFAULT_COLUMNS): string {
  const lines = rows.map((r) => columns.map((c) => escape(r[c])).join(","));
  return [columns.join(","), ...lines].join("\n");
}

export function downloadCsv(
  rows: PlanRow[],
  columns?: (keyof PlanRow)[],
  filename = "healthcare-plans.csv",
): void {
  const blob = new Blob([toCsv(rows, columns)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
