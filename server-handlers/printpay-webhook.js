import nodemailer from 'nodemailer';
import { getDb, admin } from './_lib/firebase.js';
import { sendTelegramMessage } from './_lib/telegram.js';
import { runNetlifyHandler } from './_lib/vercel-adapter.js';

async function sendPaymentReceivedEmail(deposit) {
  if (!deposit.userEmail) return;
  const transporter = nodemailer.createTransport({ host: 'smtp-relay.brevo.com', port: 587, secure: false, auth: { user: process.env.BREVO_SMTP_USER, pass: process.env.BREVO_SMTP_PASS } });
  await transporter.sendMail({
    from: 'deposits@starlifeadvert.com', to: deposit.userEmail, subject: 'M-Pesa Payment Received',
    text: `Hello ${deposit.userName || 'Member'}, we received your M-Pesa payment. It is awaiting admin confirmation and your funds will be credited once approved.`
  });
}

async function netlifyHandler(req) {
  if (req.method !== 'POST') return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    const { checkout_id, status, mpesa_receipt, amount, result_code } = await req.json();
    if (!checkout_id) return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const db = getDb();
    // Check Firestore first
    let ref = null;
    let deposit = null;
    const deposits = await db.collection('deposits').where('checkoutId', '==', checkout_id).limit(1).get();
    if (!deposits.empty) {
      ref = deposits.docs[0].ref;
      deposit = deposits.docs[0].data();
    } else {
      // Fallback: check PostgreSQL and create Firestore doc if found
      try {
        const { query } = await import('./_lib/postgres.js');
        const { rows } = await query('SELECT * FROM deposits WHERE checkout_id = $1 LIMIT 1', [checkout_id]);
        if (rows.length > 0) {
          const row = rows[0];
          ref = db.collection('deposits').doc(row.id);
          deposit = { uid: row.user_id, userName: '', userEmail: '', amountUSD: Number(row.amount), amountKES: Number(row.amount_kes) };
          await ref.set({ ...deposit, checkoutId: checkout_id, method: 'M-Pesa (PrintPay)', status: 'pending', createdAt: admin.firestore.FieldValue.serverTimestamp() });
        }
      } catch (pgErr) { console.warn('[printpay-webhook] PG fallback failed:', pgErr.message); }
    }
    if (!ref || !deposit) return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (status === 'SUCCESS' && Number(result_code) === 0) {
      await ref.update({ status: 'awaiting_approval', mpesaReceipt: mpesa_receipt, paidAt: admin.firestore.FieldValue.serverTimestamp() });
      await Promise.allSettled([
        sendTelegramMessage(`💚 New M-Pesa deposit received!\nUser: ${deposit.userName}\nAmount: KES ${amount} ($${deposit.amountUSD})\nReceipt: ${mpesa_receipt}\nAwaiting admin approval.`),
        sendPaymentReceivedEmail(deposit)
      ]);
    } else if (status === 'FAILED') {
      await ref.update({ status: 'failed', failedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
  } catch (error) { console.error('[printpay-webhook] failed', error); }
  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export default async function handler(req, res) { return runNetlifyHandler(req, res, netlifyHandler); }
