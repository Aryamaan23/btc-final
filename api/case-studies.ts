import type { VercelRequest, VercelResponse } from '@vercel/node';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import {
  BLOB_NOT_CONFIGURED_ERROR,
  deleteCaseStudy,
  isProductionRuntime,
  listCaseStudies,
  resolveDownload,
  uploadCaseStudy,
  useBlobStorage,
} from './caseStudyStorage';

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

function json(res: VercelResponse, status: number, payload: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json');
  return res.send(payload);
}

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function normalizeBody(req: VercelRequest): any {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body || {};
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

async function handlerImpl(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (isProductionRuntime() && !useBlobStorage()) {
    return json(res, 503, { success: false, error: BLOB_NOT_CONFIGURED_ERROR });
  }

  if (req.method === 'GET') {
    try {
      if (req.query.action === 'download') {
        const caseStudyId = String(req.query.caseStudyId || '').trim();
        const attachmentId = String(req.query.attachmentId || '').trim();
        if (!caseStudyId) {
          return json(res, 400, { success: false, error: 'Missing caseStudyId' });
        }

        const file = await resolveDownload(caseStudyId, attachmentId || undefined);
        if (!file) {
          return json(res, 404, { success: false, error: 'File not found' });
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
      return json(res, 200, { success: true, caseStudies });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load case studies';
      return json(res, 500, { success: false, error: message });
    }
  }

  if (req.method !== 'POST') {
    return json(res, 405, { success: false, error: 'Method not allowed' });
  }

  try {
    const body = normalizeBody(req);
    const { action, editorEmail, editorPassword } = body as Record<string, string>;

    if (action === 'auth') {
      if (!validateEditor(editorEmail, editorPassword)) {
        return json(res, 401, { success: false, error: 'Invalid editor credentials' });
      }
      return json(res, 200, { success: true });
    }

    if (!validateEditor(editorEmail, editorPassword)) {
      return json(res, 401, { success: false, error: 'Only authorized editors can upload case studies' });
    }

    if (action === 'delete') {
      const caseStudyId = String((body as any).caseStudyId || '').trim();
      if (!caseStudyId) {
        return json(res, 400, { success: false, error: 'Missing caseStudyId for delete' });
      }

      const deleted = await deleteCaseStudy(caseStudyId);
      if (!deleted) {
        return json(res, 404, { success: false, error: 'Case study not found' });
      }
      return json(res, 200, { success: true });
    }

    if (!storageReady()) {
      return json(res, 503, { success: false, error: BLOB_NOT_CONFIGURED_ERROR });
    }

    const {
      title,
      studentName,
      program,
      summary,
      fileName,
      mimeType,
      base64Data,
      attachments = [],
    } = body as any;

    if (!title || !studentName || !program || !summary || !fileName || !mimeType || !base64Data) {
      return json(res, 400, { success: false, error: 'Missing required fields for case study upload' });
    }

    if (summary.trim().length < 20) {
      return json(res, 400, { success: false, error: 'Summary should be at least 20 characters' });
    }

    const binary = Buffer.from(base64Data, 'base64');
    if (!binary.length) {
      return json(res, 400, { success: false, error: 'Uploaded file is empty or invalid' });
    }

    const normalizedAttachments = Array.isArray(attachments)
      ? attachments
          .map((item: any) => ({
            fileName: String(item?.fileName || '').trim(),
            mimeType: String(item?.mimeType || 'application/octet-stream').trim(),
            base64Data: String(item?.base64Data || '').trim(),
          }))
          .filter((item) => item.fileName && item.base64Data)
      : [];

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

    return json(res, 200, { success: true, caseStudy });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload case study';
    return json(res, 500, { success: false, error: message });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await handlerImpl(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'A server error occurred';
    console.error('[case-studies] unhandled error:', error);
    return json(res, 500, {
      success: false,
      error: message,
    });
  }
}
