import { getDb, admin } from './_lib/firebase.js';
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

    const apiKey = process.env.PRINTPAY_API_KEY;
    if (!apiKey) throw new Error('PRINTPAY_API_KEY is not configured');

    const phone = normalizePhone(phone_number);
    const amountKES = Math.round(usd * Number(process.env.USD_TO_KES_RATE || 130));

    // Send API key as BOTH header and body field — PrintPay accepts either
    const response = await fetch('https://printpay.site/api/stk_push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        x_api_key: apiKey,
        api_key: apiKey,
        phone_number: phone,
        amount: amountKES
      })
    });

    const data = await response.json().catch(() => ({}));
    console.log('[printpay-stk-push] PrintPay response:', JSON.stringify(data));

    if (!response.ok || data.status === 'error' || data.status === 'failed') {
      throw new Error(data.error || data.message || data.detail || `PrintPay error: ${response.status}`);
    }

    const checkoutId = data.checkout_id || data.checkoutRequestID || data.CheckoutRequestID || data.request_id;
    if (!checkoutId) throw new Error('PrintPay did not return a checkout ID');

    const depositId = `printpay_${Date.now()}_${uid.substring(0, 6)}`;

    // Save to PostgreSQL
    await query(
      `INSERT INTO deposits (id, user_id, amount, amount_kes, method, status, checkout_id, phone, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [depositId, uid, usd, amountKES, 'M-Pesa (PrintPay)', 'pending', checkoutId, phone]
    ).catch(e => console.warn('[printpay-stk-push] PG save failed (non-fatal):', e.message));

    // ALSO save to Firestore so the webhook can find it
    try {
      const db = getDb();
      await db.collection('deposits').doc(depositId).set({
        uid, userName, userEmail,
        amountUSD: usd,
        amountKES,
        amount: usd,
        method: 'M-Pesa (PrintPay)',
        status: 'pending',
        checkoutId,
        phone,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      console.warn('[printpay-stk-push] Firestore save failed (non-fatal):', e.message);
    }

    return new Response(
      JSON.stringify({ success: true, checkoutId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[printpay-stk-push] failed:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export default async function handler(req, res) { return runNetlifyHandler(req, res, netlifyHandler); }
