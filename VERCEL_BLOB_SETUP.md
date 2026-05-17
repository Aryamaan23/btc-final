# Vercel Blob storage (free, no Google Drive / OAuth)

Case study files are stored on **Vercel Blob** — included on the Hobby (free) plan (~1 GB storage). No Google Workspace, Shared Drive, or OAuth refresh tokens.

## 1. Create a Blob store (one time)

1. Open [Vercel Dashboard](https://vercel.com/dashboard) → your **btc-final** project.
2. Go to **Storage** → **Create Database / Store** → choose **Blob**.
3. Name it (e.g. `btc-case-studies`) and connect it to this project.
4. Vercel adds **`BLOB_READ_WRITE_TOKEN`** to your project automatically.

You can remove these (no longer used):

- `GOOGLE_OAUTH_*`
- `GOOGLE_SERVICE_ACCOUNT_*`
- `CASE_STUDIES_DRIVE_FOLDER_ID`

## 2. Redeploy

Push your latest code and deploy. The API uses Blob when `BLOB_READ_WRITE_TOKEN` is present.

## 3. Verify

```bash
# In project root — create .env.local with one line (no quotes around value):
# BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...

npm run test:vercel-blob
```

You should see `PASS: upload`, `PASS: list`, `PASS: delete`.

Then upload a test case study on the live site.

**Important:** In Vercel env settings, paste the token **without** surrounding quotes. If you use quotes in the dashboard, they become part of the token and uploads fail.

Local dev without Blob uses in-memory storage (resets when the dev server restarts). For local Blob testing, add `BLOB_READ_WRITE_TOKEN` to `.env.local` and run `vercel dev` (or the test script above).

## Free tier limits (Hobby)

- ~1 GB stored data
- ~10 GB blob transfer / month

Enough for many PDF case studies. Monitor usage under **Storage** in Vercel.

## How files are organized

```
case-studies/meta/{id}.json          ← metadata (title, summary, URLs)
case-studies/files/{id}/main/...     ← main PDF/DOC
case-studies/files/{id}/attachments/... ← optional attachments
```

Downloads use public blob URLs (case studies are public content).
