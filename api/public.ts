import { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from './_lib/db.js';
import { setCors, handlePreflight } from './_lib/cors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res, 'GET,OPTIONS');
  if (handlePreflight(req, res)) return;

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { resource, slug, id } = req.query;

  try {
    if (resource === 'events') {
      if (slug) {
        const result = await query('SELECT * FROM events WHERE slug = $1 AND is_active = true', [slug]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
        return res.status(200).json(result.rows[0]);
      }
      if (id) {
        const result = await query('SELECT * FROM events WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
        return res.status(200).json(result.rows[0]);
      }
      
      const result = await query(`
        SELECT e.*, 
          (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) as participants_count
        FROM events e 
        WHERE e.is_active = true 
        ORDER BY e.created_at DESC
      `);
      return res.status(200).json(result.rows);
    }

    if (resource === 'faculty') {
      const result = await query('SELECT * FROM faculty ORDER BY id DESC');
      return res.status(200).json(result.rows);
    }

    if (resource === 'site_content') {
      const keys = req.query.keys ? (req.query.keys as string).split(',') : [];
      if (keys.length > 0) {
        const result = await query('SELECT * FROM site_content WHERE content_key = ANY($1)', [keys]);
        return res.status(200).json(result.rows);
      }
      const result = await query('SELECT * FROM site_content');
      return res.status(200).json(result.rows);
    }

    if (resource === 'hero_slides') {
      const result = await query('SELECT * FROM hero_slideshow ORDER BY display_order ASC');
      return res.status(200).json(result.rows);
    }

    if (resource === 'event_results') {
      const { target_event_id } = req.query;
      if (!target_event_id) return res.status(400).json({ error: 'Missing target_event_id' });
      
      const result = await query(`
        SELECT participant_name, team_name, qualification_stage
        FROM registrations 
        WHERE event_id = $1 AND (payment_status = 'approved' OR qualification_stage != 'not_started')
        ORDER BY qualification_stage DESC, created_at ASC
      `, [target_event_id]);
      
      return res.status(200).json(result.rows);
    }

    if (resource === 'committee') {
       const result = await query('SELECT * FROM committee ORDER BY display_order ASC');
       return res.status(200).json(result.rows);
    }

    if (resource === 'general_rules') {
       const result = await query('SELECT * FROM general_rules ORDER BY display_order ASC');
       return res.status(200).json(result.rows);
    }

    return res.status(400).json({ error: 'Invalid resource' });
  } catch (err: any) {
    console.error('Public API Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch public data' });
  }
}
