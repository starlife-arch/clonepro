import { getDb, admin } from './_lib/firebase.js';

function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }
function normalizePhone(phone) {
  const cleaned = String(phone || '').replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('254') && cleaned.length === 12) return cleaned;
  if (cleaned.startsWith('0') && cleaned.length === 10) return '254' + cleaned.slice(1);
  if (cleaned.startsWith('+254') && cleaned.length === 13) return cleaned.slice(1);
  if (cleaned.length === 9) return '254' + cleaned;
  return null;
}

async function legacyHandler(req, context) {
  try {
    const { message, adminId } = await req.json();
    if (!message || !message.trim()) return json({ error: 'Message required' }, 400);
    const db = getDb();
    const smsBody = `Starlife: ${message.trim().slice(0, 100)}`.slice(0, 160);
    const snap = await db.collection('users').where('phone', '!=', null).get();
    const phones = [...new Set(snap.docs.map(d => normalizePhone(d.data().phone)).filter(Boolean))];
    if (!phones.length) return json({ success: true, totalUsers: 0, totalSent: 0, totalFailed: 0, batches: 0, message: 'No users with phone numbers' });
    const batches = [];
    for (let i = 0; i < phones.length; i += 50) batches.push(phones.slice(i, i + 50));
    let totalSent = 0, totalFailed = 0;
    for (const batch of batches) {
      try {
        const response = await fetch('https://nenasolutions.co.ke/v1/api/sms/send', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.NENA_API_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: batch.join(','), message: smsBody })
        });
        const data = await response.json().catch(() => ({}));
        totalSent += data.data?.accepted?.length || (response.ok ? batch.length : 0);
        totalFailed += data.data?.skipped?.length || (response.ok ? 0 : batch.length);
        await new Promise(r => setTimeout(r, 300));
      } catch (e) { console.error('Batch SMS error:', e); totalFailed += batch.length; }
    }
    await db.collection('smsBroadcastLogs').add({ message: smsBody, totalUsers: phones.length, totalSent, totalFailed, batches: batches.length, sentAt: admin.firestore.FieldValue.serverTimestamp(), sentBy: adminId || null });
    return json({ success: true, totalUsers: phones.length, totalSent, totalFailed, batches: batches.length });
  } catch (err) { console.error('Broadcast SMS error:', err); return json({ error: err.message }, 500); }
};


import { runVercelHandler } from './_lib/vercel-adapter.js';

export default async function handler(req, res) {
  return runVercelHandler(req, res, legacyHandler);
}
