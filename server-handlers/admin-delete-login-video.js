import { getDb, json, isAdminUser, deleteLoginVideoFromCloudinary } from './_lib/login-video.js';

async function legacyHandler(req, context) {
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);
  try {
    const { adminId } = await req.json();
    if (!adminId) return json({ success: false, error: 'Missing admin ID.' }, 400);
    const db = getDb();
    if (!(await isAdminUser(db, adminId))) return json({ success: false, error: 'Admin required.' }, 403);
    const ref = db.collection('platformSettings').doc('loginVideo');
    const snap = await ref.get();
    const data = snap.exists ? snap.data() || {} : {};
    if (data.publicId) await deleteLoginVideoFromCloudinary(data.publicId);
    await ref.delete();
    return json({ success: true });
  } catch (e) {
    console.error('Login video delete failed:', e);
    return json({ success: false, error: e.message || 'Delete failed.' }, 400);
  }
};


import { runVercelHandler } from './_lib/vercel-adapter.js';

export async function handle(req, res) {
  return runVercelHandler(req, res, legacyHandler);
}
