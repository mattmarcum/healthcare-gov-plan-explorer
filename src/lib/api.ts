import type { PlanSearchResponse, RawPlan, SearchParams } from "./types";

// The SPA only ever requests 10 plans per page; the API itself accepts a larger
// limit and reports `total`, so we page through everything.
const PAGE_SIZE = 50;

export async function searchPlansPage(
  apiBase: string,
  params: SearchParams,
  offset: number,
  limit = PAGE_SIZE,
): Promise<PlanSearchResponse> {
  const body = {
    ...params,
    filter: { division: "HealthCare", metal_design_types: [] as string[] },
    limit,
    offset,
    order: "asc",
    sort: "premium",
    suppressed_plan_ids: [] as string[],
  };

  const res = await fetch(`${apiBase}/plans/search?year=${params.year}`, {
    method: "POST",
    // The site deliberately sends text/plain so the request stays a "simple"
    // CORS request and skips the preflight. The API echoes `access-control-
    // allow-origin: *`, so this works unauthenticated from any origin.
    headers: { "content-type": "text/plain;charset=UTF-8" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`plans/search -> HTTP ${res.status}`);
  return res.json();
}

/**
 * Fetch one plan's full detail. The bulk search returns a trimmed object; the
 * per-plan endpoint adds fields like `sbcs` (the coverage-example costs). The
 * request body is just the household/place/subsidy params (no paging/filter).
 */
export async function fetchPlanDetail(
  apiBase: string,
  params: SearchParams,
  planId: string,
): Promise<RawPlan> {
  const res = await fetch(`${apiBase}/plans/${planId}?year=${params.year}`, {
    method: "POST",
    headers: { "content-type": "text/plain;charset=UTF-8" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`plans/${planId} -> HTTP ${res.status}`);
  const data = await res.json();
  return data.plan as RawPlan;
}

/** Fetch every plan for the household, paging until `total` is reached. */
export async function fetchAllPlans(
  apiBase: string,
  params: SearchParams,
  onProgress?: (loaded: number, total: number) => void,
): Promise<RawPlan[]> {
  const first = await searchPlansPage(apiBase, params, 0);
  const total = first.total ?? first.plans.length;
  const plans = [...first.plans];
  onProgress?.(plans.length, total);

  for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
    const page = await searchPlansPage(apiBase, params, offset);
    plans.push(...page.plans);
    onProgress?.(plans.length, total);
  }
  return plans;
}
