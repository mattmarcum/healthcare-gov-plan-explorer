import type { AppContext, Person, SearchParams } from "./types";

// The SPA lives under this path; all three bootstrap endpoints are relative to it.
const CONSUMER_BASE = "/marketplace/auth/enroll/consumers";

/**
 * Reverse-engineers the plan-search parameters from the user's in-progress
 * application. The content script runs on the same origin and reuses the
 * logged-in session cookies, so these calls succeed without any extra auth.
 *
 * Flow (each call's response feeds the next):
 *   1. appinfo   -> appConfig.marketplaceAPI (the public API base URL)
 *   2. ffm/get   -> enrollees, effective_date, year, maxAPTC, CSR, catastrophic
 *   3. enrollment/{appId} -> per-member utilization level (oopc map)
 */
export async function getAppContext(): Promise<AppContext> {
  const { appId, tenant } = getUrlParams();

  const appInfo = await getJson(`${CONSUMER_BASE}/appinfo/?a=${appId}&cache=true&t=${tenant}`);
  const apiBase = appInfo?.appConfig?.marketplaceAPI;
  if (!apiBase) throw new Error("Could not read marketplace API base from appinfo");

  const ffm = await getJson(`${CONSUMER_BASE}/ffm/get?app_id=${appId}&tenant=${tenant}&force=false`);
  const enr = ffm?.enrollment;
  if (!enr?.enrollees?.length) throw new Error("No enrollees found on this application");

  const enrollment = await getJson(`${CONSUMER_BASE}/enrollment/${appId}`);
  const oopc: Record<string, string> = enrollment?.enrollment?.oopc ?? {};

  // The enrollment-group id is what the SPA puts in its URL hash to deep-link a
  // plan. The page hash is the most authoritative source when present; otherwise
  // fall back to the key of `compPlans` (the group the user is comparing).
  const compPlans: Record<string, unknown> = enrollment?.enrollment?.compPlans ?? {};
  const hashGroup = location.hash.match(/enrollment-group\/([^/]+)\/([0-9a-f-]{36})/i);
  const enrollmentGroupType = hashGroup?.[1] ?? "Health";
  const enrollmentGroupId = hashGroup?.[2] ?? Object.keys(compPlans)[0] ?? "";

  const people: Person[] = enr.enrollees.map((e: any) => ({
    aptc_eligible: !!e.aptc_eligible,
    dob: String(e.dob ?? "").slice(0, 10),
    does_not_cohabitate: false,
    gender: e.gender,
    relationship: e.relationship || "Self",
    // utilization drives the estimated out-of-pocket-cost (OOPC) figure.
    utilization_level: (oopc[e.id] as Person["utilization_level"]) || "Medium",
  }));

  const first = enr.enrollees[0];
  const search: SearchParams = {
    household: { people, effective_date: enr.effective_date },
    place: {
      zipcode: first.location.zipcode,
      extended_zipcode: first.location.extended_zipcode || first.location.zipcode,
      countyfips: first.location.countyfips,
      state: first.location.state,
    },
    market: "Individual",
    year: enr.year,
    aptc_override: enr.maxAPTC,
    csr_override: first.csr || undefined, // ffm gives the short code, e.g. "CSR94"
    catastrophic_override: !!enr.allow_catastrophic,
  };

  return { apiBase, year: enr.year, search, appId, tenant, enrollmentGroupId, enrollmentGroupType };
}

function getUrlParams(): { appId: string; tenant: string } {
  const u = new URL(location.href);
  const appId = u.searchParams.get("a");
  const tenant = u.searchParams.get("t");
  if (!appId || !tenant) {
    throw new Error("Open this on a HealthCare.gov enrollment page (URL needs ?a=<appId> and ?t=<state>)");
  }
  return { appId, tenant };
}

async function getJson(path: string): Promise<any> {
  const res = await fetch(path, { headers: { accept: "application/json" }, credentials: "include" });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json();
}
