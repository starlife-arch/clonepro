import { getDb, json, readJson, formatManualKey, base32Secret, otpauthUrl, qrCodeUrl } from './_lib/two-factor.js';

async function legacyHandler(req, context) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { userId, userEmail } = await readJson(req);
    if (!userId || !userEmail) return json({ error: 'Missing userId or userEmail' }, 400);
    const secret = base32Secret();
    const issuer = 'Starlife';
    const url = otpauthUrl({ secret, accountName: userEmail, issuer });
    await getDb().collection('users').doc(userId).set({ twoFactorPending: secret }, { merge: true });
    return json({ qrCode: qrCodeUrl(url), otpauthUrl: url, manualKey: formatManualKey(secret), accountName: userEmail, issuer });
  } catch (e) {
    return json({ error: e.message || 'Could not generate 2FA secret' }, 500);
  }
};


import { runVercelHandler } from './_lib/vercel-adapter.js';

export default async function handler(req, res) {
  return runVercelHandler(req, res, legacyHandler);
}
