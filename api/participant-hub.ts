import { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from './_lib/db.js';
import { verifyUserToken } from './_lib/auth-util.js';
import { setCors, handlePreflight } from './_lib/cors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (handlePreflight(req, res)) return;

  const { action } = req.query;
  
  try {
    // --- Action: Event Data (GET) ---
    // Make this action accessible even if guest, to show price/rules
    if (action === 'event-data' && req.method === 'GET') {
      const { eventId } = req.query;
      if (!eventId) return res.status(400).json({ error: 'Missing eventId' });

      const eventRes = await query('SELECT * FROM events WHERE id = $1', [eventId]);
      if (eventRes.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
      
      const event = eventRes.rows[0];
      let registeredCategories: string[] = [];
      
      // Try to get user registrations if token is present
      try {
        const decoded = await verifyUserToken(req);
        if (decoded) {
          const regRes = await query('SELECT sub_category FROM registrations WHERE event_id = $1 AND user_id = $2', [eventId, decoded.id]);
          registeredCategories = regRes.rows.map(r => r.sub_category).filter(Boolean);
        }
      } catch (e) {
        // Not logged in or invalid token - just return event details
      }

      return res.status(200).json({ event, registeredCategories });
    }

    // MANDATORY AUTHENTICATION BEYOND THIS POINT
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
        SELECT r.*, 
          COALESCE(r.payment_status, 'pending') as payment_status,
          e.title as event_title, 
          e.category as event_category, 
          e.image_url as event_image_url,
          e.requires_video_submission,
          e.verified_success_message
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
        event_id, participant_name, email, phone, college_name,
        department, year_of_study, team_name, team_size, sub_category,
        team_members, application_form_no, referral_code, user_photo_url
      } = req.body;

      const user_id = userId;

      if (!event_id || !application_form_no || !user_photo_url) {
        return res.status(400).json({ error: 'Missing required registration parameters' });
      }

      // Auto-approve if specific referral code is provided
      const initialStatus = referral_code === 'ifim_unscripTx_2026' ? 'approved' : 'pending';

      const result = await query(
        `INSERT INTO registrations (
          user_id, event_id, participant_name, email, phone, college_name,
          department, year_of_study, team_name, team_size, sub_category,
          team_members, application_form_no, referral_code, user_photo_url, payment_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
        [
          user_id, event_id, participant_name, email, phone, college_name,
          department, year_of_study, team_name, team_size, sub_category,
          JSON.stringify(team_members || []), application_form_no, referral_code, user_photo_url, initialStatus
        ]
      );

      // Sync user profile data
      await query(
        `UPDATE users 
         SET phone = CASE WHEN phone IS NULL OR phone = '' THEN $1 ELSE phone END, 
             college_name = CASE WHEN college_name IS NULL OR college_name = '' THEN $2 ELSE college_name END, 
             full_name = CASE WHEN full_name IS NULL OR full_name = '' THEN $3 ELSE full_name END 
         WHERE id = $4`,
        [phone, college_name, participant_name, user_id]
      );

      return res.status(200).json({ success: true, data: result.rows[0], autoApproved: !!referral_code });
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

    return res.status(400).json({ error: `Action ${action} not supported or method ${req.method} invalid` });
  } catch (error: any) {
    console.error('Participant Hub Error:', error);
    return res.status(500).json({ error: error.message || 'Operation failed' });
  }
}
