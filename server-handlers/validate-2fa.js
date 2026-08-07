import { getDb, json, readJson, normalizeToken, verifyTotp } from './_lib/two-factor.js';

async function legacyHandler(req, context) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { userId, token } = await readJson(req);
    if (!userId || !token) return json({ success: false, error: 'Missing userId or token' }, 400);
    const ref = getDb().collection('users').doc(userId);
    const snap = await ref.get();
    const data = snap.data() || {};
    const clean = normalizeToken(token);
    const codes = Array.isArray(data.twoFactorBackupCodes) ? data.twoFactorBackupCodes : [];
    const match = codes.find(c => normalizeToken(c) === clean);
    if (match) {
      await ref.update({ twoFactorBackupCodes: codes.filter(c => c !== match) });
      return json({ success: true, usedBackup: true });
    }
    if (!data.twoFactorSecret) return json({ success: false, error: '2FA is not enabled.' }, 400);
    const verified = verifyTotp({ secret: data.twoFactorSecret, token: clean, window: 1 });
    return json(verified ? { success: true } : { success: false, error: 'Invalid code.' });
  } catch (e) {
    return json({ success: false, error: e.message || 'Could not validate 2FA code' }, 500);
  }
};


import { runVercelHandler } from './_lib/vercel-adapter.js';

export async function handle(req, res) {
  return runVercelHandler(req, res, legacyHandler);
}
