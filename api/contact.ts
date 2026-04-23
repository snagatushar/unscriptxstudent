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

    // SECURITY FIX (M2): Enforce input length limits to prevent abuse
    if (typeof name !== 'string' || name.length > 200) {
      return res.status(400).json({ error: 'Name must be 200 characters or fewer' });
    }
    if (typeof email !== 'string' || email.length > 320) {
      return res.status(400).json({ error: 'Email must be 320 characters or fewer' });
    }
    if (typeof message !== 'string' || message.length > 5000) {
      return res.status(400).json({ error: 'Message must be 5000 characters or fewer' });
    }

    // SECURITY FIX (M2): Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    await query(
      'INSERT INTO contact_messages (name, email, message, status) VALUES ($1, $2, $3, $4)',
      [name, email, message, 'new']
    );

    return res.status(200).json({ success: true, message: 'Message sent successfully' });
  } catch (err: any) {
    // SECURITY FIX (H3): Don't leak internal error details to client
    console.error('Contact API Error:', err);
    return res.status(500).json({ error: 'Failed to send message' });
  }
}
