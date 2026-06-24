import type { AppContext, RawPlan } from "./types";

/** One spreadsheet row — the flat view of a deeply nested plan object. */
export interface PlanRow {
  id: string;
  name: string;
  issuer: string;
  metal: string;
  type: string;
  premium: number;
  premium_w_credit: number;
  deductible: number | null;
  moop: number | null;
  oopc: number | null;
  hsa_eligible: boolean;
  quality_rating: number | null;
  plan_url: string; // deep link to the plan's page on healthcare.gov
  benefits_url: string; // the plan's Summary of Benefits & Coverage PDF
}

/** Deep link to a plan's page in the user's own enrollment flow on healthcare.gov. */
export function planPageUrl(ctx: AppContext, planId: string): string {
  if (!ctx.enrollmentGroupId) return "";
  const base = "https://www.healthcare.gov/marketplace/auth/enroll/consumers/";
  const hash = `#/enrollment-group/${ctx.enrollmentGroupType}/${ctx.enrollmentGroupId}/plans/${planId}`;
  return `${base}?a=${ctx.appId}&cache=true&t=${ctx.tenant}${hash}`;
}

// Plans carry several deductible/MOOP entries (per network tier, per CSR
// variant). We surface the In-Network amount, which is what the household
// actually pays given their CSR.
function inNetworkAmount(items?: Array<{ amount: number; network_tier: string }>): number | null {
  if (!items?.length) return null;
  return (items.find((i) => i.network_tier === "In-Network") ?? items[0]).amount;
}

export function toRow(p: RawPlan, ctx: AppContext): PlanRow {
  return {
    id: p.id,
    name: p.name,
    issuer: p.issuer?.name ?? "",
    metal: p.metal_level,
    type: p.type,
    premium: p.premium,
    premium_w_credit: p.premium_w_credit,
    deductible: inNetworkAmount(p.deductibles),
    moop: inNetworkAmount(p.moops),
    oopc: p.oopc ?? null,
    hsa_eligible: !!p.hsa_eligible,
    quality_rating: p.quality_rating?.global_rating ?? null,
    plan_url: planPageUrl(ctx, p.id),
    benefits_url: p.benefits_url ?? "",
  };
}
