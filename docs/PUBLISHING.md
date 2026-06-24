# Publishing

The release workflow (`.github/workflows/release.yml`) runs when you push a tag
matching `v*`. It always builds and attaches `plan-explorer.zip` to a GitHub
Release. It uploads to the Chrome Web Store and Firefox AMO **only** when the
repository variable `STORE_PUBLISH` is set to `true` and the secrets below are
configured.

```bash
# bump version in BOTH package.json and manifest.json first, then:
git tag v0.1.0
git push --tags
```

## One-time: enable store publishing

In the repo: **Settings → Secrets and variables → Actions**.

Add a **variable**:

| Variable        | Value  |
| --------------- | ------ |
| `STORE_PUBLISH` | `true` |

## Chrome Web Store

1. Register a developer account ($5 one-time fee) at
   <https://chrome.google.com/webstore/devconsole>.
2. Create the item once by uploading `plan-explorer.zip` manually; note its
   **Extension ID**.
3. Create Google API OAuth credentials for the Chrome Web Store API and generate
   a refresh token. Guide:
   <https://github.com/fregante/chrome-webstore-upload-keys>.
4. Add these **secrets**:

| Secret                  | Where it comes from                       |
| ----------------------- | ----------------------------------------- |
| `CHROME_EXTENSION_ID`   | The item's ID in the developer dashboard  |
| `CHROME_CLIENT_ID`      | OAuth client ID                           |
| `CHROME_CLIENT_SECRET`  | OAuth client secret                       |
| `CHROME_REFRESH_TOKEN`  | OAuth refresh token                       |

## Firefox Add-ons (AMO)

1. Create an account at <https://addons.mozilla.org/developers/>.
2. Generate API credentials at
   <https://addons.mozilla.org/developers/addon/api/key/>.
3. Add these **secrets**:

| Secret           | AMO field        |
| ---------------- | ---------------- |
| `AMO_JWT_ISSUER` | API key (issuer) |
| `AMO_JWT_SECRET` | API secret       |

> AMO requires reviewable source for any bundled/minified code. Our build is
> bundled by esbuild, so the AMO listing must include the build instructions
> (Node version + `npm ci && npm run build`) in the "source code" section.
> See <https://extensionworkshop.com/documentation/publish/source-code-submission/>.

## Store listing assets (prepared manually, not in CI)

Both stores require: an icon (128×128 min), at least one screenshot, a short +
long description, and a **privacy policy URL**. Point the privacy policy at
[`PRIVACY.md`](../PRIVACY.md) (e.g. its rendered GitHub URL) — the extension
collects no data, which simplifies both stores' data-disclosure forms.
