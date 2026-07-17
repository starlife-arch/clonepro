import { getDb, json, isAdminUser, requireImageKit, deleteFromImageKit } from './_lib/login-video.js';

export default async (req, context) => {
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);
  try {
    const { privateKey } = requireImageKit();
    const { adminId } = await req.json();
    if (!adminId) return json({ success: false, error: 'Missing admin ID.' }, 400);
    const db = getDb();
    if (!(await isAdminUser(db, adminId))) return json({ success: false, error: 'Admin required.' }, 403);
    const ref = db.collection('platformSettings').doc('loginVideo');
    const snap = await ref.get();
    const data = snap.exists ? snap.data() || {} : {};
    if (data.fileId) await deleteFromImageKit(data.fileId, privateKey);
    await ref.delete();
    return json({ success: true });
  } catch (e) {
    return json({ success: false, error: e.message || 'Delete failed.' }, 400);
  }
};
