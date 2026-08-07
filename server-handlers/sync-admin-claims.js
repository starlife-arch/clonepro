import { getDb, admin } from './_lib/firebase.js';

const ADMIN_ROLES = new Set(['superadmin', 'finance', 'support', 'moderator', 'operations']);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

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

async function setClaims(uid, adminRole, isAdmin) {
  if (!uid || typeof uid !== 'string') throw Object.assign(new Error('Valid uid required'), { status: 400 });
  const role = adminRole || null;
  if (role && !ADMIN_ROLES.has(role)) throw Object.assign(new Error('Invalid admin role'), { status: 400 });
  const user = await admin.auth().getUser(uid);
  const existing = user.customClaims || {};
  await admin.auth().setCustomUserClaims(uid, { ...existing, adminRole: role, isAdmin: !!isAdmin });
}

async function legacyHandler(request) {
  if (request.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);
  const db = getDb();
  try {
    await requireSuperAdmin(db, request);
    const { uid, adminRole, isAdmin } = await request.json();
    await setClaims(uid, adminRole, isAdmin);
    return json({ success: true });
  } catch (error) {
    return json({ success: false, error: error.message || 'Could not sync admin claims' }, error.status || 500);
  }
};


import { runVercelHandler } from './_lib/vercel-adapter.js';

export default async function handler(req, res) {
  return runVercelHandler(req, res, legacyHandler);
}
