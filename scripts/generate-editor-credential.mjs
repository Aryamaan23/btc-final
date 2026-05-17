/**
 * Generate scrypt hashes for a case-study editor account (paste into api/case-studies.ts).
 *
 *   node scripts/generate-editor-credential.mjs "Username" "password"
 */

import { randomBytes, scryptSync } from 'crypto';

const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
  console.error('Usage: node scripts/generate-editor-credential.mjs "<username>" "<password>"');
  process.exit(1);
}

const usernameSalt = randomBytes(16).toString('hex');
const usernameHash = scryptSync(username.trim().toLowerCase(), usernameSalt, 64).toString('hex');
const passwordSalt = randomBytes(16).toString('hex');
const passwordHash = scryptSync(password, passwordSalt, 64).toString('hex');

console.log(JSON.stringify({ usernameSalt, usernameHash, passwordSalt, passwordHash }, null, 2));
