import { del, list, put } from '@vercel/blob';

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

export function useBlobStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export function isProductionRuntime(): boolean {
  return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
}

export const BLOB_NOT_CONFIGURED_ERROR =
  'File storage is not configured. In the Vercel dashboard open Storage → Create Blob store → connect to this project (adds BLOB_READ_WRITE_TOKEN automatically), then redeploy.';

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** API-facing URLs (proxy downloads). Stored blobs keep https URLs in metadata. */
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

async function readMetaBlob(url: string): Promise<CaseStudyRecord | null> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) return null;
  const data = (await response.json()) as CaseStudyRecord;
  if (!data?.id || !data?.title) return null;
  return data;
}

// --- Blob storage ---

async function listFromBlob(): Promise<CaseStudyRecord[]> {
  const result = await list({ prefix: META_PREFIX, limit: 500 });
  const records: CaseStudyRecord[] = [];

  for (const blob of result.blobs) {
    const record = await readMetaBlob(blob.url);
    if (record) records.push(toPublicRecord(record));
  }

  return records.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}

async function findFromBlob(caseStudyId: string): Promise<CaseStudyRecord | null> {
  const records = await listFromBlob();
  return records.find((item) => item.id === caseStudyId) || null;
}

async function putFile(pathname: string, data: Buffer, contentType: string) {
  return put(pathname, data, {
    access: 'public',
    contentType: contentType || 'application/octet-stream',
    addRandomSuffix: false,
  });
}

async function saveMetaToBlob(caseStudy: CaseStudyRecord) {
  await put(`${META_PREFIX}${caseStudy.id}.json`, JSON.stringify(caseStudy), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  });
}

export async function listCaseStudies(): Promise<CaseStudyRecord[]> {
  if (useBlobStorage()) {
    return listFromBlob();
  }
  return [...inMemoryCaseStudies];
}

export async function findCaseStudy(caseStudyId: string): Promise<CaseStudyRecord | null> {
  if (useBlobStorage()) {
    return findFromBlob(caseStudyId);
  }
  return inMemoryCaseStudies.find((item) => item.id === caseStudyId) || null;
}

export async function resolveDownload(
  caseStudyId: string,
  attachmentId?: string
): Promise<{ url: string; name: string; mimeType: string; buffer?: Buffer } | null> {
  const caseStudy = await findCaseStudy(caseStudyId);
  if (!caseStudy) return null;

  const attachments = Array.isArray(caseStudy.attachments) ? caseStudy.attachments : [];
  const targetAttachment = attachmentId ? attachments.find((item) => item.id === attachmentId) : null;

  if (useBlobStorage()) {
    const stored = await findFromBlob(caseStudyId);
    if (!stored) return null;
    const storedAttachments = Array.isArray(stored.attachments) ? stored.attachments : [];
    const storedAttachment = attachmentId
      ? storedAttachments.find((item) => item.id === attachmentId)
      : null;
    const targetUrl = storedAttachment ? storedAttachment.url : stored.fileUrl;
    const targetName = storedAttachment?.name || stored.fileName || 'case-study-file';
    const targetMime = storedAttachment?.mimeType || 'application/octet-stream';
    if (!targetUrl?.startsWith('http')) {
      return null;
    }
    return { url: targetUrl, name: targetName, mimeType: targetMime };
  }

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
    const caseStudy = await findFromBlob(caseStudyId);
    if (!caseStudy) return false;

    const urlsToDelete = new Set<string>();
    if (caseStudy.fileUrl?.startsWith('http')) urlsToDelete.add(caseStudy.fileUrl);
    for (const item of caseStudy.attachments || []) {
      if (item.url?.startsWith('http')) urlsToDelete.add(item.url);
    }

    const metaList = await list({ prefix: `${META_PREFIX}${caseStudyId}` });
    for (const blob of metaList.blobs) urlsToDelete.add(blob.url);

    const fileList = await list({ prefix: `case-studies/files/${caseStudyId}/` });
    for (const blob of fileList.blobs) urlsToDelete.add(blob.url);

    for (const url of urlsToDelete) {
      try {
        await del(url);
      } catch {
        // Continue deleting remaining blobs.
      }
    }
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
