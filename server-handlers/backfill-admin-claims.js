import { getDb, admin } from './_lib/firebase.js';

function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }); }

async function requireSuperAdmin(db, request) {
  const authHeader = request.headers.get('authorization') || '';
  const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!idToken) throw Object.assign(new Error('Auth token required'), { status: 401 });
  const decoded = await admin.auth().verifyIdToken(idToken);
  if (decoded.adminRole === 'superadmin') return decoded;
  const snap = await db.collection('users').doc(decoded.uid).get();
  const u = snap.data() || {};
  if (u.email === process.env.ADMIN_EMAIL || (u.isAdmin && u.adminRole === 'superadmin')) return decoded;
  throw Object.assign(new Error('Super Admin required'), { status: 403 });
}

async function legacyHandler(request) {
  if (request.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);
  const db = getDb();
  try {
    await requireSuperAdmin(db, request);
    const snap = await db.collection('users').where('isAdmin', '==', true).get();
    let updated = 0;
    for (const doc of snap.docs) {
      const u = doc.data() || {};
      const authUser = await admin.auth().getUser(doc.id);
      await admin.auth().setCustomUserClaims(doc.id, { ...(authUser.customClaims || {}), isAdmin: true, adminRole: u.email === process.env.ADMIN_EMAIL ? 'superadmin' : (u.adminRole || 'support') });
      updated++;
    }
    return json({ success: true, updated });
  } catch (error) {
    return json({ success: false, error: error.message || 'Could not backfill admin claims' }, error.status || 500);
  }
};


import { runVercelHandler } from './_lib/vercel-adapter.js';

export async function handle(req, res) {
  return runVercelHandler(req, res, legacyHandler);
}
