import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { getDb, json, readJson, formatManualKey } from './_lib/two-factor.js';

export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { userId, userEmail } = await readJson(req);
    if (!userId || !userEmail) return json({ error: 'Missing userId or userEmail' }, 400);
    const secret = speakeasy.generateSecret({ name: `Starlife (${userEmail})`, issuer: 'Starlife' });
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);
    await getDb().collection('users').doc(userId).set({ twoFactorPending: secret.base32 }, { merge: true });
    return json({ qrCode: qrCodeDataUrl, manualKey: formatManualKey(secret.base32), accountName: userEmail, issuer: 'Starlife' });
  } catch (e) {
    return json({ error: e.message || 'Could not generate 2FA secret' }, 500);
  }
};
