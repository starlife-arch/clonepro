import speakeasy from 'speakeasy';
import { admin, getDb, json, readJson, normalizeToken, generateBackupCodes } from './_lib/two-factor.js';

export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { userId, token } = await readJson(req);
    if (!userId || !token) return json({ success: false, error: 'Missing userId or token' }, 400);
    const ref = getDb().collection('users').doc(userId);
    const snap = await ref.get();
    const pendingSecret = snap.data()?.twoFactorPending;
    if (!pendingSecret) return json({ success: false, error: 'No pending 2FA setup found.' }, 400);
    const verified = speakeasy.totp.verify({ secret: pendingSecret, encoding: 'base32', token: normalizeToken(token), window: 1 });
    if (!verified) return json({ success: false, error: 'Invalid code. Please try again.' });
    const backupCodes = generateBackupCodes(8);
    await ref.update({ twoFactorEnabled: true, twoFactorSecret: pendingSecret, twoFactorBackupCodes: backupCodes, twoFactorPending: null, twoFactorEnabledAt: admin.firestore.FieldValue.serverTimestamp() });
    return json({ success: true, backupCodes });
  } catch (e) {
    return json({ success: false, error: e.message || 'Could not verify 2FA code' }, 500);
  }
};
