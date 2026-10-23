import { query } from './postgres.js';

export async function findUser(id) {
  const { rows } = await query('SELECT id, role FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

/**
 * Normal user calls remain owner-only. An admin may operate as the target user only
 * with their own admin identity and a live support-session id bound to that target.
 * Each supported handler invocation is recorded in admin_activity.
 */
export async function requireUser(req, res, expectedUid = req.params.uid) {
  const requesterUid = req.get('x-user-uid');
  const adminUid = req.get('x-admin-uid');
  const supportSessionId = req.get('x-support-session-id');

  if (adminUid && supportSessionId && expectedUid && requesterUid === expectedUid) {
    const admin = await findUser(adminUid);
    if (!admin || admin.role !== 'admin') {
      res.status(401).json({ error: 'Unauthorized admin identity' });
      return null;
    }
    const { rows } = await query(`
      SELECT id, admin_id, target_user_id
      FROM admin_support_sessions
      WHERE id=$1 AND admin_id=$2 AND target_user_id=$3
        AND status='active' AND expires_at > NOW()
    `, [supportSessionId, adminUid, expectedUid]);
    if (!rows[0]) {
      res.status(403).json({ error: 'A valid active support session for this customer is required' });
      return null;
    }
    const route = String(req.originalUrl || req.url || '').split('?')[0].slice(0, 240);
    await query(
      "INSERT INTO admin_activity(admin_id,action,target_user,meta) VALUES($1,'support_session_user_action',$2,$3::jsonb)",
      [adminUid, expectedUid, JSON.stringify({ sessionId:supportSessionId, method:req.method, route })]
    );
    return { id: expectedUid, role: 'user', actedOnBehalfBy: adminUid, supportSessionId };
  }

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
