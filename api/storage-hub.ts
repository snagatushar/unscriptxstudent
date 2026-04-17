import { VercelRequest, VercelResponse } from '@vercel/node';
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from './_lib/s3-client.js';
import { verifyUserToken } from './_lib/auth-util.js';
import { setCors, handlePreflight } from './_lib/cors.js';

const MIME_ALLOW_LIST = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'application/pdf',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (handlePreflight(req, res)) return;

  const { action } = req.query;

  try {
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('AWS_S3_BUCKET_NAME is not configured');
    }

    // --- Action: Presign (POST) ---
    if (action === 'presign' && req.method === 'POST') {
      await verifyUserToken(req);
      const { fileName, fileType, folder = 'general' } = req.body;

      if (!fileName || !fileType) {
        return res.status(400).json({ error: 'Missing fileName or fileType' });
      }

      if (!MIME_ALLOW_LIST.includes(fileType)) {
        return res.status(403).json({ error: `File type ${fileType} is not allowed.` });
      }

      const key = `${folder}/${Date.now()}-${fileName}`;
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: fileType,
      });

      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      return res.status(200).json({ uploadUrl, key });
    }

    // --- Action: View (GET) ---
    if (action === 'view' && req.method === 'GET') {
      const { key } = req.query;

      if (!key || typeof key !== 'string') {
        return res.status(400).json({ error: 'Missing object key' });
      }

      // Authorization Logic for specific folders
      if (key.startsWith('evidence/') || key.startsWith('submissions/')) {
        await verifyUserToken(req);
      }

      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      return res.status(200).json({ url });
    }

    // --- Action: Delete (POST/DELETE) ---
    if ((action === 'delete') && (req.method === 'POST' || req.method === 'DELETE')) {
      await verifyUserToken(req); // Only authenticated users can delete
      const key = req.method === 'POST' ? req.body.key : req.query.key;

      if (!key) {
        return res.status(400).json({ error: 'Missing object key to delete' });
      }

      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      await s3Client.send(command);
      return res.status(200).json({ success: true, message: 'Object deleted successfully' });
    }

    return res.status(404).json({ error: `Action ${action} not found or method ${req.method} not supported` });
  } catch (error: any) {
    console.error(`S3 Hub Error (${action}):`, error);
    const status = error.message?.includes('Unauthorized') ? 401 : 500;
    return res.status(status).json({ error: error.message || 'Internal server error' });
  }
}
