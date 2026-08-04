import { getDb, admin } from './firebase.js';
import { sendTelegramMessage } from './telegram.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const cents = (n) => Math.round(Number(n || 0) * 100) / 100;
const siteUrl = () => process.env.URL || process.env.SITE_URL || 'https://starlifeadvert.netlify.app';
const money = (n) => `$${cents(n).toFixed(2)}`;


async function sendSMSFromServer(phone, message) {
  if (!phone || !message) return;
  try {
    await fetch(`${siteUrl()}/.netlify/functions/send-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: phone, message })
    });
  } catch (e) { console.warn('SMS send failed:', e); }
}

async function sendEmail(type, to, data, fromKey = 'transfers') {
  if (!to) return;
  await fetch(`${siteUrl()}/.netlify/functions/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-token': process.env.EMAIL_API_TOKEN || '' },
    body: JSON.stringify({ type, to, data, fromKey })
  }).catch(e => console.warn('email failed', type, e.message));
}

function publicMember(uid, u) {
  const joined = u.createdAt?.toDate ? u.createdAt.toDate().toISOString().slice(0, 10) : '';
  return {
    uid,
    memberId: u.memberId || u.memberCode || String(uid).slice(0, 8).toUpperCase(),
    name: u.name || u.fullName || u.displayName || 'Member',
    joined,
    country: u.country || '',
    verified: !!(u.verified || u.blueBadge || u.isVerified),
    vipLevel: u.vipLevel || u.vip || '',
    totalInvested: cents(u.totalInvested || 0),
    shareholderStake: cents(u.shareholderStake || u.stakeBalance || 0),
    totalEarned: cents(u.totalEarned || u.shareholderEarned || 0)
  };
}

async function creditPlatform(db, amount, note, txRef) {
  if (!amount) return;
  const logRef = db.collection('platformAccountLogs').doc();
  await db.runTransaction(async t => {
    t.set(db.collection('platformAccounts').doc('operations'), { balance: admin.firestore.FieldValue.increment(cents(amount)), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    t.set(logRef, { account: 'operations', type: amount >= 0 ? 'credit' : 'debit', amount: Math.abs(cents(amount)), note, txRef, createdAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: 'system' });
  });
}

async function notifyReversal(db, transfer, stage, decision = '') {
  const [fromSnap, toSnap] = await Promise.all([db.collection('users').doc(transfer.fromUid).get(), db.collection('users').doc(transfer.toUid).get()]);
  const from = fromSnap.data() || {}, to = toSnap.data() || {};
  const amount = money(transfer.amount), received = money(transfer.received), txId = transfer.txId || transfer.id;
  const requesterName = from.name || transfer.fromName || 'Member';
  const recipientName = to.name || transfer.toName || 'Member';
  if (stage === 'requested') {
    await sendEmail('reversal_requested_sender', from.email, { name: requesterName, transactionId: txId, amount: transfer.amount, amountText: amount, counterparty: recipientName });
    await sendEmail('reversal_requested_receiver', to.email, { name: recipientName, transactionId: txId, amount: transfer.received, amountText: received, counterparty: requesterName, actionUrl: siteUrl() });
    if (to.phone) await sendSMSFromServer(to.phone, `Starlife: ${requesterName} requested a reversal of ${received} on transfer ${txId}. Login to approve or reject.`);
    await sendTelegramMessage(`↩️ <b>Transfer reversal requested</b>\nTX: ${txId}\nAmount: ${received}\nRequester: ${requesterName}\nRecipient: ${recipientName}`).catch(()=>{});
  } else {
    const approved = decision === 'approved';
    if (approved) {
      await sendEmail('reversal_approved_sender', from.email, { name: requesterName, transactionId: txId, amount: transfer.amount, amountText: amount, counterparty: recipientName });
      await sendEmail('reversal_approved_receiver', to.email, { name: recipientName, transactionId: txId, amount: transfer.received, amountText: received, counterparty: requesterName });
      if (from.phone) await sendSMSFromServer(from.phone, `Starlife: Reversal approved. ${amount} has been returned to your wallet. Ref: ${txId}.`);
      if (to.phone) await sendSMSFromServer(to.phone, `Starlife: Reversal approved. ${received} deducted from your wallet and returned to ${requesterName}. Ref: ${txId}.`);
    } else {
      await sendEmail('reversal_rejected_sender', from.email, { name: requesterName, transactionId: txId, amount: transfer.received, amountText: received, counterparty: recipientName });
      await sendEmail('reversal_rejected_receiver', to.email, { name: recipientName, transactionId: txId, amount: transfer.received, amountText: received, counterparty: requesterName });
      if (from.phone) await sendSMSFromServer(from.phone, `Starlife: Your reversal request for ${txId} was declined. Contact support if needed.`);
    }
    await sendTelegramMessage(`↩️ <b>Transfer reversal ${decision}</b>\nTX: ${txId}\nAmount: ${received}\nRequester: ${requesterName}\nRecipient: ${recipientName}`).catch(()=>{});
  }
}

export { getDb, admin, json, cents, money, publicMember, creditPlatform, notifyReversal, sendSMSFromServer };
