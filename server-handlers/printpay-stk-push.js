import { getDb, admin } from './_lib/firebase.js';

function normalizePhone(value) {
  const phone = String(value || '').replace(/\s+/g, '');
  if (/^(07|01)\d{8}$/.test(phone)) return `254${phone.slice(1)}`;
  if (/^254\d{9}$/.test(phone)) return phone;
  throw new Error('Enter a valid Kenyan M-Pesa phone number');
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    // Express already parses the body — no req.json() needed
    const { phone_number, amountUSD, uid, userName, userEmail } = req.body || {};

    if (!phone_number || amountUSD === undefined || !uid || !userName || !userEmail) {
      return res.status(400).json({ success: false, error: 'phone_number, amountUSD, uid, userName and userEmail are required' });
    }

    const usd = Number(amountUSD);
    if (!Number.isFinite(usd) || usd <= 0) {
      return res.status(400).json({ success: false, error: 'amountUSD must be a positive number' });
    }

    const apiKey = process.env.PRINTPAY_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'PRINTPAY_API_KEY is not configured' });
    }

    const phone = normalizePhone(phone_number);
    const amountKES = Math.round(usd * Number(process.env.USD_TO_KES_RATE || 130));

    // Send as form-encoded — required by PrintPay API
    const formBody = new URLSearchParams();
    formBody.append('x_api_key', apiKey);
    formBody.append('phone_number', phone);
    formBody.append('amount', String(amountKES));

    const response = await fetch('https://printpay.site/api/stk_push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody.toString()
    });

    const data = await response.json().catch(() => ({}));
    console.log('[printpay-stk-push] PrintPay response:', JSON.stringify(data));

    if (data.status === 'error' || data.status === 'failed') {
      throw new Error(data.error || data.message || 'PrintPay rejected the request');
    }

    const checkoutId = data.checkout_id;
    if (!checkoutId) {
      throw new Error(`PrintPay did not return a checkout ID. Response: ${JSON.stringify(data)}`);
    }

    const depositId = `printpay_${Date.now()}_${uid.substring(0, 6)}`;

    // Save to Firestore
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

    return res.json({ success: true, checkoutId });

  } catch (error) {
    console.error('[printpay-stk-push] failed:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
