import { getDb, admin } from './_lib/firebase.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const appUrl = () => process.env.SITE_URL || process.env.URL || 'https://starlifeadvert.com';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let userId;
  try {
    const payload = await req.json();
    ({ userId } = payload);
    const { title, body, url, type } = payload;
    if (!userId || !title || !body || !type) return json({ error: 'Missing fields' }, 400);
    const db = getDb();
    const settingsDoc = await db.doc('settings/pushNotifications').get();
    const settings = settingsDoc.data();
    if (settingsDoc.exists && (!settings?.enabled || settings?.types?.[type] === false)) return json({ skipped: true });
    const userDoc = await db.doc(`users/${userId}`).get();
    const fcmToken = userDoc.data()?.fcmToken;
    if (!fcmToken) return json({ skipped: 'no_token' });
    const link = url || `${appUrl()}/#`;
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body, imageUrl: `${appUrl()}/icon-192.png` },
      data: { url: link, type },
      webpush: { notification: { icon: `${appUrl()}/icon-192.png`, badge: `${appUrl()}/icon-72.png`, requireInteraction: false }, fcmOptions: { link } }
    });
    return json({ success: true });
  } catch (err) {
    if (err.code === 'messaging/invalid-registration-token' || err.code === 'messaging/registration-token-not-registered') {
      try { if (userId) await getDb().doc(`users/${userId}`).update({ fcmToken: null, pushEnabled: false }); } catch (_) {}
    }
    return json({ error: err.message }, 500);
  }
};
