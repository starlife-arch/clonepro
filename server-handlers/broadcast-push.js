import { getDb, admin } from './_lib/firebase.js';
import { isAdminUser } from './_lib/predictions.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const appUrl = () => process.env.SITE_URL || process.env.URL || 'https://starlifeadvert.com';

async function netlifyHandler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { adminId, title, body, url } = await req.json();
    if (!adminId || !title || !body) return json({ error: 'Missing fields' }, 400);
    const db = getDb();
    if (!(await isAdminUser(db, adminId))) return json({ error: 'Admin required' }, 403);
    const settingsDoc = await db.doc('settings/pushNotifications').get();
    const settings = settingsDoc.data();
    if (settingsDoc.exists && (!settings?.enabled || settings?.types?.broadcast === false)) return json({ sent: 0, skipped: true });
    const snap = await db.collection('users').where('pushEnabled', '==', true).get();
    const users = snap.docs.map(d => d.data()).filter(u => u.fcmToken);
    const tokens = users.map(u => u.fcmToken);
    let sent = 0;
    const link = url || `${appUrl()}/#`;
    for (let i = 0; i < tokens.length; i += 500) {
      const chunk = tokens.slice(i, i + 500);
      const res = await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        notification: { title, body },
        data: { url: link, type: 'broadcast' },
        webpush: { notification: { icon: `${appUrl()}/icon-192.png`, badge: `${appUrl()}/icon-72.png` }, fcmOptions: { link } }
      });
      sent += res.successCount;
    }
    return json({ success: true, sent });
  } catch (err) { return json({ error: err.message }, 500); }
};


import { runNetlifyHandler } from './_lib/vercel-adapter.js';

export default async function handler(req, res) {
  return runNetlifyHandler(req, res, netlifyHandler);
}
