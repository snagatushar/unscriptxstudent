import { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from './_lib/db.js';
import { verifyUserToken } from './_lib/auth-util.js';
import { setCors, handlePreflight } from './_lib/cors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (handlePreflight(req, res)) return;

  const { action } = req.query;

  try {
    const decoded = await verifyUserToken(req);
    const userId = decoded.id;

    // --- Action: Profile (GET) ---
    if (action === 'profile' && req.method === 'GET') {
      const result = await query('SELECT id, full_name, email, role, phone, college_name FROM users WHERE id = $1', [userId]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      return res.status(200).json(result.rows[0]);
    }

    // --- Action: Registrations (GET) ---
    if (action === 'registrations' && req.method === 'GET') {
      const result = await query(`
        SELECT r.*, e.title as event_title, e.category as event_category, e.image_url as event_image_url
        FROM registrations r
        JOIN events e ON r.event_id = e.id
        WHERE r.user_id = $1
        ORDER BY r.created_at DESC
      `, [userId]);
      
      const regs = result.rows;
      for (let reg of regs) {
        const subs = await query('SELECT * FROM submissions WHERE registration_id = $1 ORDER BY created_at DESC', [reg.id]);
        reg.submissions = subs.rows;
      }
      return res.status(200).json(regs);
    }

    // --- Action: Register (POST) ---
    if (action === 'register' && req.method === 'POST') {
      const {
        user_id, event_id, participant_name, email, phone, college_name,
        department, year_of_study, team_name, team_size, sub_category,
        team_members, payment_screenshot_url, id_card_url
      } = req.body;

      if (!user_id || !event_id || !payment_screenshot_url || !id_card_url) {
        return res.status(400).json({ error: 'Missing required registration parameters' });
      }

      const result = await query(
        `INSERT INTO registrations (
          user_id, event_id, participant_name, email, phone, college_name,
          department, year_of_study, team_name, team_size, sub_category,
          team_members, payment_screenshot_url, id_card_url, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pending') RETURNING *`,
        [
          user_id, event_id, participant_name, email, phone, college_name,
          department, year_of_study, team_name, team_size, sub_category,
          JSON.stringify(team_members || []), payment_screenshot_url, id_card_url
        ]
      );

      // Sync user profile data
      await query(
        `UPDATE users SET phone = $1, college_name = $2, full_name = $3 WHERE id = $4`,
        [phone, college_name, participant_name, user_id]
      );

      return res.status(200).json({ success: true, data: result.rows[0] });
    }

    // --- Action: Submission (POST) ---
    if (action === 'submission' && req.method === 'POST') {
      const { registrationId, round, videoUrl, notes } = req.body;
      const regCheck = await query('SELECT id FROM registrations WHERE id = $1 AND user_id = $2', [registrationId, userId]);
      if (regCheck.rows.length === 0) return res.status(403).json({ error: 'Forbidden' });

      const result = await query(
        'INSERT INTO submissions (id, registration_id, round, video_url, video_path, notes, status) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6) RETURNING *',
        [registrationId, round, videoUrl, videoUrl, notes || null, 'submitted']
      );
      return res.status(200).json(result.rows[0]);
    }

    // --- Action: Event Data (GET) ---
    if (action === 'event-data' && req.method === 'GET') {
      const result = await query('SELECT e.title, COUNT(r.id) as registration_count FROM events e LEFT JOIN registrations r ON e.id = r.event_id GROUP BY e.id');
      return res.status(200).json(result.rows);
    }

    return res.status(400).json({ error: `Action ${action} not supported or method ${req.method} invalid` });
  } catch (error: any) {
    console.error('Participant Hub Error:', error);
    return res.status(500).json({ error: error.message || 'Operation failed' });
  }
}
