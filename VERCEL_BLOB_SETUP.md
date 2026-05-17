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

Upload a test case study on the live site. It should appear on Publications and remain after refresh.

Local dev without Blob uses in-memory storage (resets when the dev server restarts). To test Blob locally, copy `BLOB_READ_WRITE_TOKEN` from Vercel into `.env.local`.

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
