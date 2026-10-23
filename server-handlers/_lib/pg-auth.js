import { query } from './postgres.js';
import { admin, getDb } from './firebase.js';

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

/** Verify Firebase identity and authorize admins.
 * Firebase custom claims are signed by Firebase and can authorize without a Firestore read.
 * If the token has no admin claim, fall back to the Firestore user document.
 * Never trust UID headers alone.
 */
export async function requireVerifiedAdmin(req, res) {
  const authorization = req.get('authorization') || '';
  const match = /^Bearer\\s+(.+)$/i.exec(String(authorization));
  const adminUid = req.get('x-admin-uid');
  if (!match || !adminUid) {
    res.status(401).json({ error: 'A valid Firebase ID token and admin identity are required' });
    return null;
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(match[1]);
  } catch (error) {
    console.warn('[firebase-auth] ID token verification failed:', error.message);
    res.status(401).json({ error: 'Invalid or expired Firebase ID token' });
    return null;
  }

  if (decoded.uid !== adminUid) {
    res.status(401).json({ error: 'Authenticated identity does not match admin identity' });
    return null;
  }

  const claimRole = decoded.adminRole || decoded.role;
  const claimIsAdmin = decoded.isAdmin === true ||
    ['admin', 'superadmin'].includes(String(claimRole || '').toLowerCase());
  if (claimIsAdmin) {
    return { id: decoded.uid, role: claimRole || 'admin', isAdmin: true };
  }

  try {
    const db = getDb();
    const snap = await db.collection('users').doc(decoded.uid).get();
    const user = snap.exists ? snap.data() : {};
    const role = user.adminRole || user.role;
    const isAdmin = user.isAdmin === true ||
      ['admin', 'superadmin'].includes(String(role || '').toLowerCase());
    if (!snap.exists || !isAdmin) {
      res.status(403).json({ error: 'Administrator access required' });
      return null;
    }
    return { id: decoded.uid, ...user, role: role || 'admin' };
  } catch (error) {
    console.error('[firebase-auth] Firestore admin lookup failed:', error.message);
    res.status(503).json({ error: 'Could not verify administrator in Firestore' });
    return null;
  }
}
