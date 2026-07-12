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
  const requesterName = from.name || transfer.fromName || 'Member';
  const recipientName = to.name || transfer.toName || 'Member';
  if (stage === 'requested') {
    await sendEmail('transaction_notice', from.email, { name: requesterName, title: `Transfer Reversal Requested — ${txId}`, message: `Your reversal request for ${txId} has been sent to ${recipientName} for review. Amount requested back: ${received}.`, transactionId: txId, amount: transfer.received, amountText: received, status: 'Pending recipient review', counterparty: recipientName });
    await sendEmail('transaction_notice', to.email, { name: recipientName, title: `Incoming Transfer Reversal Request — ${received}`, message: `${requesterName} requested a reversal for transaction ${txId}. If approved, ${received} will be deducted from your wallet and returned to ${requesterName}.`, transactionId: txId, amount: transfer.received, amountText: received, status: 'Action required', counterparty: requesterName });
    await sendTelegramMessage(`↩️ <b>Transfer reversal requested</b>\nTX: ${txId}\nAmount: ${received}\nRequester: ${requesterName}\nRecipient: ${recipientName}`).catch(()=>{});
  } else {
    const approved = decision === 'approved';
    if (approved) {
      await sendEmail('transaction_notice', from.email, { name: requesterName, title: `Transfer Reversal Approved — ${amount} Returned`, message: `Your reversal request has been approved. ${amount} has been returned to your wallet. Reversed from ${recipientName}.`, transactionId: txId, amount: transfer.amount, amountText: amount, status: 'Refunded to wallet', counterparty: recipientName });
      await sendEmail('transaction_notice', to.email, { name: recipientName, title: `Transfer Reversal Approved — ${received} Deducted`, message: `A transfer reversal has been approved. ${received} has been deducted from your wallet and returned to ${requesterName}.`, transactionId: txId, amount: transfer.received, amountText: received, status: 'Deducted from wallet', counterparty: requesterName });
    } else {
      await sendEmail('transaction_notice', from.email, { name: requesterName, title: 'Transfer Reversal Declined', message: `Your reversal request for transaction ${txId} (${received}) was declined by ${recipientName}. If you believe this is an error, please contact support.`, transactionId: txId, amount: transfer.received, amountText: received, status: 'Declined', counterparty: recipientName });
    }
    await sendTelegramMessage(`↩️ <b>Transfer reversal ${decision}</b>\nTX: ${txId}\nAmount: ${received}\nRequester: ${requesterName}\nRecipient: ${recipientName}`).catch(()=>{});
  }
}

export { getDb, admin, json, cents, money, publicMember, creditPlatform, notifyReversal };
