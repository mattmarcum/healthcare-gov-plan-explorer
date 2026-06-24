# HealthCare.gov Plan Explorer

A browser extension (Chrome & Firefox) that pulls **every** available marketplace
plan for your application and shows them in one sortable, filterable, exportable
table — instead of the 10-at-a-time paging on healthcare.gov.

> **Not affiliated with, endorsed by, or operated by HealthCare.gov, CMS, or the
> U.S. government.** This is an independent tool that runs entirely in your own
> browser. See [Privacy](#privacy) and [Disclaimer](#disclaimer).

## Why

HealthCare.gov shows plan results 10 at a time across many pages, and the most
useful comparison numbers (premium after subsidy, deductible, max out-of-pocket,
estimated yearly cost) are scattered across separate plan detail pages. This
extension fetches the full result set for **your** household at once and lays it
out as a spreadsheet you can sort, filter, and export to CSV.

## Install

### From the stores

- **Chrome Web Store:** _(pending review — link will go here)_
- **Firefox Add-ons:** _(pending review — link will go here)_

### From source

```bash
npm install
npm run build        # outputs dist/
```

**Chrome:** `chrome://extensions` → enable **Developer mode** → **Load unpacked**
→ select the `dist/` folder.

**Firefox:** `about:debugging` → **This Firefox** → **Load Temporary Add-on…** →
select `dist/manifest.json`. (Temporary add-ons are removed when Firefox
restarts; re-load each session.)

## Use

1. Log in to healthcare.gov and open your application's **plan results** page
   (URL looks like `.../consumers/?a=<appId>&t=<state>#/.../plans/results`).
2. Click the **Compare all plans** button (bottom-right).
3. Sort by clicking column headers, filter with the search box, **Export CSV**.

## Privacy

This extension has **no backend and collects no data**. Everything happens
locally in your browser:

- It reads your own application data only from healthcare.gov, using the session
  you're already logged into (the same way the website itself does).
- It calls HealthCare.gov's own public plan-search API to fetch plans.
- Nothing is sent to any third-party server. There is no analytics, no
  tracking, and no account. CSV export writes a file to your own computer.

## How it works

The extension runs as a single content script on your healthcare.gov enrollment
pages. It reads the search parameters from your in-progress application, calls
the marketplace plan-search API (paging past the site's 10-plan limit to get
them all), flattens each plan into a row, and renders a table inside a shadow
DOM so the host page's styles can't interfere.

For the full architecture and the (reverse-engineered, undocumented) API
details, see [CLAUDE.md](./CLAUDE.md).

## Development

```bash
npm run build       # bundle to dist/
npm run watch       # rebuild on change
npm run typecheck   # tsc --noEmit (the build does not type-check)
npm run package     # produce plan-explorer.zip for store upload (no sourcemap)
npm run firefox     # launch a temp Firefox profile with the extension loaded
```

Stack: vanilla TypeScript bundled with esbuild into one content script. No
framework, no runtime dependencies.

### Releasing

Tag a version to trigger the release workflow (see
[`.github/workflows/release.yml`](./.github/workflows/release.yml)):

```bash
npm version patch          # bumps package.json; also bump manifest.json version
git push --tags
```

This builds, attaches `plan-explorer.zip` to a GitHub Release, and — when the
store credentials are configured as repository secrets — uploads to the Chrome
Web Store and Firefox AMO. See
[`docs/PUBLISHING.md`](./docs/PUBLISHING.md) for the required secrets and the
one-time store-account setup.

## Disclaimer

Plan data comes directly from HealthCare.gov and may be incomplete, delayed, or
incorrect. This tool is provided "as is" for convenience only and is **not** a
substitute for the official HealthCare.gov plan results or professional advice.
Always confirm details on HealthCare.gov before enrolling. "HealthCare.gov" is a
service of the U.S. Centers for Medicare & Medicaid Services; the name is used
here only to describe what the extension works with.

## License

[MIT](./LICENSE)
