# Publishing risk assessment

Research into the legal/policy risk of publishing this extension on the Chrome
Web Store and Firefox Add-ons (AMO). **This is an engineering summary, not legal
advice.** Overall risk: **Low-to-Medium**, with concrete mitigations below.

## TL;DR

- **CMS publishes an official, documented Marketplace API for third-party
  developers.** This is the single most important finding: the data this
  extension uses is officially available, and CMS invites outside developers to
  build on it. Strongest mitigation: call the **documented** API with a
  requested API key instead of the SPA's internal `marketplace-int.api…` host.
- The biggest *store* friction point is **branding** — leading with the
  "HealthCare.gov" name risks implying government endorsement. We already ship a
  prominent "not affiliated" disclaimer; consider a name like *"Plan Explorer
  for HealthCare.gov"*.
- **CFAA risk is low**: the user reads their *own* application with their *own*
  logged-in session, and the plan API is public and unauthenticated.
- **Action item before launch:** manually review healthcare.gov's terms and
  `robots.txt` (the site blocked automated fetches during research).

## 1. There is an official CMS Marketplace API

CMS runs a developer program and a documented Marketplace API that "powers the
Window Shop and Plan Compare features on HealthCare.gov." API keys are "issued
to anyone who requests access," and Direct Enrollment partners use it to power
their own enrollment apps. There is also a `healthcare.gov/developers` page.

The endpoint this extension currently calls (`marketplace-int.api.healthcare.gov`)
is the SPA's internal host for the same service. **Mitigation:** switch the
plan-search calls to the documented API base with a requested key — that moves
us from "undocumented internal endpoint" onto the sanctioned, intended path.

- Marketplace API: <https://developer.cms.gov/marketplace-api/>
- API spec: <https://developer.cms.gov/marketplace-api/api-spec>
- Key request: <https://developer.cms.gov/marketplace-api/key-request.html>
- Developer landing: <https://www.healthcare.gov/developers/>

**Caveat (important):** CMS states the API is "designed to support live access
by front-end applications, it's **not** designed to be scraped or for the whole
data set to be extracted." This extension only fetches the plans for **one
household's own application** (tens to low-hundreds of plans) — i.e. exactly the
"live front-end access" the API is for, not bulk dataset extraction. Keep it
that way: scoped per-user, no caching/redistribution of the dataset, reasonable
request volume. Risk if scoped: **Low**.

## 2. Computer Fraud and Abuse Act (CFAA) — Low

In *Van Buren v. United States* (2021) the Supreme Court narrowed "exceeds
authorized access" to mean reaching areas of a system you're **not entitled to
access at all** — not using access you legitimately have for a disfavored
purpose. Here the user reads their *own* application data with their *own*
session, and the plan API is public/unauthenticated. *hiQ v. LinkedIn* (9th
Cir.) points the same way for publicly accessible data. CFAA exposure is **low**.

- <https://www.congress.gov/crs-product/LSB10616>
- <https://en.wikipedia.org/wiki/Van_Buren_v._United_States>

## 3. Terms of use / robots.txt — verify before launch

healthcare.gov blocked automated fetches during this research, so its terms and
`robots.txt` could not be captured programmatically. As a reference point,
another federal site (SAM.gov) explicitly prohibits scraping in its terms. **Do
this manually before publishing:** read healthcare.gov's terms/legal pages and
`https://www.healthcare.gov/robots.txt`, and confirm nothing prohibits the
per-user, logged-in access pattern we use. Federal-government site content is
generally public, but verify. Risk: **Low-Medium, pending verification**.

## 4. Chrome Web Store policy — Low (with branding care)

Relevant clauses: single-purpose (we comply — one focused feature), no deceptive
behavior, and **impersonation / use of others' trademarks**. Don't imply
government affiliation; disclose functionality clearly. Our README, store
listing, and in-product disclaimer must state the tool is unofficial. Risk:
**Low** with the disclaimer; branding is the main lever (see §6).

- <https://developer.chrome.com/docs/webstore/program-policies/>

## 5. Firefox AMO policy — Low

- **No remote code execution:** add-ons must be self-contained and must not load
  remote code. We only `fetch` JSON *data* (not executable code), which is fine.
- **Reviewable source:** bundled/minified code requires providing build steps;
  our esbuild build instructions go in the AMO source-code submission.
- **Data disclosure:** AMO (Firefox 140+) wants data-collection practices
  declared in the manifest. We collect none — declare "no data collection".
- **"No Surprises":** users must discern functionality from the listing; don't
  mislead with the government name.

Risk: **Low**.

- <https://extensionworkshop.com/documentation/publish/add-on-policies/>
- <https://extensionworkshop.com/documentation/publish/source-code-submission/>

## 6. Trademark / branding — Medium (most likely friction point)

Using "HealthCare.gov" descriptively (nominative fair use) to say what the tool
works with is generally defensible, but **leading with it as the product name**
is the most likely cause of a store rejection or a complaint, because it can
imply official endorsement. Mitigations:

- Prefer a name that's clearly third-party, e.g. **"Plan Explorer for
  HealthCare.gov"** or "Marketplace Plan Comparison".
- Keep the prominent **"not affiliated with / endorsed by HealthCare.gov, CMS,
  or the U.S. government"** disclaimer (already in README, PRIVACY, and the
  product) — including on the store listing.
- Don't use CMS/HealthCare.gov logos or seals.

## Mitigation checklist

- [ ] Move plan-search to the **documented** CMS Marketplace API with a
      requested API key (`developer.cms.gov/marketplace-api/key-request.html`).
- [ ] Keep usage **scoped per-user**; never bulk-extract or redistribute data.
- [ ] Manually review healthcare.gov terms + `robots.txt` before launch.
- [ ] Finalize a clearly-third-party **name** and keep the disclaimer on both
      store listings.
- [ ] Publish the **privacy policy** ([`../PRIVACY.md`](../PRIVACY.md)) and
      declare "no data collection" on both stores.
- [ ] No government logos/seals in icons or screenshots.
