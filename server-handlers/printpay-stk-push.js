import { query } from './_lib/postgres.js';
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

    const depositId = `printpay_${Date.now()}_${uid.substring(0, 6)}`;
    await query(
      `INSERT INTO deposits (id, user_id, amount, amount_kes, method, status, checkout_id, phone, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [depositId, uid, usd, amountKES, 'M-Pesa (PrintPay)', 'pending', data.checkout_id, phone]
    );
    return new Response(JSON.stringify({ success: true, checkoutId: data.checkout_id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[printpay-stk-push] failed', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      response: error.response?.data
    });
    const status = error.message === 'Method not allowed' ? 405 : 500;
    return new Response(JSON.stringify({ success: false, error: error.message }), { status, headers: { 'Content-Type': 'application/json' } });
  }
}

export default async function handler(req, res) { return runNetlifyHandler(req, res, netlifyHandler); }
