/**
 * Validates Google service account credentials for Drive.
 *
 * Usage:
 *   export GOOGLE_SERVICE_ACCOUNT_EMAIL="..."
 *   export GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="..."
 *   export CASE_STUDIES_DRIVE_FOLDER_ID="..."
 *   node scripts/test-google-service-account.mjs
 *
 * Or:
 *   export GOOGLE_SERVICE_ACCOUNT_KEY_FILE="/path/to/key.json"
 *   node scripts/test-google-service-account.mjs
 */

import { readFileSync } from 'node:fs';

function normalize(value) {
  if (!value) return '';
  return value.trim().replace(/^["']|["']$/g, '');
}

async function main() {
  const folderId = normalize(process.env.CASE_STUDIES_DRIVE_FOLDER_ID) || '15weJWQB_XV1E8taXq9K8r07KEF-AabS1';
  let clientEmail = normalize(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  let privateKey = normalize(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)?.replace(/\\n/g, '\n');

  const keyFile = normalize(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE);
  if ((!clientEmail || !privateKey) && keyFile) {
    const json = JSON.parse(readFileSync(keyFile, 'utf8'));
    clientEmail = json.client_email;
    privateKey = json.private_key;
  }

  console.log('=== Google service account test ===\n');
  console.log('Email:   ', clientEmail || '(missing)');
  console.log('Folder:  ', folderId);

  if (!clientEmail || !privateKey) {
    console.error('FAIL: Provide GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY or GOOGLE_SERVICE_ACCOUNT_KEY_FILE');
    process.exit(1);
  }

  const { google } = await import('googleapis');
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const drive = google.drive({ version: 'v3', auth });

  const list = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    pageSize: 5,
    fields: 'files(id,name,mimeType)',
  });

  const files = list.data.files || [];
  console.log('PASS (1/2): Service account can list Drive folder.');
  console.log('Files found (up to 5):', files.length);
  files.forEach((f) => console.log(` - ${f.name} (${f.id})`));

  const testName = `btc-preflight-test-${Date.now()}.json`;
  const created = await drive.files.create({
    requestBody: {
      name: testName,
      parents: [folderId],
      mimeType: 'application/json',
    },
    supportsAllDrives: true,
    media: {
      mimeType: 'application/json',
      body: JSON.stringify({ ok: true, testedAt: new Date().toISOString() }),
    },
    fields: 'id,name',
  });

  const testFileId = created.data.id;
  if (!testFileId) {
    throw new Error('Upload test did not return a file id');
  }

  await drive.files.delete({
    fileId: testFileId,
    supportsAllDrives: true,
  });

  console.log('PASS (2/2): Service account can upload and delete in folder.');
  console.log('\nAll checks passed — safe to deploy.');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('FAIL:', message);
  if (message.includes('storage quota')) {
    console.error('\nDiagnosis: This folder is on personal Google Drive, not a Shared Drive.');
    console.error('Service accounts cannot upload files there (no storage quota).');
    console.error('\nFix (pick one):');
    console.error('1. Create a Google Shared Drive, add the service account as Manager,');
    console.error('   create/move the case-studies folder inside it, update CASE_STUDIES_DRIVE_FOLDER_ID.');
    console.error('2. Or use OAuth in Production mode (see VERCEL_DRIVE_SETUP.md) for personal Gmail.');
  }
  process.exit(2);
});
