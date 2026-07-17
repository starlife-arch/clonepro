import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getDb, admin, json, isAdminUser, uploadLoginVideoToCloudinary, deleteLoginVideoFromCloudinary } from './_lib/login-video.js';

const MAX_DURATION_SECONDS = 120;
const MAX_SIZE_BYTES = 100 * 1024 * 1024;

function safeBaseName(name) {
  return String(name || `login-video-${Date.now()}`).replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) || `login-video-${Date.now()}`;
}

async function saveUploadedLoginVideo({ db, adminId, uploaded, duration, name }) {
  const serverDuration = Number(uploaded.duration || duration || 0);
  if (serverDuration > MAX_DURATION_SECONDS) {
    await deleteLoginVideoFromCloudinary(uploaded.public_id);
    return json({ success: false, error: 'Video is too long. Maximum length is 2 minutes (120 seconds).' }, 400);
  }

  const settingsRef = db.collection('platformSettings').doc('loginVideo');
  const previousSnap = await settingsRef.get();
  const previous = previousSnap.exists ? previousSnap.data() || {} : {};
  if (previous.publicId && previous.publicId !== uploaded.public_id) {
    try { await deleteLoginVideoFromCloudinary(previous.publicId); } catch (e) { console.warn('old login video delete failed', e.message); }
  }

  const payload = {
    videoUrl: uploaded.secure_url || uploaded.url,
    publicId: uploaded.public_id,
    name: name || uploaded.original_filename || 'login-video',
    duration: serverDuration,
    uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
    uploadedBy: adminId
  };
  await settingsRef.set(payload, { merge: false });
  return json({ success: true, loginVideo: { ...payload, uploadedAt: new Date().toISOString() } });
}

export default async (req, context) => {
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);
  let tmpDir = '';
  try {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const { adminId, uploaded, duration, name } = await req.json();
      if (!adminId) return json({ success: false, error: 'Missing admin ID.' }, 400);
      const db = getDb();
      if (!(await isAdminUser(db, adminId))) return json({ success: false, error: 'Admin required.' }, 403);
      if (!uploaded?.public_id || !(uploaded.secure_url || uploaded.url)) return json({ success: false, error: 'Missing uploaded video details.' }, 400);
      return saveUploadedLoginVideo({ db, adminId, uploaded, duration, name });
    }

    const form = await req.formData();
    const adminId = String(form.get('adminId') || '');
    const clientDuration = Number(form.get('duration') || 0);
    const file = form.get('video');
    if (!adminId) return json({ success: false, error: 'Missing admin ID.' }, 400);
    const db = getDb();
    if (!(await isAdminUser(db, adminId))) return json({ success: false, error: 'Admin required.' }, 403);
    if (!file || typeof file.arrayBuffer !== 'function') return json({ success: false, error: 'Choose a video file to upload.' }, 400);
    if (!String(file.type || '').startsWith('video/')) return json({ success: false, error: 'Only video files are allowed.' }, 400);
    if (file.size > MAX_SIZE_BYTES) return json({ success: false, error: 'Video is too large. Please upload a shorter compressed file.' }, 400);
    if (!Number.isFinite(clientDuration) || clientDuration <= 0) return json({ success: false, error: 'Could not verify video duration. Please choose a valid video file.' }, 400);
    if (clientDuration > MAX_DURATION_SECONDS) return json({ success: false, error: 'Video is too long. Maximum length is 2 minutes (120 seconds).' }, 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    tmpDir = await mkdtemp(join(tmpdir(), 'login-video-'));
    const filePath = join(tmpDir, String(file.name || 'login-video.mp4').replace(/[^a-zA-Z0-9._-]/g, '-'));
    await writeFile(filePath, buffer);
    const uploaded = await uploadLoginVideoToCloudinary(filePath, `${safeBaseName(file.name)}-${Date.now()}`);
    return saveUploadedLoginVideo({ db, adminId, uploaded, duration: clientDuration, name: file.name });
  } catch (e) {
    console.error('Login video upload failed:', e);
    return json({ success: false, error: e.message || 'Upload failed.' }, 400);
  } finally {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
};
