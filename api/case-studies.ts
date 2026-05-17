import type { VercelRequest, VercelResponse } from '@vercel/node';
import { scryptSync, timingSafeEqual } from 'crypto';

// ---------------------------------------------------------------------------
// Case study storage (inline — single file for reliable Vercel bundling)
// ---------------------------------------------------------------------------

type CaseStudyRecord = {
  id: string;
  title: string;
  studentName: string;
  program: string;
  summary: string;
  submittedAt: string;
  fileId: string;
  fileUrl: string;
  fileName: string;
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    mimeType: string;
  }>;
};

type InMemoryStoredFile = {
  id: string;
  name: string;
  mimeType: string;
  data: Buffer;
};

const META_PREFIX = 'case-studies/meta/';
const BLOB_NOT_CONFIGURED_ERROR =
  'File storage is not configured. In Vercel → Storage → create a Blob store and connect it to this project (adds BLOB_READ_WRITE_TOKEN), then redeploy.';

const inMemoryCaseStudies: CaseStudyRecord[] = [];
const inMemoryFiles = new Map<string, InMemoryStoredFile>();

function blobToken(): string | undefined {
  const raw = process.env.BLOB_READ_WRITE_TOKEN;
  if (!raw) return undefined;
  return raw.trim().replace(/^["']|["']$/g, '');
}

function useBlobStorage(): boolean {
  return Boolean(blobToken());
}

function isProductionRuntime(): boolean {
  return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
}

const BLOB_API_URL = 'https://blob.vercel-storage.com';
const BLOB_API_VERSION = '12';

function blobAccess(): 'public' | 'private' {
  const configured = process.env.BLOB_STORE_ACCESS?.trim().toLowerCase();
  if (configured === 'public') return 'public';
  return 'private';
}

type BlobListItem = {
  url: string;
  downloadUrl: string;
  pathname: string;
};

async function blobFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = blobToken();
  if (!token) {
    throw new Error(BLOB_NOT_CONFIGURED_ERROR);
  }
  const url = path.startsWith('http') ? path : `${BLOB_API_URL}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'x-api-version': BLOB_API_VERSION,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Blob API ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
  return response;
}

async function blobPut(pathname: string, body: Buffer | string, contentType: string): Promise<BlobListItem> {
  const params = new URLSearchParams({ pathname });
  const response = await blobFetch(`/?${params.toString()}`, {
    method: 'PUT',
    body,
    headers: {
      'x-vercel-blob-access': blobAccess(),
      'x-content-type': contentType,
      'x-add-random-suffix': '0',
    },
  });
  return (await response.json()) as BlobListItem;
}

async function blobList(options: { prefix?: string; limit?: number }): Promise<{ blobs: BlobListItem[] }> {
  const params = new URLSearchParams();
  if (options.prefix) params.set('prefix', options.prefix);
  if (options.limit) params.set('limit', String(options.limit));
  const response = await blobFetch(`?${params.toString()}`, { method: 'GET' });
  return (await response.json()) as { blobs: BlobListItem[] };
}

async function blobDel(urls: string[]): Promise<void> {
  if (!urls.length) return;
  await blobFetch('/delete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ urls }),
  });
}

async function blobGetBytes(targetUrl: string): Promise<Buffer | null> {
  const token = blobToken();
  if (!token || !targetUrl.startsWith('http')) return null;
  const response = await fetch(targetUrl, {
    cache: 'no-store',
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function makeDownloadUrl(caseStudyId: string, attachmentId?: string): string {
  if (attachmentId) {
    return `/api/case-studies?action=download&caseStudyId=${encodeURIComponent(
      caseStudyId
    )}&attachmentId=${encodeURIComponent(attachmentId)}`;
  }
  return `/api/case-studies?action=download&caseStudyId=${encodeURIComponent(caseStudyId)}`;
}

function toPublicRecord(record: CaseStudyRecord): CaseStudyRecord {
  const attachments = Array.isArray(record.attachments) ? record.attachments : [];
  return {
    ...record,
    fileUrl: makeDownloadUrl(record.id),
    attachments: attachments.map((attachment) => ({
      ...attachment,
      url: makeDownloadUrl(record.id, attachment.id),
    })),
  };
}

async function readMetaBlob(blob: { url: string; downloadUrl?: string }): Promise<CaseStudyRecord | null> {
  const raw = await blobGetBytes(blob.downloadUrl || blob.url);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw.toString('utf8')) as CaseStudyRecord;
    if (!data?.id || !data?.title) return null;
    return data;
  } catch {
    return null;
  }
}

async function findStoredFromBlob(caseStudyId: string): Promise<CaseStudyRecord | null> {
  const metaPathname = `${META_PREFIX}${caseStudyId}.json`;
  const result = await blobList({ prefix: metaPathname, limit: 20 });
  const metaBlob = result.blobs.find((item) => item.pathname === metaPathname);
  if (!metaBlob) return null;
  return readMetaBlob(metaBlob);
}

async function listFromBlob(): Promise<CaseStudyRecord[]> {
  try {
    const result = await blobList({ prefix: META_PREFIX, limit: 500 });
    const records: CaseStudyRecord[] = [];

    for (const blob of result.blobs) {
      if (!blob.pathname.endsWith('.json')) continue;
      const record = await readMetaBlob(blob);
      if (record) records.push(toPublicRecord(record));
    }

    return records.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  } catch (error) {
    console.error('[case-studies] listFromBlob failed:', error);
    return [];
  }
}

async function putFile(pathname: string, data: Buffer, contentType: string) {
  return blobPut(pathname, data, contentType || 'application/octet-stream');
}

async function saveMetaToBlob(caseStudy: CaseStudyRecord) {
  await blobPut(
    `${META_PREFIX}${caseStudy.id}.json`,
    JSON.stringify(caseStudy),
    'application/json'
  );
}

async function listCaseStudies(): Promise<CaseStudyRecord[]> {
  if (useBlobStorage()) {
    return listFromBlob();
  }
  return inMemoryCaseStudies.map(toPublicRecord);
}

async function resolveDownload(
  caseStudyId: string,
  attachmentId?: string
): Promise<{ url: string; name: string; mimeType: string; buffer?: Buffer } | null> {
  if (useBlobStorage()) {
    const stored = await findStoredFromBlob(caseStudyId);
    if (!stored) return null;

    const storedAttachments = Array.isArray(stored.attachments) ? stored.attachments : [];
    const storedAttachment = attachmentId
      ? storedAttachments.find((item) => item.id === attachmentId)
      : null;
    const blobUrl = storedAttachment ? storedAttachment.url : stored.fileUrl;
    const targetName = storedAttachment?.name || stored.fileName || 'case-study-file';
    const targetMime = storedAttachment?.mimeType || 'application/octet-stream';

    if (!blobUrl?.startsWith('http')) {
      return null;
    }

    const buffer = await blobGetBytes(blobUrl);
    if (!buffer) return null;

    return { url: '', name: targetName, mimeType: targetMime, buffer };
  }

  const caseStudy = inMemoryCaseStudies.find((item) => item.id === caseStudyId);
  if (!caseStudy) return null;

  const attachments = Array.isArray(caseStudy.attachments) ? caseStudy.attachments : [];
  const targetAttachment = attachmentId ? attachments.find((item) => item.id === attachmentId) : null;
  const targetFileId = targetAttachment ? targetAttachment.id : caseStudy.fileId;
  const targetFile = inMemoryFiles.get(targetFileId);
  if (!targetFile) return null;

  return {
    url: '',
    name: targetFile.name,
    mimeType: targetFile.mimeType,
    buffer: targetFile.data,
  };
}

async function deleteCaseStudy(caseStudyId: string): Promise<boolean> {
  if (useBlobStorage()) {
    const caseStudy = await findStoredFromBlob(caseStudyId);
    if (!caseStudy) return false;

    const urlsToDelete = new Set<string>();
    if (caseStudy.fileUrl?.startsWith('http')) urlsToDelete.add(caseStudy.fileUrl);
    for (const item of caseStudy.attachments || []) {
      if (item.url?.startsWith('http')) urlsToDelete.add(item.url);
    }

    const metaList = await blobList({ prefix: `${META_PREFIX}${caseStudyId}` });
    for (const blob of metaList.blobs) urlsToDelete.add(blob.url);

    const fileList = await blobList({ prefix: `case-studies/files/${caseStudyId}/` });
    for (const blob of fileList.blobs) urlsToDelete.add(blob.url);

    await blobDel(Array.from(urlsToDelete));
    return true;
  }

  const index = inMemoryCaseStudies.findIndex((item) => item.id === caseStudyId);
  if (index === -1) return false;
  const existing = inMemoryCaseStudies[index];
  const attachments = Array.isArray(existing.attachments) ? existing.attachments : [];
  inMemoryFiles.delete(existing.fileId);
  attachments.forEach((item) => inMemoryFiles.delete(item.id));
  inMemoryCaseStudies.splice(index, 1);
  return true;
}

type UploadCaseStudyInput = {
  title: string;
  studentName: string;
  program: string;
  summary: string;
  fileName: string;
  mimeType: string;
  binary: Buffer;
  attachments: Array<{ fileName: string; mimeType: string; base64Data: string }>;
};

async function uploadCaseStudy(input: UploadCaseStudyInput): Promise<CaseStudyRecord> {
  const nowIso = new Date().toISOString();
  const id = `case-${Date.now()}`;

  const caseStudy: CaseStudyRecord = {
    id,
    title: input.title,
    studentName: input.studentName,
    program: input.program,
    summary: input.summary,
    submittedAt: nowIso,
    fileId: '',
    fileUrl: '',
    fileName: input.fileName,
    attachments: [],
  };

  if (useBlobStorage()) {
    const mainPath = `case-studies/files/${id}/main/${sanitizeFileName(input.fileName)}`;
    const mainBlob = await putFile(mainPath, input.binary, input.mimeType);
    caseStudy.fileId = mainPath;
    caseStudy.fileUrl = mainBlob.url;

    for (const attachment of input.attachments) {
      const attachmentBinary = Buffer.from(attachment.base64Data, 'base64');
      if (!attachmentBinary.length) continue;

      const attachmentId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const attachmentPath = `case-studies/files/${id}/attachments/${attachmentId}/${sanitizeFileName(
        attachment.fileName
      )}`;
      const attachmentBlob = await putFile(attachmentPath, attachmentBinary, attachment.mimeType);

      caseStudy.attachments?.push({
        id: attachmentId,
        name: attachment.fileName,
        url: attachmentBlob.url,
        mimeType: attachment.mimeType,
      });
    }

    await saveMetaToBlob(caseStudy);
    return toPublicRecord(caseStudy);
  }

  const fileId = `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  inMemoryFiles.set(fileId, {
    id: fileId,
    name: input.fileName,
    mimeType: input.mimeType,
    data: input.binary,
  });
  caseStudy.fileId = fileId;
  caseStudy.fileUrl = makeDownloadUrl(id);

  for (const attachment of input.attachments) {
    const attachmentBinary = Buffer.from(attachment.base64Data, 'base64');
    if (!attachmentBinary.length) continue;

    const attachmentId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    inMemoryFiles.set(attachmentId, {
      id: attachmentId,
      name: attachment.fileName,
      mimeType: attachment.mimeType,
      data: attachmentBinary,
    });
    caseStudy.attachments?.push({
      id: attachmentId,
      name: attachment.fileName,
      url: makeDownloadUrl(id, attachmentId),
      mimeType: attachment.mimeType,
    });
  }

  inMemoryCaseStudies.unshift(caseStudy);
  return toPublicRecord(caseStudy);
}

// ---------------------------------------------------------------------------
// Editor auth
// ---------------------------------------------------------------------------

type EditorCredential = {
  usernameHash: string;
  usernameSalt: string;
  passwordHash: string;
  passwordSalt: string;
};

const DEFAULT_EDITOR_CREDENTIALS: EditorCredential[] = [
  {
    usernameSalt: 'fba58489ec946936f8147f0f45b4ed1d',
    usernameHash:
      'e1f9bfbbf9750a43c4e64ca9f7fa7cf7bbcf97e1363e185ba1b48154c28e80f309a107aedbc067be376dfd128e878b26f242941139e1ad9aa0e066694c7bc4d7',
    passwordSalt: '099458992a80ea7f585939452705ffc2',
    passwordHash:
      '9cbb420aad84fd1c75549584a982d5c04c776ed67e6dee50ac2db7c08f208add02489da120d94d6e13e24948a3fa02f069f9b4f837698171bed8cf04008706a1',
  },
  {
    usernameSalt: 'c8f8f8f0ba53e5adf7f9d5f9daf3b8c2',
    usernameHash:
      '34867ca540fbd2a42a8bc8ea60990a2f7dbd167fe97276a376bdc92fac7a56221e2193c76adb96700cd0eaaff24cfcb43c8809e6fa89044ffa5e123fb12d198d',
    passwordSalt: '2974d82c60d96087c3b4dd5bddd71a95',
    passwordHash:
      '735258d1b3312e5dabada4624c05d3179086ee797543655bfeefd132f8a9c861975b5d1fa5bf0a25b60d63a22eb5938a097817489dc248fa76dfd0e815cff6c6',
  },
];

function normalizeBody(req: VercelRequest): Record<string, unknown> {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return (req.body as Record<string, unknown>) || {};
}

function toHashedCredential(item: {
  username: string;
  password?: string;
  passwordHash?: string;
  salt?: string;
}): EditorCredential | null {
  if (!item.username) return null;
  if (item.passwordHash && item.salt) {
    const usernameSalt = scryptSync(item.username.toLowerCase(), 'editor-username-salt', 16).toString('hex');
    const usernameHash = scryptSync(item.username.trim().toLowerCase(), usernameSalt, 64).toString('hex');
    return {
      usernameSalt,
      usernameHash,
      passwordHash: item.passwordHash,
      passwordSalt: item.salt,
    };
  }
  if (item.password) {
    const usernameSalt = scryptSync(item.username.toLowerCase(), 'editor-username-salt', 16).toString('hex');
    const usernameHash = scryptSync(item.username.trim().toLowerCase(), usernameSalt, 64).toString('hex');
    const passwordSalt = scryptSync(item.username.toLowerCase(), 'editor-credential-salt', 16).toString('hex');
    const passwordHash = scryptSync(item.password, passwordSalt, 64).toString('hex');
    return {
      usernameSalt,
      usernameHash,
      passwordHash,
      passwordSalt,
    };
  }
  return null;
}

function getEditorCredentials(): EditorCredential[] {
  const configured = process.env.CASE_STUDY_EDITORS_JSON;
  if (!configured) return DEFAULT_EDITOR_CREDENTIALS;
  try {
    const parsed = JSON.parse(configured) as Array<{
      username: string;
      password?: string;
      passwordHash?: string;
      salt?: string;
    }>;
    if (Array.isArray(parsed) && parsed.length > 0) {
      const normalized = parsed
        .map((item) => toHashedCredential(item))
        .filter((item): item is EditorCredential => item !== null);
      if (normalized.length > 0) return normalized;
    }
  } catch {
    // Fall back to default credentials
  }
  return DEFAULT_EDITOR_CREDENTIALS;
}

function safePasswordMatch(password: string, credential: EditorCredential): boolean {
  const computedHash = scryptSync(password, credential.passwordSalt, 64).toString('hex');
  const computedBuffer = Buffer.from(computedHash, 'hex');
  const expectedBuffer = Buffer.from(credential.passwordHash, 'hex');
  if (computedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(computedBuffer, expectedBuffer);
}

function safeUsernameMatch(username: string, credential: EditorCredential): boolean {
  const normalized = username.trim().toLowerCase();
  const computedHash = scryptSync(normalized, credential.usernameSalt, 64).toString('hex');
  const computedBuffer = Buffer.from(computedHash, 'hex');
  const expectedBuffer = Buffer.from(credential.usernameHash, 'hex');
  if (computedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(computedBuffer, expectedBuffer);
}

function validateEditor(editorEmail?: string, editorPassword?: string): boolean {
  if (!editorEmail || !editorPassword) return false;
  const allowed = getEditorCredentials();
  return allowed.some((editor) => safeUsernameMatch(editorEmail, editor) && safePasswordMatch(editorPassword, editor));
}

function storageReady(): boolean {
  return useBlobStorage() || !isProductionRuntime();
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.query.action === 'health') {
      return res.status(200).json({
        success: true,
        blobConfigured: useBlobStorage(),
        blobAccess: blobAccess(),
        runtime: isProductionRuntime() ? 'production' : 'development',
      });
    }

    if (isProductionRuntime() && !useBlobStorage()) {
      return res.status(503).json({ success: false, error: BLOB_NOT_CONFIGURED_ERROR });
    }

    if (req.method === 'GET') {
      if (req.query.action === 'download') {
        const caseStudyId = String(req.query.caseStudyId || '').trim();
        const attachmentId = String(req.query.attachmentId || '').trim();
        if (!caseStudyId) {
          return res.status(400).json({ success: false, error: 'Missing caseStudyId' });
        }

        const file = await resolveDownload(caseStudyId, attachmentId || undefined);
        if (!file) {
          return res.status(404).json({ success: false, error: 'File not found' });
        }

        if (file.buffer) {
          res.status(200);
          res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
          res.setHeader('Content-Disposition', `attachment; filename="${file.name.replace(/"/g, '')}"`);
          return res.send(file.buffer);
        }

        return res.redirect(302, file.url);
      }

      const caseStudies = await listCaseStudies();
      return res.status(200).json({ success: true, caseStudies });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const body = normalizeBody(req);
    const action = String(body.action || '');
    const editorEmail = String(body.editorEmail || '');
    const editorPassword = String(body.editorPassword || '');

    if (action === 'auth') {
      if (!validateEditor(editorEmail, editorPassword)) {
        return res.status(401).json({ success: false, error: 'Invalid editor credentials' });
      }
      return res.status(200).json({ success: true });
    }

    if (!validateEditor(editorEmail, editorPassword)) {
      return res.status(401).json({ success: false, error: 'Only authorized editors can upload case studies' });
    }

    if (action === 'delete') {
      const caseStudyId = String(body.caseStudyId || '').trim();
      if (!caseStudyId) {
        return res.status(400).json({ success: false, error: 'Missing caseStudyId for delete' });
      }

      const deleted = await deleteCaseStudy(caseStudyId);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Case study not found' });
      }
      return res.status(200).json({ success: true });
    }

    if (!storageReady()) {
      return res.status(503).json({ success: false, error: BLOB_NOT_CONFIGURED_ERROR });
    }

    const title = String(body.title || '');
    const studentName = String(body.studentName || '');
    const program = String(body.program || '');
    const summary = String(body.summary || '');
    const fileName = String(body.fileName || '');
    const mimeType = String(body.mimeType || '');
    const base64Data = String(body.base64Data || '');
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];

    if (!title || !studentName || !program || !summary || !fileName || !mimeType || !base64Data) {
      return res.status(400).json({ success: false, error: 'Missing required fields for case study upload' });
    }

    if (summary.trim().length < 20) {
      return res.status(400).json({ success: false, error: 'Summary should be at least 20 characters' });
    }

    const binary = Buffer.from(base64Data, 'base64');
    if (!binary.length) {
      return res.status(400).json({ success: false, error: 'Uploaded file is empty or invalid' });
    }

    const normalizedAttachments = attachments
      .map((item: unknown) => {
        const row = item as Record<string, unknown>;
        return {
          fileName: String(row?.fileName || '').trim(),
          mimeType: String(row?.mimeType || 'application/octet-stream').trim(),
          base64Data: String(row?.base64Data || '').trim(),
        };
      })
      .filter((item) => item.fileName && item.base64Data);

    const caseStudy = await uploadCaseStudy({
      title: title.trim(),
      studentName: studentName.trim(),
      program: program.trim(),
      summary: summary.trim(),
      fileName: fileName.trim(),
      mimeType: mimeType || 'application/octet-stream',
      binary,
      attachments: normalizedAttachments,
    });

    return res.status(200).json({ success: true, caseStudy });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[case-studies] handler error:', error);
    return res.status(500).json({ success: false, error: message });
  }
}
