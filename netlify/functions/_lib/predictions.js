import { getDb, admin } from './firebase.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const cents = (n) => Math.floor(Number(n || 0) * 100) / 100;
const todayKey = () => new Date().toISOString().slice(0, 10);
const siteUrl = () => process.env.URL || process.env.SITE_URL || 'https://starlifeadvert.netlify.app';

async function sendPredictionEmail(type, to, data) {
  if (!to) return;
  try {
    await fetch(`${siteUrl()}/.netlify/functions/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-token': process.env.EMAIL_API_TOKEN || '' },
      body: JSON.stringify({ type, to, data, fromKey: 'games' })
    });
  } catch (e) { console.warn('prediction email failed', type, e.message); }
}

function asDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  return new Date(value);
}

async function isAdminUser(db, uid) {
  if (!uid) return false;
  const snap = await db.collection('users').doc(uid).get();
  const u = snap.data() || {};
  return !!u.isAdmin || u.email === process.env.ADMIN_EMAIL;
}

export { getDb, admin, json, cents, todayKey, sendPredictionEmail, asDate, isAdminUser };
