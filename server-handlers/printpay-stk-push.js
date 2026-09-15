import { getDb, admin } from './_lib/firebase.js';
import { runNetlifyHandler } from './_lib/vercel-adapter.js';

function normalizePhone(value) {
  const phone = String(value || '').replace(/\s+/g, '');
  if (/^(07|01)\d{8}$/.test(phone)) return `254${phone.slice(1)}`;
  if (/^254\d{9}$/.test(phone)) return phone;
  throw new Error('Enter a valid Kenyan M-Pesa phone number');
}

async function netlifyHandler(req) {
  try {
    if (req.method !== 'POST') throw new Error('Method not allowed');
    const { phone_number, amountUSD, uid, userName, userEmail } = await req.json();
    if (!phone_number || amountUSD === undefined || !uid || !userName || !userEmail) {
      throw new Error('phone_number, amountUSD, uid, userName, and userEmail are required');
    }
    const usd = Number(amountUSD);
    if (!Number.isFinite(usd) || usd <= 0) throw new Error('amountUSD must be a positive number');
    if (!process.env.PRINTPAY_API_KEY) throw new Error('PRINTPAY_API_KEY is not configured');

    const phone = normalizePhone(phone_number);
    const amountKES = Math.round(usd * Number(process.env.USD_TO_KES_RATE || 130));
    const response = await fetch('https://printpay.site/api/stk_push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x_api_key: process.env.PRINTPAY_API_KEY, phone_number: phone, amount: amountKES })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status !== 'success' || !data.checkout_id) {
      throw new Error(data.error || data.message || 'PrintPay could not initiate the STK push');
    }

    await getDb().collection('deposits').add({
      uid, userName, userEmail,
      method: 'M-Pesa (PrintPay)',
      amountUSD: usd,
      amountKES,
      checkoutId: data.checkout_id,
      status: 'pending',
      phone,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return new Response(JSON.stringify({ success: true, checkoutId: data.checkout_id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    const status = error.message === 'Method not allowed' ? 405 : 500;
    return new Response(JSON.stringify({ success: false, error: error.message }), { status, headers: { 'Content-Type': 'application/json' } });
  }
}

export default async function handler(req, res) { return runNetlifyHandler(req, res, netlifyHandler); }
