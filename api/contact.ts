import { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from './_lib/db.js';
import { setCors, handlePreflight } from './_lib/cors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res, 'POST,OPTIONS');
  if (handlePreflight(req, res)) return;

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, message } = req.body;

  try {
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await query(
      'INSERT INTO contact_messages (name, email, message, status) VALUES ($1, $2, $3, $4)',
      [name, email, message, 'new']
    );

    return res.status(200).json({ success: true, message: 'Message sent successfully' });
  } catch (err: any) {
    console.error('Contact API Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to send message' });
  }
}
