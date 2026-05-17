# Vercel Google Drive setup (production, no expiry)

Case study uploads on the live site use a **Google service account**. This does **not** expire every 7 days (unlike OAuth refresh tokens in Testing mode).

## 1. Remove OAuth variables on Vercel

In **Vercel → Project → Settings → Environment Variables**, delete:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REFRESH_TOKEN`

These caused `invalid_grant` and are no longer used by the API.

## 2. Add service account variables

From your service account JSON file (`hip-polymer-453117-d8-b0931aa8a1dc.json`):

| Variable | Value |
|----------|--------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `btc-case-studies-uploader@hip-polymer-453117-d8.iam.gserviceaccount.com` |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Full `private_key` from JSON (paste with real line breaks, or `\n` escaped) |
| `CASE_STUDIES_DRIVE_FOLDER_ID` | `15weJWQB_XV1E8taXq9K8r07KEF-AabS1` |

**Private key on Vercel:** paste the entire key including `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----`. Vercel accepts multiline secrets.

To print values from your JSON locally (do not commit output):

```bash
npm run print:vercel-drive-env -- "/Users/rashikapandey/Downloads/hip-polymer-453117-d8-b0931aa8a1dc.json"
```

Note: setting `GOOGLE_SERVICE_ACCOUNT_KEY_FILE=...` on one line and running `npm run` on the **next** line does not work — the variable is not kept unless you use `export` or pass the path after `--` as above.

## 3. Folder must be on a **Shared Drive** (required for uploads)

Your folder `District-Immersion-Writeups` is on **personal** Google Drive. Service accounts can **read** shared folders but **cannot upload** there (Google returns “Service Accounts do not have storage quota”).

### Do this once

1. In Google Drive, create or open a **Shared drive** (needs Google Workspace, or an account that has Shared drives).
2. Add member: `btc-case-studies-uploader@hip-polymer-453117-d8.iam.gserviceaccount.com` with role **Content manager** or **Manager**.
3. Create a folder inside that Shared drive (e.g. `Case-Studies`) or move your existing content there.
4. Copy the **new folder ID** from the URL (`https://drive.google.com/.../folders/FOLDER_ID`).
5. Set `CASE_STUDIES_DRIVE_FOLDER_ID` on Vercel to that new ID.

### If you only have personal Gmail (no Shared drives)

Use OAuth with the consent screen in **In production** (not Testing), then regenerate `GOOGLE_OAUTH_REFRESH_TOKEN`. Testing-mode OAuth still expires ~every 7 days.

## 4. Share the folder with the service account

1. Open the case-studies folder **inside the Shared drive**.
2. Confirm the service account is already a member of the Shared drive (step 3).

## 5. Redeploy

Trigger a new deployment after saving env vars.

## 6. Verify

```bash
export GOOGLE_SERVICE_ACCOUNT_EMAIL="..."
export GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="..."
export CASE_STUDIES_DRIVE_FOLDER_ID="15weJWQB_XV1E8taXq9K8r07KEF-AabS1"
npm run test:google-service-account
```

Then upload a test case study on the live site.

## Why not OAuth?

| Method | Production suitability |
|--------|-------------------------|
| OAuth refresh token (Testing app) | Expires ~every 7 days |
| OAuth refresh token (Production app) | Can still be revoked; needs re-auth |
| **Service account** | **Stable for server uploads; no user re-login** |
