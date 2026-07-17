import { getDb, admin, json, isAdminUser, requireImageKit, uploadToImageKit, deleteFromImageKit } from './_lib/login-video.js';

const MAX_DURATION_SECONDS = 120;
const MAX_SIZE_BYTES = 100 * 1024 * 1024;

export default async (req, context) => {
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);
  try {
    const { privateKey } = requireImageKit();
    const form = await req.formData();
    const adminId = String(form.get('adminId') || '');
    const duration = Number(form.get('duration') || 0);
    const file = form.get('video');
    if (!adminId) return json({ success: false, error: 'Missing admin ID.' }, 400);
    const db = getDb();
    if (!(await isAdminUser(db, adminId))) return json({ success: false, error: 'Admin required.' }, 403);
    if (!file || typeof file.arrayBuffer !== 'function') return json({ success: false, error: 'Choose a video file to upload.' }, 400);
    if (!String(file.type || '').startsWith('video/')) return json({ success: false, error: 'Only video files are allowed.' }, 400);
    if (file.size > MAX_SIZE_BYTES) return json({ success: false, error: 'Video is too large. Please upload a shorter compressed file.' }, 400);
    if (!Number.isFinite(duration) || duration <= 0) return json({ success: false, error: 'Could not verify video duration. Please choose a valid video file.' }, 400);
    if (duration > MAX_DURATION_SECONDS) return json({ success: false, error: 'Video is too long. Maximum length is 2 minutes (120 seconds).' }, 400);

    const settingsRef = db.collection('platformSettings').doc('loginVideo');
    const previousSnap = await settingsRef.get();
    const previous = previousSnap.exists ? previousSnap.data() || {} : {};
    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = String(file.name || `login-video-${Date.now()}.mp4`).replace(/[^a-zA-Z0-9._-]/g, '-');
    const uploaded = await uploadToImageKit({ fileBuffer: buffer, fileName: safeName, privateKey });
    if (previous.fileId) {
      try { await deleteFromImageKit(previous.fileId, privateKey); } catch (e) { console.warn('old login video delete failed', e.message); }
    }
    const payload = {
      videoUrl: uploaded.url,
      fileId: uploaded.fileId,
      name: uploaded.name || safeName,
      duration,
      uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
      uploadedBy: adminId
    };
    await settingsRef.set(payload, { merge: false });
    return json({ success: true, loginVideo: { ...payload, uploadedAt: new Date().toISOString() } });
  } catch (e) {
    return json({ success: false, error: e.message || 'Upload failed.' }, 400);
  }
};
