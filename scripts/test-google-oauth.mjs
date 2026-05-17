/**
 * Validates Google OAuth credentials used for Drive uploads.
 *
 * Usage (do not commit secrets):
 *   export GOOGLE_OAUTH_CLIENT_ID="..."
 *   export GOOGLE_OAUTH_CLIENT_SECRET="..."
 *   export GOOGLE_OAUTH_REFRESH_TOKEN="..."
 *   export CASE_STUDIES_DRIVE_FOLDER_ID="..."   # optional, tests folder access
 *   node scripts/test-google-oauth.mjs
 */

function normalize(value) {
  if (!value) return '';
  return value.trim().replace(/^["']|["']$/g, '');
}

function mask(value) {
  if (!value) return '(missing)';
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}...${value.slice(-4)} (len=${value.length})`;
}

async function refreshAccessToken({ clientId, clientSecret, refreshToken }) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

async function testDriveList(accessToken, folderId) {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    pageSize: '1',
    fields: 'files(id,name)',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });

  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

async function main() {
  const clientId = normalize(process.env.GOOGLE_OAUTH_CLIENT_ID);
  const clientSecret = normalize(process.env.GOOGLE_OAUTH_CLIENT_SECRET);
  const refreshToken = normalize(process.env.GOOGLE_OAUTH_REFRESH_TOKEN);
  const folderId = normalize(process.env.CASE_STUDIES_DRIVE_FOLDER_ID);

  console.log('=== Google OAuth credential test ===\n');
  console.log('Client ID:      ', mask(clientId));
  console.log('Client secret:  ', mask(clientSecret));
  console.log('Refresh token:  ', mask(refreshToken));
  console.log('Drive folder ID:', folderId || '(not set)\n');

  if (!clientId || !clientSecret || !refreshToken) {
    console.error('FAIL: Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REFRESH_TOKEN.');
    process.exit(1);
  }

  console.log('Step 1: Refresh access token...');
  const tokenResult = await refreshAccessToken({ clientId, clientSecret, refreshToken });

  if (!tokenResult.ok) {
    console.error('FAIL: Token refresh failed.');
    console.error('HTTP status:', tokenResult.status);
    console.error('Google response:', JSON.stringify(tokenResult.payload, null, 2));

    if (tokenResult.payload?.error === 'invalid_grant') {
      console.error('\nDiagnosis: Refresh token is expired/revoked or client secret mismatch.');
      console.error('- If OAuth app is in Testing mode, refresh tokens expire after ~7 days.');
      console.error('- Regenerate refresh token or switch to service-account auth on Vercel.');
    }

    process.exit(2);
  }

  const accessToken = tokenResult.payload.access_token;
  const expiresIn = tokenResult.payload.expires_in;
  console.log('PASS: Access token obtained.');
  console.log('Expires in (seconds):', expiresIn ?? 'unknown');

  if (!folderId) {
    console.log('\nStep 2 skipped: CASE_STUDIES_DRIVE_FOLDER_ID not set.');
    console.log('OAuth credentials are valid for token refresh.');
    process.exit(0);
  }

  console.log('\nStep 2: List files in case-studies folder...');
  const driveResult = await testDriveList(accessToken, folderId);

  if (!driveResult.ok) {
    console.error('FAIL: Drive API call failed (credentials may be valid but Drive access is not).');
    console.error('HTTP status:', driveResult.status);
    console.error('Google response:', JSON.stringify(driveResult.payload, null, 2));
    console.error('\nPossible causes:');
    console.error('- Drive API not enabled for this Google Cloud project');
    console.error('- OAuth scope missing (need https://www.googleapis.com/auth/drive)');
    console.error('- Folder not shared with the OAuth Google account');
    process.exit(3);
  }

  const count = Array.isArray(driveResult.payload.files) ? driveResult.payload.files.length : 0;
  console.log('PASS: Drive folder accessible.');
  console.log('Sample files returned:', count);
  if (count > 0) {
    console.log('First file:', driveResult.payload.files[0]);
  }

  console.log('\nAll checks passed. OAuth credentials are valid.');
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(99);
});
