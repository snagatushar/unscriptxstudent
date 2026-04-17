import { createReadStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { VercelRequest, VercelResponse } from '@vercel/node';
import formidable from 'formidable';
import { getDriveClientWithOAuth, getGoogleAccessToken } from './_lib/google-oauth.js';
import { verifyUserToken, verifyAdmin } from './_lib/auth-util.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const ALLOWED_ORIGIN = process.env.SITE_ORIGIN || 'https://www.unscriptx.com';

function setCors(res: VercelResponse, methods = 'GET,POST,PUT,OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Upload-Url, X-Content-Range, X-Content-Type');
  res.setHeader('Vary', 'Origin');
}

async function getRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function getJsonBody(req: VercelRequest): Promise<any> {
  const body = await getRawBody(req);
  if (!body.length) return {};
  return JSON.parse(body.toString('utf-8'));
}

function sanitize(value: any, fallback: string) {
  return (String(value || '') || fallback).replace(/[^a-zA-Z0-9 ]/g, '').trim() || fallback;
}

function sanitizeRound(rawRound: any) {
  const cleaned = (String(rawRound || '') || 'Round').replace(/_/g, ' ').replace(/qualified/gi, '').trim();
  return cleaned || 'Round';
}

function getFolderIdFromMap(eventTitle: string) {
  const rawMap = process.env.GDRIVE_EVENT_FOLDER_MAP_JSON;
  if (!rawMap) return null;
  try {
    const map = JSON.parse(rawMap) as Record<string, string>;
    return map[eventTitle] || null;
  } catch {
    return null;
  }
}

async function getOrCreateEventFolderId(drive: any, eventTitle: string) {
  const mappedFolderId = getFolderIdFromMap(eventTitle);
  if (mappedFolderId) return mappedFolderId;

  const rootFolderId = process.env.GDRIVE_ROOT_FOLDER_ID;
  const safeTitle = sanitize(eventTitle, 'Event');
  const listResponse = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and '${rootFolderId}' in parents and name='${safeTitle}' and trashed=false`,
    fields: 'files(id,name)',
    pageSize: 1,
  });

  const existing = listResponse.data.files?.[0];
  if (existing?.id) return existing.id;

  const createResponse = await drive.files.create({
    requestBody: {
      name: safeTitle,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [rootFolderId],
    },
    fields: 'id,name',
  });

  return createResponse.data.id;
}

async function getOrCreateSubCategoryFolderId(drive: any, parentFolderId: string, subCategory: string) {
  const safeName = sanitize(subCategory, 'General');
  const listResponse = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and name='${safeName}' and trashed=false`,
    fields: 'files(id,name)',
    pageSize: 1,
  });

  const existing = listResponse.data.files?.[0];
  if (existing?.id) return existing.id;

  const createResponse = await drive.files.create({
    requestBody: {
      name: safeName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id,name',
  });

  return createResponse.data.id;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  try {
    const drive = await getDriveClientWithOAuth();

    // --- Action: View (Proxy Stream) ---
    if (action === 'view') {
      const { fileId } = req.query;
      if (!fileId || typeof fileId !== 'string') return res.status(400).json({ error: 'Missing fileId' });

      const response = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );

      res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp4');
      if (response.headers['content-length']) res.setHeader('Content-Length', response.headers['content-length']);

      (response.data as any).pipe(res);
      return;
    }

    // --- Action: List / Files (Admin) ---
    if (action === 'list' || action === 'files') {
      await verifyAdmin(req);
      const q = action === 'list' 
        ? `mimeType='application/vnd.google-apps.folder' and '${process.env.GDRIVE_ROOT_FOLDER_ID}' in parents and trashed=false`
        : req.query.q as string;

      const listRes = await drive.files.list({
        q,
        fields: 'files(id, name, mimeType, size, createdTime, webViewLink, thumbnailLink)',
        orderBy: 'createdTime desc'
      });
      return res.status(200).json(listRes.data.files || []);
    }

    // --- Action: Init Resumable Upload ---
    if (action === 'init-upload' && req.method === 'POST') {
      await verifyUserToken(req);
      const body = await getJsonBody(req);
      const { eventTitle, userName, round, subCategory, fileName, fileSize, mimeType } = body;

      const origin = req.headers?.origin || ALLOWED_ORIGIN;
      const accessToken = await getGoogleAccessToken();

      // Resolve Folder Chain
      let folderId = await getOrCreateEventFolderId(drive, eventTitle);
      if (subCategory) {
        folderId = await getOrCreateSubCategoryFolderId(drive, folderId, subCategory);
      }

      const safeTitle = sanitize(eventTitle, 'Event');
      const safeFileName = `${sanitize(userName, 'Student')} - ${safeTitle} - ${sanitizeRound(round)} - ${Date.now()}.${fileName?.split('.').pop() || 'mp4'}`;

      const initRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&origin=${encodeURIComponent(origin)}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': mimeType || 'video/mp4',
            ...(fileSize ? { 'X-Upload-Content-Length': String(fileSize) } : {}),
          },
          body: JSON.stringify({ name: safeFileName, parents: [folderId] }),
        }
      );

      return res.status(200).json({ uploadUrl: initRes.headers.get('location'), fileName: safeFileName });
    }

    // --- Action: Chunk Upload (Binary Proxy) ---
    if (action === 'chunk' && req.method === 'PUT') {
      await verifyUserToken(req);
      const uploadUrl = req.headers['x-upload-url'] as string;
      const contentRange = req.headers['x-content-range'] as string;
      
      if (!uploadUrl?.startsWith('https://www.googleapis.com/upload/drive/')) {
        return res.status(400).json({ error: 'Invalid upload URL' });
      }

      const body = await getRawBody(req);
      const driveRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': String(body.length),
          'Content-Range': contentRange,
          'Content-Type': (req.headers['x-content-type'] as string) || 'application/octet-stream',
        },
        body: new Uint8Array(body.buffer, body.byteOffset, body.byteLength) as any,
      });

      if (driveRes.status === 308) {
        return res.status(200).json({ status: 'incomplete', range: driveRes.headers.get('range') });
      }

      const metadata = await driveRes.json();
      return res.status(200).json({ status: 'complete', ...metadata });
    }

    // --- Action: Standard Upload (Multipart / Formidable) ---
    if (action === 'upload' && req.method === 'POST') {
      await verifyUserToken(req);
      const form = formidable({ multiples: false });
      const { fields, files } = await new Promise<any>((resolve, reject) => {
        form.parse(req, (err, fds, fls) => (err ? reject(err) : resolve({ fields: fds, files: fls })));
      });

      const uploaded = Array.isArray(files.file) ? files.file[0] : files.file;
      const stream = createReadStream(uploaded.filepath);

      // Resolve Folder Chain for multipart too
      const eventTitle = fields.eventTitle?.[0] || fields.eventTitle || 'General';
      const subCategory = fields.subCategory?.[0] || fields.subCategory || '';
      let folderId = await getOrCreateEventFolderId(drive, eventTitle);
      if (subCategory) {
        folderId = await getOrCreateSubCategoryFolderId(drive, folderId, subCategory);
      }
      
      const uploadRes = await drive.files.create({
        requestBody: { name: uploaded.originalFilename, parents: [folderId] },
        media: { mimeType: uploaded.mimetype, body: stream },
        fields: 'id, name, mimeType, size'
      });

      await unlink(uploaded.filepath).catch(() => {});
      return res.status(200).json(uploadRes.data);
    }

    return res.status(400).json({ error: `Action ${action} not supported` });
  } catch (error: any) {
    console.error(`Drive Hub Error (${action}):`, error);
    return res.status(500).json({ error: error.message || 'Drive operation failed' });
  }
}
