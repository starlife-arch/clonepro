import { query } from './_lib/postgres.js';

export default async function pgAdminSetRole(req, res) {
  if (!process.env.MIGRATION_SECRET || req.get('x-migration-secret') !== process.env.MIGRATION_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { uid, role } = req.body || {};
  if (!uid || !['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: "uid and role ('admin' or 'user') are required" });
  }

  try {
    const { rowCount } = await query('UPDATE users SET role = $2 WHERE id = $1', [uid, role]);
    if (rowCount === 0) return res.status(404).json({ error: 'User not found', uid });
    return res.json({ success: true, uid, role });
  } catch (error) {
    console.error('[pg] admin set-role failed', { uid, role, error });
    return res.status(500).json({ error: 'Server error' });
  }
}
