import { getDb, admin } from './firebase.js';
import { sendTelegramMessage } from './telegram.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const cents = (n) => Math.round(Number(n || 0) * 100) / 100;
const siteUrl = () => process.env.URL || process.env.SITE_URL || 'https://starlifeadvert.netlify.app';
const money = (n) => `$${cents(n).toFixed(2)}`;

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
  if (stage === 'requested') {
    await sendEmail('transaction_notice', from.email, { name: from.name || transfer.fromName, direction: 'sent', transactionType: 'Transfer reversal request', transactionId: txId, amount: transfer.amount, amountText: amount, status: 'Pending recipient review', counterparty: transfer.toName });
    await sendEmail('transaction_notice', to.email, { name: to.name || transfer.toName, direction: 'received', transactionType: 'Transfer reversal requested', transactionId: txId, amount: transfer.received, amountText: received, status: 'Action required', counterparty: transfer.fromName });
    await sendTelegramMessage(`↩️ <b>Transfer reversal requested</b>\nTX: ${txId}\nAmount: ${amount}\nSender: ${transfer.fromName}\nReceiver: ${transfer.toName}`).catch(()=>{});
  } else {
    const approved = decision === 'approved';
    await sendEmail('transaction_notice', from.email, { name: from.name || transfer.fromName, direction: 'received', transactionType: 'Transfer reversal ' + decision, transactionId: txId, amount: transfer.amount, amountText: amount, status: approved ? 'Refunded in full' : 'Declined', counterparty: transfer.toName });
    await sendEmail('transaction_notice', to.email, { name: to.name || transfer.toName, direction: 'sent', transactionType: 'Transfer reversal ' + decision, transactionId: txId, amount: transfer.received, amountText: received, status: approved ? 'Deducted from held funds' : 'No funds moved', counterparty: transfer.fromName });
    await sendTelegramMessage(`↩️ <b>Transfer reversal ${decision}</b>\nTX: ${txId}\nAmount: ${amount}\nSender: ${transfer.fromName}\nReceiver: ${transfer.toName}`).catch(()=>{});
  }
}

export { getDb, admin, json, cents, money, publicMember, creditPlatform, notifyReversal };
