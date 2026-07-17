import { getDb, admin } from './firebase.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function isAdminUser(db, uid) {
  if (!uid) return false;
  const snap = await db.collection('users').doc(uid).get();
  const user = snap.data() || {};
  return !!(user.isAdmin || user.adminRole || user.email === process.env.ADMIN_EMAIL);
}

function requireImageKit() {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;
  if (!privateKey || !publicKey || !urlEndpoint) throw new Error('ImageKit environment variables are not configured.');
  return { privateKey, publicKey, urlEndpoint };
}

function imageKitAuth(privateKey) {
  return 'Basic ' + Buffer.from(`${privateKey}:`).toString('base64');
}

async function uploadToImageKit({ fileBuffer, fileName, privateKey }) {
  const form = new FormData();
  form.append('file', new Blob([fileBuffer]), fileName);
  form.append('fileName', fileName);
  form.append('folder', '/login-videos');
  form.append('useUniqueFileName', 'true');
  const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    headers: { Authorization: imageKitAuth(privateKey) },
    body: form
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || 'ImageKit upload failed.');
  return data;
}

async function deleteFromImageKit(fileId, privateKey) {
  if (!fileId) return;
  const res = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: { Authorization: imageKitAuth(privateKey) }
  });
  if (!res.ok && res.status !== 404) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || 'ImageKit delete failed.');
  }
}

export { getDb, admin, json, isAdminUser, requireImageKit, uploadToImageKit, deleteFromImageKit };
