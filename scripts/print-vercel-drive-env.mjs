/**
 * Prints Vercel env var names/values from a service account JSON (for copy-paste).
 * Does not write files. Run locally only.
 *
 *   npm run print:vercel-drive-env -- "/path/to/key.json"
 *
 * Or (same line — required if using export-style env):
 *   GOOGLE_SERVICE_ACCOUNT_KEY_FILE="/path/to/key.json" npm run print:vercel-drive-env
 */

import { readFileSync } from 'node:fs';

const keyFile = process.argv[2] || process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
if (!keyFile) {
  console.error('Usage: npm run print:vercel-drive-env -- "/path/to/service-account.json"');
  console.error('Or:  GOOGLE_SERVICE_ACCOUNT_KEY_FILE="/path/to/key.json" npm run print:vercel-drive-env');
  process.exit(1);
}

const json = JSON.parse(readFileSync(keyFile, 'utf8'));
if (!json.client_email || !json.private_key) {
  console.error('Invalid service account JSON.');
  process.exit(1);
}

const folderId = process.env.CASE_STUDIES_DRIVE_FOLDER_ID || '15weJWQB_XV1E8taXq9K8r07KEF-AabS1';

console.log('\n=== Copy these into Vercel (all environments) ===\n');
console.log('GOOGLE_SERVICE_ACCOUNT_EMAIL');
console.log(json.client_email);
console.log('\nGOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
console.log(json.private_key);
console.log('\nCASE_STUDIES_DRIVE_FOLDER_ID');
console.log(folderId);
console.log('\n=== Then delete GOOGLE_OAUTH_* from Vercel and redeploy ===\n');
