import speakeasy from 'speakeasy';
import { admin, getDb, json, readJson, normalizeToken, sendSecurityEmail } from './_lib/two-factor.js';

async function legacyHandler(req, context) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { userId, token } = await readJson(req);
    if (!userId || !token) return json({ success: false, error: 'Missing userId or token' }, 400);
    const db = getDb();
    const ref = db.collection('users').doc(userId);
    const snap = await ref.get();
    const u = snap.data() || {};
    if (!u.twoFactorSecret) return json({ success: false, error: '2FA is not enabled.' }, 400);
    const verified = speakeasy.totp.verify({ secret: u.twoFactorSecret, encoding: 'base32', token: normalizeToken(token), window: 1 });
    if (!verified) return json({ success: false, error: 'Invalid code.' });
    await ref.update({ twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [], twoFactorPending: null });
    const msg = 'Two-factor authentication has been disabled on your account.';
    await db.collection('userNotifs').add({ uid: userId, msg, read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    await sendSecurityEmail(u.email, u.name, '2FA disabled on your Starlife account', '2FA has been disabled on your Starlife account. If you did not do this, contact support immediately.');
    return json({ success: true });
  } catch (e) {
    return json({ success: false, error: e.message || 'Could not disable 2FA' }, 500);
  }
};


import { runVercelHandler } from './_lib/vercel-adapter.js';

export async function handle(req, res) {
  return runVercelHandler(req, res, legacyHandler);
}
