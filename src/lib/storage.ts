export async function uploadToS3(file: File, folder: string): Promise<{ key: string, publicUrl: string }> {
  const fileType = file.type || 'application/octet-stream';
  const fileName = file.name;

  const token = localStorage.getItem('unscriptx_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // 1. Get presigned URL via Hub
  const response = await fetch('/api/storage-hub?action=presign', {
    method: 'POST',
    headers,
    body: JSON.stringify({ fileName, fileType, folder })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to get upload URL');
  }

  const { uploadUrl, key } = await response.json();

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
  const token = localStorage.getItem('unscriptx_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch('/api/storage-hub?action=delete', {
    method: 'POST',
    headers,
    body: JSON.stringify({ key })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to delete file from S3');
  }
}

export async function openPaymentScreenshot(value: string) {
  if (!value) throw new Error('Payment screenshot path is missing.');

  if (value.startsWith('http')) {
     window.open(value, '_blank', 'noopener,noreferrer');
     return;
  }

  const response = await fetch(`/api/storage-hub?action=view&key=${encodeURIComponent(value)}`);
  
  if (!response.ok) {
     const errorData = await response.json().catch(() => ({}));
     throw new Error(errorData.error || 'Failed to get file URL');
  }

  const { url } = await response.json();
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function openIdCard(value: string) {
  if (!value) throw new Error('ID card path is missing.');

  if (value.startsWith('http')) {
     window.open(value, '_blank', 'noopener,noreferrer');
     return;
  }

  const response = await fetch(`/api/storage-hub?action=view&key=${encodeURIComponent(value)}`);
  
  if (!response.ok) {
     const errorData = await response.json().catch(() => ({}));
     throw new Error(errorData.error || 'Failed to get file URL');
  }

  const { url } = await response.json();
  window.open(url, '_blank', 'noopener,noreferrer');
}
