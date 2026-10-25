import { admin, getDb } from './firebase.js';

/** Verify Firebase identity and authorize admins using Firebase claims or Firestore only. */
export async function requireVerifiedAdmin(req, res) {
  const authorization = req.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(String(authorization));
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
  if (claimIsAdmin) return { id: decoded.uid, role: claimRole || 'admin', isAdmin: true };

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
