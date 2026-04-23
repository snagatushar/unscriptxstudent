import jwt from 'jsonwebtoken';
import { query } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}

export async function verifyUserToken(req: any) {
  // SECURITY FIX (M4): Only accept tokens from Authorization header, not query strings
  // (query params get logged in server access logs and browser history)
  const token = req.headers?.authorization?.replace('Bearer ', '');
  if (!token) throw new Error('Unauthorized: Missing bearer token');

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    
    // Fetch the CURRENT role from the database instead of trusting the JWT snapshot,
    // because role changes don't update existing JWT tokens.
    const userResult = await query('SELECT role FROM users WHERE id = $1', [decoded.id]);
    const currentRole = userResult.rows[0]?.role || decoded.role;
    
    // Minimal user object to match expected shape
    return { id: decoded.id, email: decoded.email, role: currentRole };
  } catch (err) {
    throw new Error('Invalid token');
  }
}

export async function verifyAdminOrJudge(req: any) {
  const user = await verifyUserToken(req);
  if (user.role !== 'admin' && user.role !== 'judge' && user.role !== 'payment_reviewer') {
     throw new Error('Insufficient permissions. Admin, judge, or reviewer role required.');
  }
  return user;
}

export async function verifyAdmin(req: any) {
  const user = await verifyUserToken(req);
  if (user.role !== 'admin') {
     throw new Error('Requires admin role');
  }
  return user;
}
