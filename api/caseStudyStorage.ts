export type CaseStudyRecord = {
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
const inMemoryCaseStudies: CaseStudyRecord[] = [];
const inMemoryFiles = new Map<string, InMemoryStoredFile>();

type BlobSdk = typeof import('@vercel/blob');

let blobSdkPromise: Promise<BlobSdk> | null = null;

async function getBlobSdk(): Promise<BlobSdk> {
  if (!blobSdkPromise) {
    blobSdkPromise = import('@vercel/blob');
  }
  return blobSdkPromise;
}

function blobToken(): string | undefined {
  const raw = process.env.BLOB_READ_WRITE_TOKEN;
  if (!raw) return undefined;
  return raw.trim().replace(/^["']|["']$/g, '');
}

export function useBlobStorage(): boolean {
  return Boolean(blobToken());
}

export function isProductionRuntime(): boolean {
  return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
}

export const BLOB_NOT_CONFIGURED_ERROR =
  'File storage is not configured. In Vercel → Storage → create a Blob store and connect it to this project (adds BLOB_READ_WRITE_TOKEN), then redeploy.';

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function blobOptions(contentType: string, multipart = false) {
  return {
    access: 'public' as const,
    contentType: contentType || 'application/octet-stream',
    addRandomSuffix: false,
    token: blobToken(),
    multipart,
  };
}

/** API-facing URLs (proxy downloads). Stored metadata keeps real blob URLs. */
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

export function makeDownloadUrl(caseStudyId: string, attachmentId?: string): string {
  if (attachmentId) {
    return `/api/case-studies?action=download&caseStudyId=${encodeURIComponent(
      caseStudyId
    )}&attachmentId=${encodeURIComponent(attachmentId)}`;
  }
  return `/api/case-studies?action=download&caseStudyId=${encodeURIComponent(caseStudyId)}`;
}

async function fetchBlobContent(blobUrl: string): Promise<Response> {
  const token = blobToken();
  const { head } = await getBlobSdk();
  const meta = await head(blobUrl, { token });
  return fetch(meta.downloadUrl, {
    cache: 'no-store',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

async function readMetaBlob(blob: { url: string; downloadUrl?: string }): Promise<CaseStudyRecord | null> {
  const token = blobToken();
  const response = await fetch(blob.downloadUrl || blob.url, {
    cache: 'no-store',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) return null;
  const data = (await response.json()) as CaseStudyRecord;
  if (!data?.id || !data?.title) return null;
  return data;
}

async function findStoredFromBlob(caseStudyId: string): Promise<CaseStudyRecord | null> {
  const { list } = await getBlobSdk();
  const metaPathname = `${META_PREFIX}${caseStudyId}.json`;
  const result = await list({ prefix: metaPathname, limit: 20, token: blobToken() });
  const metaBlob = result.blobs.find((item) => item.pathname === metaPathname);
  if (!metaBlob) return null;
  return readMetaBlob(metaBlob);
}

async function listFromBlob(): Promise<CaseStudyRecord[]> {
  const { list } = await getBlobSdk();
  const result = await list({ prefix: META_PREFIX, limit: 500, token: blobToken() });
  const records: CaseStudyRecord[] = [];

  for (const blob of result.blobs) {
    if (!blob.pathname.endsWith('.json')) continue;
    const record = await readMetaBlob(blob);
    if (record) records.push(toPublicRecord(record));
  }

  return records.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}

async function putFile(pathname: string, data: Buffer, contentType: string) {
  const { put } = await getBlobSdk();
  const useMultipart = data.length > 4 * 1024 * 1024;
  return put(pathname, data, blobOptions(contentType, useMultipart));
}

async function saveMetaToBlob(caseStudy: CaseStudyRecord) {
  const { put } = await getBlobSdk();
  await put(`${META_PREFIX}${caseStudy.id}.json`, JSON.stringify(caseStudy), {
    ...blobOptions('application/json'),
  });
}

export async function listCaseStudies(): Promise<CaseStudyRecord[]> {
  if (useBlobStorage()) {
    return listFromBlob();
  }
  return inMemoryCaseStudies.map(toPublicRecord);
}

export async function findCaseStudy(caseStudyId: string): Promise<CaseStudyRecord | null> {
  if (useBlobStorage()) {
    const stored = await findStoredFromBlob(caseStudyId);
    return stored ? toPublicRecord(stored) : null;
  }
  const found = inMemoryCaseStudies.find((item) => item.id === caseStudyId);
  return found ? toPublicRecord(found) : null;
}

export async function resolveDownload(
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

    const response = await fetchBlobContent(blobUrl);
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
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

export async function deleteCaseStudy(caseStudyId: string): Promise<boolean> {
  if (useBlobStorage()) {
    const caseStudy = await findStoredFromBlob(caseStudyId);
    if (!caseStudy) return false;

    const urlsToDelete = new Set<string>();
    if (caseStudy.fileUrl?.startsWith('http')) urlsToDelete.add(caseStudy.fileUrl);
    for (const item of caseStudy.attachments || []) {
      if (item.url?.startsWith('http')) urlsToDelete.add(item.url);
    }

    const { list, del } = await getBlobSdk();
    const metaList = await list({ prefix: `${META_PREFIX}${caseStudyId}`, token: blobToken() });
    for (const blob of metaList.blobs) urlsToDelete.add(blob.url);

    const fileList = await list({ prefix: `case-studies/files/${caseStudyId}/`, token: blobToken() });
    for (const blob of fileList.blobs) urlsToDelete.add(blob.url);

    await del(Array.from(urlsToDelete), { token: blobToken() });
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

export async function uploadCaseStudy(input: UploadCaseStudyInput): Promise<CaseStudyRecord> {
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
