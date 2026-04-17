import { VercelResponse } from '@vercel/node';

const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://www.unscriptx.com';

export function setCors(res: VercelResponse, methods = 'GET,POST,PUT,DELETE,OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', SITE_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Upload-Url, X-Content-Range, X-Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
}

export function handlePreflight(req: { method?: string }, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}
