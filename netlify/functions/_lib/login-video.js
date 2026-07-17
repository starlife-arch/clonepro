import cloudinaryPkg from 'cloudinary';
import { getDb, admin } from './firebase.js';

const { v2: cloudinary } = cloudinaryPkg;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function isAdminUser(db, uid) {
  if (!uid) return false;
  const snap = await db.collection('users').doc(uid).get();
  const user = snap.data() || {};
  return !!(user.isAdmin || user.adminRole || user.email === process.env.ADMIN_EMAIL);
}

function requireCloudinaryVideoConfig() {
  const cloudName = process.env.CLOUDINARY_VIDEO_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_VIDEO_API_KEY;
  const apiSecret = process.env.CLOUDINARY_VIDEO_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary video environment variables are not configured.');
  }
  return { cloudName, apiKey, apiSecret };
}

function configureCloudinaryVideo() {
  const { cloudName, apiKey, apiSecret } = requireCloudinaryVideoConfig();
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  return cloudinary;
}

function signLoginVideoUpload(params) {
  const { apiSecret } = requireCloudinaryVideoConfig();
  return cloudinary.utils.api_sign_request(params, apiSecret);
}

async function uploadLoginVideoToCloudinary(filePath, publicId) {
  return configureCloudinaryVideo().uploader.upload(filePath, {
    resource_type: 'video',
    folder: 'login-videos',
    public_id: publicId,
    overwrite: true,
    unique_filename: true
  });
}

async function deleteLoginVideoFromCloudinary(publicId) {
  if (!publicId) return;
  await configureCloudinaryVideo().uploader.destroy(publicId, { resource_type: 'video', invalidate: true });
}

export { getDb, admin, json, isAdminUser, requireCloudinaryVideoConfig, signLoginVideoUpload, uploadLoginVideoToCloudinary, deleteLoginVideoFromCloudinary };
