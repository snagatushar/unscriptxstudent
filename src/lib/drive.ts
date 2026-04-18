async function getToken() {
  return localStorage.getItem('unscriptx_token') || '';
}

export interface UploadToDriveParams {
  file: File;
  eventTitle: string;
  userId: string;
  registrationId: string;
  round: string;
  userName: string;
  subCategory?: string | null;
  onProgress?: (percent: number) => void;
}

/**
 * 4 MB chunks — must be a multiple of 256 KB (Google Drive requirement).
 * Stays well under Vercel's 4.5 MB serverless body limit.
 */
const CHUNK_SIZE = 4 * 1024 * 1024;

/**
 * Chunked upload flow that works around BOTH:
 *   1. Vercel's 4.5 MB serverless payload limit
 *   2. Google Drive CORS restrictions (browser never talks to googleapis.com)
 *
 * Phase 1 — POST /api/drive-init-upload
 *           Server creates a Google Drive resumable upload session.
 *           Returns the resumable upload URL (only metadata, ~1 KB).
 *
 * Phase 2 — For each 4 MB chunk of the file:
 *           PUT /api/drive-upload-chunk
 *           Our serverless function proxies the chunk to Google Drive.
 *           Each request is under Vercel's limit and goes through our domain.
 */
export async function uploadVideoToDrive(params: UploadToDriveParams) {
  const { file, eventTitle, userId, registrationId, round, userName, subCategory, onProgress } = params;

  // ── Phase 1: Initiate the resumable upload ──────────────────────────────
  const token = await getToken();
  const initRes = await fetch('/api/drive-hub?action=init-upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      eventTitle,
      userId,
      registrationId,
      round,
      userName,
      subCategory: subCategory || undefined,
      mimeType: file.type || 'application/octet-stream',
      fileName: file.name,
      fileSize: file.size,
    }),
  });

  if (!initRes.ok) {
    const errBody = await initRes.json().catch(() => ({}));
    throw new Error(errBody?.error || `Failed to initiate upload (${initRes.status})`);
  }

  const { uploadUrl, fileName } = await initRes.json();

  // ── Phase 2: Send file in chunks through our proxy ───────────────────────
  const totalSize = file.size;
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
  let offset = 0;

  for (let i = 0; i < totalChunks; i++) {
    const start = offset;
    const end = Math.min(start + CHUNK_SIZE, totalSize) - 1;
    const chunk = file.slice(start, end + 1);
    const contentRange = `bytes ${start}-${end}/${totalSize}`;

    const chunkRes = await fetch('/api/drive-hub?action=chunk', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'X-Upload-Url': uploadUrl,
        'X-Content-Range': contentRange,
        'X-Content-Type': file.type || 'application/octet-stream',
      },
      body: chunk,
    });

    if (!chunkRes.ok) {
      const err = await chunkRes.json().catch(() => ({}));
      throw new Error(err?.error || `Chunk ${i + 1}/${totalChunks} failed (HTTP ${chunkRes.status})`);
    }

    const result = await chunkRes.json();
    offset = end + 1;

    // Update progress (stepped per chunk)
    if (onProgress) {
      const percent = Math.min(100, Math.round(((end + 1) / totalSize) * 100));
      onProgress(percent);
    }

    // Google returned 200 — upload complete
    if (result.status === 'complete') {
      if (onProgress) onProgress(100);
      return {
        fileId: result.id || result.fileId,
        fileName: result.fileName || fileName,
        mimeType: result.mimeType || file.type || 'application/octet-stream',
        size: result.size?.toString() || file.size.toString(),
        createdTime: result.createdTime || new Date().toISOString(),
      };
    }

    // result.status === 'incomplete' → continue to next chunk
  }

  throw new Error('Upload completed all chunks but did not receive completion response from Google Drive');
}

/**
 * Returns an authenticated blob URL for streaming a Drive video.
 * The JWT token is sent as a Bearer header — NOT as a URL query param —
 * so it never appears in browser history, server logs, or Referer headers.
 */
export async function getDriveStreamUrl(fileId: string): Promise<string> {
  if (!fileId) {
    throw new Error('Missing file id');
  }
  const token = await getToken();
  // Fetch the video stream through our authenticated proxy
  const response = await fetch(`/api/drive-hub?action=view&fileId=${encodeURIComponent(fileId)}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to load video (HTTP ${response.status})`);
  }
  const blob = await response.blob();
  // Create a temporary object URL — revoked automatically when the component unmounts
  return URL.createObjectURL(blob);
}

export async function getEventDriveFiles(eventTitle: string) {
  const token = await getToken();
  const url = `/api/drive-hub?action=files&q=${encodeURIComponent(`'${process.env.GDRIVE_ROOT_FOLDER_ID}' in parents and name contains '${eventTitle}' and trashed=false`)}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch event files from Drive');
  }
  return response.json() as Promise<{ files: any[] }>;
}
