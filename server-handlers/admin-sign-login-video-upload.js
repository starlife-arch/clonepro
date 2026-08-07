import { getDb, json, isAdminUser, requireCloudinaryVideoConfig, signLoginVideoUpload } from './_lib/login-video.js';

async function legacyHandler(req, context) {
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);
  try {
    const { adminId, fileName } = await req.json();
    if (!adminId) return json({ success: false, error: 'Missing admin ID.' }, 400);
    const db = getDb();
    if (!(await isAdminUser(db, adminId))) return json({ success: false, error: 'Admin required.' }, 403);

    const { cloudName, apiKey } = requireCloudinaryVideoConfig();
    const timestamp = Math.floor(Date.now() / 1000);
    const safeName = String(fileName || `login-video-${Date.now()}`)
      .replace(/\.[^.]*$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .slice(0, 80) || `login-video-${Date.now()}`;
    const paramsToSign = {
      folder: 'login-videos',
      public_id: `${safeName}-${Date.now()}`,
      timestamp
    };

    return json({
      success: true,
      cloudName,
      apiKey,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
      params: {
        ...paramsToSign,
        signature: signLoginVideoUpload(paramsToSign)
      }
    });
  } catch (e) {
    console.error('Login video signature failed:', e);
    return json({ success: false, error: e.message || 'Could not prepare upload.' }, 400);
  }
};


import { runVercelHandler } from './_lib/vercel-adapter.js';

export default async function handler(req, res) {
  return runVercelHandler(req, res, legacyHandler);
}
