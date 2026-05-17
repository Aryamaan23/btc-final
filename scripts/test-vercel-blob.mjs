/**
 * Tests Vercel Blob upload/list/delete (same flow as case study API).
 *
 *   BLOB_READ_WRITE_TOKEN="your_token" npm run test:vercel-blob
 */

import { del, list, put } from '@vercel/blob';

function token() {
  const raw = process.env.BLOB_READ_WRITE_TOKEN;
  if (!raw) return null;
  return raw.trim().replace(/^["']|["']$/g, '');
}

async function main() {
  const t = token();
  if (!t) {
    console.error('Set BLOB_READ_WRITE_TOKEN (no quotes needed in .env.local)');
    process.exit(1);
  }

  console.log('=== Vercel Blob test ===\n');
  const pathname = `case-studies/_preflight/test-${Date.now()}.txt`;
  const body = `BTC blob test ${new Date().toISOString()}`;

  const uploaded = await put(pathname, body, {
    access: 'public',
    contentType: 'text/plain',
    addRandomSuffix: false,
    token: t,
  });
  console.log('PASS: upload');
  console.log('  url:', uploaded.url);

  const listed = await list({ prefix: 'case-studies/_preflight/', token: t });
  const found = listed.blobs.some((b) => b.url === uploaded.url);
  console.log(found ? 'PASS: list' : 'FAIL: list');

  await del(uploaded.url, { token: t });
  console.log('PASS: delete');
  console.log('\nBlob storage is ready for case study uploads.');
}

main().catch((error) => {
  console.error('FAIL:', error instanceof Error ? error.message : error);
  process.exit(2);
});
