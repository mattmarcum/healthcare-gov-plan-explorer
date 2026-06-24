import type { AmountEntry, AppContext, CostSharing, RawPlan, SbcScenario } from "./types";

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
  // Headline benefit cost-sharing, as the API's own display strings.
  pcp: string;
  specialist: string;
  er: string;
  generic_drug: string;
  specialist_referral: boolean;
  // SBC coverage-example totals (only populated from per-plan detail).
  sbc_baby: number | null;
  sbc_diabetes: number | null;
  sbc_fracture: number | null;
  hsa_eligible: boolean;
  quality_rating: number | null;
  plan_url: string; // deep link to the plan's page on healthcare.gov
  benefits_url: string; // Summary of Benefits & Coverage PDF
  formulary_url: string; // drug list
  network_url: string; // provider finder
}

export type CostExamples = Pick<PlanRow, "sbc_baby" | "sbc_diabetes" | "sbc_fracture">;

/** Deep link to a plan's page in the user's own enrollment flow on healthcare.gov. */
export function planPageUrl(ctx: AppContext, planId: string): string {
  if (!ctx.enrollmentGroupId) return "";
  const base = "https://www.healthcare.gov/marketplace/auth/enroll/consumers/";
  const hash = `#/enrollment-group/${ctx.enrollmentGroupType}/${ctx.enrollmentGroupId}/plans/${planId}`;
  return `${base}?a=${ctx.appId}&cache=true&t=${ctx.tenant}${hash}`;
}

// The household's Advance Premium Tax Credit code is the short form ("CSR94");
// the plan's per-amount/per-benefit entries use the long form
// ("94% AV Level Silver Plan CSR"). The shared link is the AV percentage.
function csrAv(csrOverride?: string): string | null {
  const m = csrOverride?.match(/(\d+)/);
  return m ? m[1] : null;
}

// Pick the In-Network entries that apply at the household's CSR level. Silver
// CSR plans expose a CSR-specific variant (what the household actually pays);
// everything else falls back to the base "Exchange variant (no CSR)".
function inNetworkForCsr<T extends { network_tier: string; csr: string }>(
  items: T[] | undefined,
  av: string | null,
): T[] {
  if (!items?.length) return [];
  const inNet = items.filter((i) => i.network_tier === "In-Network");
  if (!inNet.length) return items;
  if (av) {
    const csrMatch = inNet.filter((i) => i.csr.includes(`${av}% AV`));
    if (csrMatch.length) return csrMatch;
  }
  const base = inNet.filter((i) => i.csr === "Exchange variant (no CSR)");
  return base.length ? base : inNet;
}

function deductibleFor(p: RawPlan, av: string | null): number | null {
  const sel = inNetworkForCsr(p.deductibles, av);
  if (!sel.length) return null;
  // A "Combined Medical and Drug" entry already totals both; otherwise sum the
  // separate medical + drug deductibles into one comparable number.
  const combined = sel.find((d: AmountEntry) => /combined/i.test(d.type));
  return combined ? combined.amount : sel.reduce((sum, d) => sum + (d.amount || 0), 0);
}

function moopFor(p: RawPlan, av: string | null): number | null {
  const sel = inNetworkForCsr(p.moops, av);
  if (!sel.length) return null;
  const total = sel.find((m: AmountEntry) => /total/i.test(m.type)) ?? sel[0];
  return total.amount;
}

function benefitDisplay(p: RawPlan, type: string, av: string | null): string {
  const b = p.benefits?.find((x) => x.type === type);
  if (!b?.cost_sharings?.length) return "";
  const sel = inNetworkForCsr<CostSharing>(b.cost_sharings, av);
  return (sel[0] ?? b.cost_sharings[0]).display_string ?? "";
}

// The SBC coverage example shows what the patient pays; sum the components.
function sbcTotal(s?: SbcScenario): number | null {
  if (!s) return null;
  return (s.coinsurance || 0) + (s.copay || 0) + (s.deductible || 0) + (s.limit || 0);
}

export function costExamples(p: RawPlan): CostExamples {
  return {
    sbc_baby: sbcTotal(p.sbcs?.baby),
    sbc_diabetes: sbcTotal(p.sbcs?.diabetes),
    sbc_fracture: sbcTotal(p.sbcs?.fracture),
  };
}

export function toRow(p: RawPlan, ctx: AppContext): PlanRow {
  const av = csrAv(ctx.search.csr_override);
  return {
    id: p.id,
    name: p.name,
    issuer: p.issuer?.name ?? "",
    metal: p.metal_level,
    type: p.type,
    premium: p.premium,
    premium_w_credit: p.premium_w_credit,
    deductible: deductibleFor(p, av),
    moop: moopFor(p, av),
    oopc: p.oopc ?? null,
    pcp: benefitDisplay(p, "PRIMARY_CARE_VISIT_TO_TREAT_AN_INJURY_OR_ILLNESS", av),
    specialist: benefitDisplay(p, "SPECIALIST_VISIT", av),
    er: benefitDisplay(p, "EMERGENCY_ROOM_SERVICES", av),
    generic_drug: benefitDisplay(p, "GENERIC_DRUGS", av),
    specialist_referral: !!p.specialist_referral_required,
    ...costExamples(p),
    hsa_eligible: !!p.hsa_eligible,
    quality_rating: p.quality_rating?.global_rating ?? null,
    plan_url: planPageUrl(ctx, p.id),
    benefits_url: p.benefits_url ?? "",
    formulary_url: p.formulary_url ?? "",
    network_url: p.network_url ?? "",
  };
}
