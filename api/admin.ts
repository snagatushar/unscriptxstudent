import { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from './_lib/db.js';
import { setCors, handlePreflight } from './_lib/cors.js';

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (handlePreflight(req, res)) return;

  const { action, table, record, id } = req.body || {};
  
  // JWT Role Verification
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin' && decoded.role !== 'payment_reviewer' && decoded.role !== 'content_reviewer') {
      return res.status(403).json({ error: 'Permission denied. Admin, content_reviewer, or reviewer role required.' });
    }
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const ALLOWED_TABLES = [
    'events', 'registrations', 'users', 'internal_reviews', 'submissions', 
    'site_content', 'committee', 'faculty', 'general_rules', 
    'hero_slideshow', 'blocked_domains', 'contact_messages', 'reviewer_event_assignments', 'audit_logs'
  ];

  const validateTable = (t: string) => {
    if (!t || !ALLOWED_TABLES.includes(t)) {
      throw new Error(`Invalid or unauthorized table: ${t}`);
    }
    return t;
  };

  try {
    if (req.method === 'GET') {
      const { resource } = req.query;
      
      // Multi-table views (handled separately from generic tables)
      if (resource === 'payment_review_data' || resource === 'content_review_data' || resource === 'registrations_detailed') {
        const isPayment = resource === 'payment_review_data';
        const isDetailed = resource === 'registrations_detailed';
        let assignedEventIds: string[] = [];
        
        // Non-admins can only see their assigned events
        if (decoded.role !== 'admin' && !isDetailed) {
          const assignments = await query(
            'SELECT event_id FROM reviewer_event_assignments WHERE reviewer_id = $1 AND role_type = $2',
            [decoded.id, isPayment ? 'payment' : 'judge']
          );
          assignedEventIds = assignments.rows.map(a => a.event_id);
          if (assignedEventIds.length === 0) return res.status(200).json([]);
        }

        const regQuery = `
          SELECT 
            r.*,
            u.full_name as participant_user_name,
            u.email as participant_user_email,
            e.title as event_title,
            e.category as event_category,
            e.entry_fee as event_entry_fee,
            e.requires_team_details as event_requires_team_details,
            (
              SELECT json_agg(s_data)
              FROM (
                SELECT s.*, 
                  (SELECT json_agg(ir) FROM internal_reviews ir WHERE ir.submission_id = s.id) as internal_reviews
                FROM submissions s 
                WHERE s.registration_id = r.id 
                ORDER BY s.created_at DESC
              ) s_data
            ) as submissions
          FROM registrations r
          JOIN users u ON r.user_id = u.id
          JOIN events e ON r.event_id = e.id
          ${decoded.role !== 'admin' && !isDetailed ? `WHERE r.event_id = ANY($1)` : ''}
          ORDER BY r.created_at DESC
        `;
        
        const regsRes = await query(regQuery, decoded.role !== 'admin' && !isDetailed ? [assignedEventIds] : []);
        return res.status(200).json(regsRes.rows);
      }
      
      if (resource === 'audit_logs_detailed') {
         if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
         const data = await query(`
           SELECT a.*, u.full_name as actor_name, u.email as actor_email, u.role as actor_role
           FROM audit_logs a
           LEFT JOIN users u ON a.actor_id = u.id
           ORDER BY a.created_at DESC
           LIMIT 200
         `);
         return res.status(200).json(data.rows);
      }
      
      // Generic list handler with safety check
      if (typeof resource === 'string' && ALLOWED_TABLES.includes(resource)) {
          const safeTable = resource;
          const queryStr = safeTable === 'users'
            ? 'SELECT id, email, role, full_name, phone, college_name, created_at FROM users ORDER BY created_at DESC'
            : `SELECT * FROM ${safeTable} ORDER BY ${safeTable === 'events' ? 'created_at' : 'id'} DESC`;
          const data = await query(queryStr);
          return res.status(200).json(data.rows);
      }
    }

    if (req.method === 'POST') {
      const safeTable = validateTable(table);

      // RBAC check for modifications
      let assignedEventIds: string[] = [];
      if (decoded.role !== 'admin') {
         // Pre-fetch assignments for row-level verification
         const isPayment = decoded.role === 'payment_reviewer';
         const assignments = await query(
            'SELECT event_id FROM reviewer_event_assignments WHERE reviewer_id = $1 AND role_type = $2',
            [decoded.id, isPayment ? 'payment' : 'content_reviewer']
         );
         assignedEventIds = assignments.rows.map(a => a.event_id);

         // Content Reviewers can only touch internal_reviews or submissions (marks)
         if (decoded.role === 'content_reviewer') {
            if (safeTable !== 'internal_reviews' && safeTable !== 'submissions') {
               return res.status(403).json({ error: 'Content Reviewers can only manage reviews and submissions.' });
            }
         }
         // Payment reviewers can only touch registrations
         else if (decoded.role === 'payment_reviewer') {
            if (safeTable !== 'registrations') {
               return res.status(403).json({ error: 'Payment reviewers can only manage registrations.' });
            }
         }
      }

      if (action === 'delete') {
         if (decoded.role !== 'admin') return res.status(403).json({ error: 'Only admins can delete records.' });

         // Cascade deletions manually to prevent PostgreSQL foreign key constraint violations
         if (safeTable === 'registrations') {
             await query(`DELETE FROM internal_reviews WHERE submission_id IN (SELECT id FROM submissions WHERE registration_id = $1)`, [id]);
             await query(`DELETE FROM submissions WHERE registration_id = $1`, [id]);
         } else if (safeTable === 'events') {
             await query(`DELETE FROM internal_reviews WHERE submission_id IN (SELECT id FROM submissions WHERE registration_id IN (SELECT id FROM registrations WHERE event_id = $1))`, [id]);
             await query(`DELETE FROM submissions WHERE registration_id IN (SELECT id FROM registrations WHERE event_id = $1)`, [id]);
             await query(`DELETE FROM reviewer_event_assignments WHERE event_id = $1`, [id]);
             await query(`DELETE FROM registrations WHERE event_id = $1`, [id]);
         }

         await query(`DELETE FROM ${safeTable} WHERE id = $1`, [id]);
         return res.status(200).json({ success: true });
      }

      if (action === 'update' || action === 'upsert' || action === 'insert') {
         // Row-Level Verification for Non-Admins
         if (decoded.role !== 'admin') {
            // For registrations or internal_reviews, ensure event_id matches assignment
            let targetEventId: string | null = null;
            
            if (safeTable === 'registrations') {
               const check = await query('SELECT event_id FROM registrations WHERE id = $1', [id || record.id]);
               targetEventId = check.rows[0]?.event_id;
            } else if (safeTable === 'internal_reviews' || safeTable === 'submissions') {
               const regId = record.registration_id || (record.submission_id ? (await query('SELECT registration_id FROM submissions WHERE id = $1', [record.submission_id])).rows[0]?.registration_id : null);
               if (regId) {
                  const check = await query('SELECT event_id FROM registrations WHERE id = $1', [regId]);
                  targetEventId = check.rows[0]?.event_id;
               }
            }

            if (targetEventId && !assignedEventIds.includes(targetEventId)) {
               return res.status(403).json({ error: 'Permission denied: This record belongs to an event you are not assigned to.' });
            }
         }

         if (action === 'update') {
            const keys = Object.keys(record);
            const values = Object.values(record);
            const setStr = keys.map((k, i) => {
               if (!/^[a-z0-9_]+$/.test(k)) throw new Error("Invalid field name");
               return `${k} = $${i+2}`;
            }).join(', ');
            await query(`UPDATE ${safeTable} SET ${setStr} WHERE id = $1`, [id || record.id, ...values]);
            return res.status(200).json({ success: true });
         }

         if (action === 'upsert') {
            const { conflict_target } = req.body;
            const keys = Object.keys(record);
            const values = Object.values(record);
            const valsStr = keys.map((_, i) => `$${i+1}`).join(', ');
            const updateStr = keys.map((k, i) => {
                if (!/^[a-z0-9_]+$/.test(k)) throw new Error("Invalid field name");
                return `${k} = EXCLUDED.${k}`;
            }).join(', ');
            if (conflict_target && !/^[a-z0-9_]+$/.test(conflict_target)) throw new Error("Invalid conflict target");
            const q = `INSERT INTO ${safeTable} (${keys.join(', ')}) VALUES (${valsStr}) ON CONFLICT (${conflict_target || 'id'}) DO UPDATE SET ${updateStr} RETURNING *`;
            const result = await query(q, values);
            return res.status(200).json({ success: true, data: result.rows[0] });
         }

         if (action === 'insert') {
            const keys = Object.keys(record);
            const values = Object.values(record);
            const valsStr = keys.map((_, i) => `$${i+1}`).join(', ');
            const result = await query(`INSERT INTO ${safeTable} (${keys.join(', ')}) VALUES (${valsStr}) RETURNING *`, values);
            return res.status(200).json({ success: true, data: result.rows[0] });
         }
      }

      if (action === 'update_role') {
         if (decoded.role !== 'admin') return res.status(403).json({ error: 'Only admins can change roles.' });
         const { email, role } = req.body;
         await query(`UPDATE users SET role = $1 WHERE email = $2`, [role, email]);
         return res.status(200).json({ success: true });
      }
    }
    return res.status(400).json({ error: 'Invalid request' });
  } catch (err: any) {
    console.error('API Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
