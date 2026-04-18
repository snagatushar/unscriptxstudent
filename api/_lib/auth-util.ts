import jwt from 'jsonwebtoken';
import { query } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}

export async function verifyUserToken(req: any) {
  let token = req.headers?.authorization?.replace('Bearer ', '');
  if (!token && req.query?.token) {
    token = req.query.token as string;
  }
  if (!token) throw new Error('Unauthorized: Missing bearer token in headers (' + (req.url || 'unknown path') + ')');

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    // Minimal user object to match expected shape
    return { id: decoded.id, email: decoded.email, role: decoded.role };
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
