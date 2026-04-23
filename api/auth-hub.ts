import { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from './_lib/db.js';
import { setCors, handlePreflight } from './_lib/cors.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { buildGoogleAuthUrl, createOAuthClient, USER_IDENTITY_SCOPE, DRIVE_SCOPE } from './_lib/google-oauth.js';
import { verifyAdmin } from './_lib/auth-util.js';
import { google } from 'googleapis';

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}







export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (handlePreflight(req, res)) return;

  try {
    // Auto-detect google-callback if 'code' is present but 'action' is missing (for clean Redirect URIs)
    const action = req.query.action || (req.query.code ? 'google-callback' : null);

    // 1. Signup, Login, Me... (Standard handlers)
    if (action === 'signup' && req.method === 'POST') {
      const body = req.body || {};
      const { email, password, name } = body;

      // SECURITY FIX (H4): Validate required fields
      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
      }

      // SECURITY FIX (H4): Validate email format
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // SECURITY FIX (H1): Enforce minimum password strength
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      const domain = email?.split('@')[1]?.toLowerCase();
      if (domain) {
        const blockedRes = await query('SELECT domain FROM blocked_domains WHERE domain = $1', [domain]);
        if (blockedRes.rows.length > 0) return res.status(400).json({ error: 'Temporary or disposable emails are not allowed.' });
      }

      const existing = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
      if (existing.rows.length > 0) return res.status(400).json({ error: 'Email already exists' });

      const hashedPassword = await bcrypt.hash(password, 10);
      const insertRes = await query(
        `INSERT INTO users (id, full_name, email, role, password_hash) VALUES (gen_random_uuid(), $1, $2, 'user', $3) RETURNING id, full_name, email, role, phone, college_name`,
        [name || email, email, hashedPassword]
      );
      const user = insertRes.rows[0];
      const token = jwt.sign({ id: user.id, email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      return res.status(200).json({ success: true, token, user });
    }

    if (action === 'login' && req.method === 'POST') {
      const body = req.body || {};
      const { email, password } = body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const result = await query('SELECT id, email, role, password_hash FROM users WHERE LOWER(email) = LOWER($1)', [email]);
      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Email not found. Please sign up first.' });
      }

      const user = result.rows[0];
      const isValid = await bcrypt.compare(password, user.password_hash || '');
      if (!isValid) {
        return res.status(400).json({ error: 'Incorrect password. Please try again.' });
      }

      // Fetch full profile for immediate frontend sync
      const profile = await query('SELECT id, email, role, full_name, phone, college_name FROM users WHERE id = $1', [user.id]);
      const fullUser = profile.rows[0];

      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      return res.status(200).json({ success: true, token, user: fullUser });
    }

    if (action === 'me') {
      const body = req.body || {};
      const token = body?.token || req.headers.authorization?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ error: 'No token provided' });
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const result = await query('SELECT id, email, role, full_name, phone, college_name FROM users WHERE id = $1', [decoded.id]);
      if (result.rows.length === 0) return res.status(401).json({ error: 'User no longer exists' });
      return res.status(200).json({ success: true, user: result.rows[0] });
    }

    if (action === 'reset-password' && req.method === 'POST') {
      let body = req.body || {};
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { /* ignore */ }
      }
      
      const email = (body.email || '').trim().toLowerCase();
      if (!email) return res.status(400).json({ error: 'Email (recipient) is required for reset' });

      // 1. Verify user exists
      const result = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
      if (result.rows.length === 0) {
        return res.status(400).json({ error: `Account not found: ${email}. Please check spelling or sign up.` });
      }
      const user = result.rows[0];

      // 2. Generate secure reset token (Stateless JWT)
      const resetToken = jwt.sign(
        { id: user.id, email: email.toLowerCase(), type: 'password-reset' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      // 3. Dispatch real email via AWS SES
      const { sendResetEmail } = await import('./_lib/ses-util.js');
      let origin = (process.env.SITE_ORIGIN || 'https://www.unscriptx.com').replace(/^["']|["']$/g, '').trim();
      const resetLink = `${origin}/#/reset-password?token=${resetToken}`;
      try {
        await sendResetEmail(email, resetLink);
        return res.status(200).json({ success: true, message: 'Password reset link sent to your inbox' });
      } catch (err: any) {
        console.error('Email Failure Details:', {
          message: err.message,
          email
        });
        return res.status(500).json({ 
          error: `Failed to send email: ${err.message}.` 
        });
      }
    }

    if (action === 'update-password' && req.method === 'POST') {
      const body = req.body || {};
      const { password, token } = body;

      if (!password || !token) return res.status(400).json({ error: 'Missing password or verification token' });

      // SECURITY FIX (H1): Enforce minimum password strength on reset
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      try {
        // 1. Verify token
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded.type !== 'password-reset') throw new Error('Invalid token type');

        // 2. Hash new password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. Update DB
        const resDb = await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, decoded.id]);
        if (resDb.rowCount === 0) throw new Error('User not found in database');

        return res.status(200).json({ success: true, message: 'Password updated successfully' });
      } catch (err: any) {
        console.error('Update password error:', err.message);
        // SECURITY FIX (H3): Don't leak internal error details to client
        return res.status(400).json({ error: 'Failed to update password. The reset link may be invalid or expired.' });
      }
    }

    // 2. Google OAuth: Flow Initiation
    if (action === 'google-login' || action === 'user-google-login') {
      const statePrefix = action === 'google-login' ? 'admin' : 'user';
      const state = `${statePrefix}:${randomBytes(16).toString('hex')}`;

      const existingToken = req.query.token || '';
      const finalState = existingToken ? `${state}:${existingToken}` : state;

      res.setHeader('Set-Cookie', `google_oauth_state=${state}; HttpOnly; Path=/; SameSite=Lax; Max-Age=300`);

      // Determine scopes: Admins connecting drive need both identity + drive. Students only need identity.
      const scopes = (statePrefix === 'admin') ? [...USER_IDENTITY_SCOPE, ...DRIVE_SCOPE] : USER_IDENTITY_SCOPE;

      return res.redirect(buildGoogleAuthUrl(finalState, { scopes }));
    }

    // 3. Google OAuth: Unified Callback
    if (action === 'google-callback') {
      const { code, state, error } = req.query;
      if (error) return res.redirect('/login?error=' + encodeURIComponent(String(error)));

      const savedState = req.cookies?.google_oauth_state;
      // SECURITY FIX (M1): Strict OAuth state validation — the saved state must be an exact prefix up to the ':' delimiter
      const stateStr = String(state || '');
      if (!stateStr || !savedState || !(stateStr === savedState || stateStr.startsWith(savedState + ':'))) {
        return res.status(400).send('Invalid state parameter');
      }

      const oauth2Client = createOAuthClient();
      const { tokens } = await oauth2Client.getToken(String(code));
      oauth2Client.setCredentials(tokens);

      const ticket = await oauth2Client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      const payload = ticket.getPayload();
      if (!payload?.email) throw new Error('No email in Google profile');

      // Flow A: Student Login
      if (String(state).startsWith('user:')) {
        let userResult = await query('SELECT id, email, role FROM users WHERE LOWER(email) = LOWER($1)', [payload.email]);
        let user = userResult.rows[0];

        if (!user) {
          const insertRes = await query(
            "INSERT INTO users (id, email, full_name, role) VALUES (gen_random_uuid(), $1, $2, 'user') RETURNING id, role",
            [payload.email, payload.name || payload.email]
          );
          user = insertRes.rows[0];
        }

        const token = jwt.sign({ id: user.id, email: payload.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        return res.redirect(`/login?token=${token}`);
      }

      // Flow B: Admin Connect Drive
      if (String(state).startsWith('admin:')) {
        const parts = String(state).split(':');
        const adminToken = parts[2];

        if (!adminToken) return res.status(401).send('Admin session missing');
        const decodedAdmin = jwt.verify(adminToken, JWT_SECRET) as any;

        const sql = `
          INSERT INTO google_oauth_tokens (id, access_token, refresh_token, scope, token_type, expiry_date, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            access_token = EXCLUDED.access_token,
            refresh_token = COALESCE(EXCLUDED.refresh_token, google_oauth_tokens.refresh_token),
            scope = EXCLUDED.scope,
            token_type = EXCLUDED.token_type,
            expiry_date = EXCLUDED.expiry_date,
            updated_at = EXCLUDED.updated_at
        `;
        await query(sql, [
          'google_drive_owner', tokens.access_token, tokens.refresh_token,
          tokens.scope, tokens.token_type, tokens.expiry_date, new Date().toISOString()
        ]);

        return res.redirect('/admin?success=google_connected');
      }
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error: any) {
    // SECURITY FIX (H3): Don't leak internal error details to client
    console.error('Auth Hub Error:', error);
    return res.status(500).json({ error: 'An internal error occurred. Please try again.' });
  }
}
