import { api } from './api';

export async function uploadToS3(file: File, folder: string, customPrefix?: string): Promise<{ key: string, publicUrl: string }> {
  const fileType = file.type || 'application/octet-stream';
  let fileName = file.name;

  if (customPrefix) {
    const extension = file.name.split('.').pop() || 'png';
    fileName = `${customPrefix}.${extension}`;
  }

  // 1. Get presigned URL via Hub
  const { uploadUrl, key } = await api.post<{uploadUrl: string, key: string}>('/api/storage-hub?action=presign', { fileName, fileType, folder });

  // 2. Upload file directly to S3
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': fileType },
    body: file
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload file to S3');
  }

  return { key, publicUrl: `/api/storage-hub?action=view&key=${encodeURIComponent(key)}` };
}

export async function deleteFromS3(key: string): Promise<void> {
  await api.post('/api/storage-hub?action=delete', { key });
}

export async function openPaymentScreenshot(value: string) {
  if (!value) throw new Error('Payment screenshot path is missing.');

  if (value.startsWith('http')) {
     window.open(value, '_blank', 'noopener,noreferrer');
     return;
  }

  if (value.startsWith('/api/')) {
     window.open(value, '_blank', 'noopener,noreferrer');
     return;
  }

  // If it's just the raw S3 key, construct the view URL
  window.open(`/api/storage-hub?action=view&key=${encodeURIComponent(value)}`, '_blank', 'noopener,noreferrer');
}

export async function openIdCard(value: string) {
  if (!value) throw new Error('ID card path is missing.');

  if (value.startsWith('http')) {
     window.open(value, '_blank', 'noopener,noreferrer');
     return;
  }

  if (value.startsWith('/api/')) {
     window.open(value, '_blank', 'noopener,noreferrer');
     return;
  }

  // If it's just the raw S3 key, construct the view URL
  window.open(`/api/storage-hub?action=view&key=${encodeURIComponent(value)}`, '_blank', 'noopener,noreferrer');
}
