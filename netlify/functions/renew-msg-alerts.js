import { getDb, admin } from './_lib/firebase.js';

async function sendMsgAlertEmail(type, to, data) {
  if (!to) return;
  const siteUrl = process.env.URL || process.env.SITE_URL || 'http://localhost:8888';
  const response = await fetch(`${siteUrl}/.netlify/functions/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-token': process.env.EMAIL_API_TOKEN || '' },
    body: JSON.stringify({ type, to, data, fromKey: 'noreply' }),
  });
  if (!response.ok) throw new Error(`send-email failed with ${response.status}`);
}

export default async (req, context) => {
  const db = getDb();
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const newExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const snapshot = await db.collection('users')
    .where('msgEmailAlerts.expiresAt', '>=', admin.firestore.Timestamp.fromDate(todayStart))
    .where('msgEmailAlerts.expiresAt', '<=', admin.firestore.Timestamp.fromDate(todayEnd))
    .get();
  let renewed = 0, paused = 0, skipped = 0;
  for (const doc of snapshot.docs) {
    const user = doc.data() || {};
    const alerts = user.msgEmailAlerts || {};
    if (alerts.cancelledAt) { skipped++; continue; }
    const name = user.name || user.username || 'Member';
    if (alerts.adminGranted) {
      await doc.ref.update({
        'msgEmailAlerts.active': true,
        'msgEmailAlerts.expiresAt': admin.firestore.Timestamp.fromDate(newExpiry),
        'msgEmailAlerts.lastRenewedAt': admin.firestore.FieldValue.serverTimestamp(),
        'msgEmailAlerts.lastFailedAt': null,
      });
      await db.collection('userNotifs').add({ uid: doc.id, msg: '🎁 Message Email Alerts free admin-granted period extended for another 30 days.', read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      renewed++; continue;
    }
    if (Number(user.balance || 0) >= 10) {
      await doc.ref.update({
        balance: admin.firestore.FieldValue.increment(-10),
        'msgEmailAlerts.active': true,
        'msgEmailAlerts.expiresAt': admin.firestore.Timestamp.fromDate(newExpiry),
        'msgEmailAlerts.lastRenewedAt': admin.firestore.FieldValue.serverTimestamp(),
        'msgEmailAlerts.lastFailedAt': null,
        'msgEmailAlerts.totalPaid': admin.firestore.FieldValue.increment(10),
      });
      await db.collection('activity').add({ uid: doc.id, desc: 'Message Email Alerts renewal — $10.00', amt: -10, icon: '💬', type: 'subscription', createdAt: admin.firestore.FieldValue.serverTimestamp() });
      await db.collection('userNotifs').add({ uid: doc.id, msg: '✅ Message Email Alerts renewed for another 30 days. $10.00 deducted from your wallet.', read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      try { await sendMsgAlertEmail('msg_alerts_renewed', user.email, { name, newExpiryDate: newExpiry.toLocaleDateString() }); } catch (e) { console.error('[msg alerts renewal email] failed', e); }
      renewed++;
    } else {
      await doc.ref.update({ 'msgEmailAlerts.active': false, 'msgEmailAlerts.lastFailedAt': admin.firestore.FieldValue.serverTimestamp() });
      await db.collection('userNotifs').add({ uid: doc.id, msg: '⚠️ Your Message Email Alerts subscription has paused. Your wallet had insufficient funds. Top up $10 to resume.', read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      try { await sendMsgAlertEmail('msg_alerts_paused', user.email, { name }); } catch (e) { console.error('[msg alerts paused email] failed', e); }
      paused++;
    }
  }
  return new Response(JSON.stringify({ success: true, renewed, paused, skipped }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
