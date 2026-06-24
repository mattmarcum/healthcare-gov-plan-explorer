# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Chrome (Manifest V3) extension that lets people compare HealthCare.gov
marketplace plans more easily. The site only shows 10 plans per page; this
extension fetches **all** of them for the user's application and renders one
sortable / filterable / CSV-exportable table.

Stack: vanilla TypeScript, bundled with esbuild into a single content script.
No framework, no runtime dependencies.

## Commands

```bash
npm install
npm run build       # bundle src/content/index.ts -> dist/content.js, copy manifest
npm run watch       # rebuild on change (does NOT re-copy manifest.json)
npm run typecheck   # tsc --noEmit (build via esbuild does not type-check)
```

Load `dist/` as an unpacked extension at `chrome://extensions` (Developer mode).
After a rebuild, click the extension's reload button there to pick up changes.

There is no test suite yet. The only way to exercise the API path is on a live,
logged-in healthcare.gov plan-results page.

## Architecture

Everything runs in **one content script** injected on
`https://www.healthcare.gov/marketplace/auth/enroll/consumers/*`. There is no
background service worker and no popup. Data flows in three stages:

1. **Bootstrap the search params** (`src/lib/session.ts`, `getAppContext`).
   The user's demographics, location, subsidy and CSR level are *not* in the
   page DOM in a usable form — they live in the application. The content script
   runs same-origin and reuses the session cookies (`credentials: "include"`)
   to read them from three endpoints, each feeding the next:
   - `consumers/appinfo/?a=<appId>&t=<state>` → `appConfig.marketplaceAPI`
     (the public plan API base URL — **read it from here, don't hardcode it**;
     it currently points at `marketplace-int.api.healthcare.gov/api/v1`).
   - `consumers/ffm/get?app_id=<appId>&tenant=<state>` → `enrollment` with
     `enrollees` (dob, gender, relationship, location, csr, aptc_eligible),
     `effective_date`, `year`, `maxAPTC`, `allow_catastrophic`.
   - `consumers/enrollment/<appId>` → `enrollment.oopc`, a per-member-id map of
     utilization level (`"Low" | "Medium" | "High"`) used in the cost estimate.

   `appId` and `tenant` come from the page URL query params `a` and `t`.

2. **Fetch all plans** (`src/lib/api.ts`, `fetchAllPlans`). Pages through
   `POST <apiBase>/plans/search?year=<year>` using the response's `total`. The
   SPA hardcodes `limit: 10`; we use 50 and loop `offset` until done.

   For the SBC coverage-example costs (childbirth/diabetes/fracture), the bulk
   search response is **not** enough — those live only on the per-plan detail
   endpoint (`POST <apiBase>/plans/<id>`). `fetchPlanDetail` pulls one plan; the
   panel's "Load cost examples" button runs it across all plans with a small
   concurrency pool (`makeEnrich`/`pool` in `index.ts`) on demand.

3. **Render** (`src/content/panel.ts`). `flatten.ts` reduces each deeply nested
   plan to a flat `PlanRow`; the panel draws a table inside a **shadow root**
   (so the host page's CSS can't bleed in) with click-to-sort headers, a text
   filter, a **Columns** dropdown (visible set persisted in `localStorage` under
   `hgpe.visibleColumns`), and CSV export of the visible columns (`src/lib/csv.ts`).

`src/content/index.ts` ties it together: injects the floating launch button,
runs the pipeline on click, and re-adds the button via a `MutationObserver`
because the site is an SPA that swaps views and can remove it.

## API specifics worth knowing (reverse-engineered, undocumented)

- **The plan search API needs no auth.** `POST .../api/v1/plans/search`
  responds with `access-control-allow-origin: *` and reads everything it needs
  from the request body. Only the `consumers/*` bootstrap endpoints (stage 1)
  require the logged-in session.
- **Requests are sent as `content-type: text/plain;charset=UTF-8`** even though
  the body is JSON. This is deliberate: it keeps the request a "simple" CORS
  request and avoids an OPTIONS preflight. Keep doing this for any POST to the
  marketplace API; don't switch to `application/json`.
- **The search body carries household identity.** `aptc_override` (monthly
  APTC, e.g. 885), `csr_override` (e.g. `"CSR94"`), `catastrophic_override`,
  plus `household.people[]` and `place`. These come from the user's own
  application — never invent or hardcode them.
- **CSR codes have two forms.** `ffm/get` and `plans/search` use the short code
  (`"CSR94"`); a plan's per-benefit `cost_sharings` describe it as
  `"94% AV Level Silver Plan CSR"`. If you ever call `enrollment/validate`, it
  expects the long form. Don't confuse them.
- **Plans have many deductible/MOOP/benefit entries** (per network tier and per
  CSR variant). `flatten.ts` (`inNetworkForCsr`) selects the `In-Network` entry
  matching the household's CSR — for a Silver CSR94 household that's the
  `"94% AV Level Silver Plan CSR"` variant (e.g. $0 deductible / $2,200 MOOP),
  **not** the base `"Exchange variant (no CSR)"` ($6,000 / $8,900). Non-CSR
  plans (e.g. Gold) have no CSR variant, so they fall back to the base amount.
  The same CSR-matching logic drives the per-benefit copay columns (PCP,
  specialist, ER, generic drugs). When a plan splits Medical vs. Drug
  deductibles instead of a "Combined" entry, `deductibleFor` sums them.
  `premium_w_credit` is the net premium after APTC; `oopc` is the plan's
  estimated monthly out-of-pocket cost figure.
- The search response also includes `facet_groups` (counts by metal level,
  issuer, plan type, etc.) and `ranges` — useful if/when we add faceted
  filtering driven by the API instead of client-side only.

## Conventions

- TypeScript is bundled but **not type-checked at build time** — run
  `npm run typecheck` before committing. `strict` is on.
- Keep the extension dependency-free at runtime; prefer plain DOM APIs.
- API response objects are large and only partially typed (`RawPlan` in
  `src/lib/types.ts` covers just what we read). Extend that interface when you
  start reading new fields rather than reaching into `any`.
- The manifest's `host_permissions` and content-script `matches` must stay in
  sync with the real healthcare.gov enrollment URL pattern; if the site moves
  the SPA, both need updating.
