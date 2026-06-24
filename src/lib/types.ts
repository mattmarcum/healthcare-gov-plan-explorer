// Shapes for the subset of the HealthCare.gov marketplace API we depend on.
// These mirror the request/response bodies observed from the SPA's own traffic.

export type UtilizationLevel = "Low" | "Medium" | "High";

export interface Person {
  aptc_eligible: boolean;
  dob: string; // YYYY-MM-DD
  does_not_cohabitate: boolean;
  gender: "Male" | "Female";
  relationship: string; // "Self", "Spouse", "Child", ...
  utilization_level: UtilizationLevel;
}

export interface Place {
  zipcode: string;
  extended_zipcode: string;
  countyfips: string;
  state: string;
}

/** The body the /plans/search endpoint expects (minus paging/sort/filter). */
export interface SearchParams {
  household: { people: Person[]; effective_date: string };
  place: Place;
  market: string; // "Individual"
  year: number;
  aptc_override?: number; // monthly Advance Premium Tax Credit
  csr_override?: string; // Cost-Sharing Reduction code, e.g. "CSR94"
  catastrophic_override?: boolean;
}

/** Everything needed to drive the plan search, derived from the user's application. */
export interface AppContext {
  apiBase: string; // e.g. https://marketplace-int.api.healthcare.gov/api/v1
  year: number;
  search: SearchParams;
  // Identifiers needed to deep-link each plan back to its healthcare.gov page.
  appId: string;
  tenant: string; // state, e.g. "TX"
  enrollmentGroupId: string; // e.g. "eaf4d350-be89-48d1-aec6-5fe2f30c7a64"
  enrollmentGroupType: string; // "Health" | "Dental"
}

export interface PlanSearchResponse {
  plans: RawPlan[];
  total: number;
  facet_groups?: unknown[];
  ranges?: unknown;
}

export interface CostSharing {
  network_tier: string; // "In-Network" | "Out-of-Network" | "In-Network Tier 2"
  csr: string; // e.g. "94% AV Level Silver Plan CSR" | "Exchange variant (no CSR)"
  display_string: string; // e.g. "$30", "25% Coinsurance after deductible", "No Charge"
}

export interface Benefit {
  type: string; // e.g. "PRIMARY_CARE_VISIT_TO_TREAT_AN_INJURY_OR_ILLNESS"
  cost_sharings?: CostSharing[];
}

export interface AmountEntry {
  amount: number;
  network_tier: string;
  csr: string;
  type: string; // e.g. "Combined Medical and Drug EHB Deductible"
}

/** A standardized "Summary of Benefits & Coverage" cost scenario. */
export interface SbcScenario {
  coinsurance: number;
  copay: number;
  deductible: number;
  limit: number;
}

/** Loosely typed — we only read the fields we surface; the payload has far more. */
export interface RawPlan {
  id: string;
  name: string;
  metal_level: string;
  type: string;
  premium: number;
  premium_w_credit: number;
  oopc?: number;
  hsa_eligible?: boolean;
  specialist_referral_required?: boolean;
  benefits_url?: string;
  brochure_url?: string;
  formulary_url?: string;
  network_url?: string;
  issuer?: { name?: string };
  benefits?: Benefit[];
  deductibles?: AmountEntry[];
  moops?: AmountEntry[];
  // sbcs are only present on the per-plan detail endpoint, not the bulk search.
  sbcs?: { baby?: SbcScenario; diabetes?: SbcScenario; fracture?: SbcScenario };
  quality_rating?: { global_rating?: number };
}
