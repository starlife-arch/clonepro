import { query } from './postgres.js';

export async function findUser(id) {
  const { rows } = await query('SELECT id, role FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function requireUser(req, res, expectedUid = req.params.uid) {
  const requesterUid = req.get('x-user-uid');
  if (!requesterUid || requesterUid !== expectedUid) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  const user = await findUser(requesterUid);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return user;
}

export async function requireAdmin(req, res, expectedUid) {
  const adminUid = req.get('x-admin-uid');
  if (!adminUid || (expectedUid && adminUid !== expectedUid)) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  const admin = await findUser(adminUid);
  if (!admin || admin.role !== 'admin') {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return admin;
}
