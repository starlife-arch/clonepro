import { runNetlifyHandler } from './_lib/vercel-adapter.js';

async function netlifyHandler(req) {
  try {
    if (req.method !== 'POST') throw new Error('Method not allowed');
    const { checkoutId } = await req.json();
    if (!checkoutId) throw new Error('checkoutId is required');

    const apiKey = process.env.PRINTPAY_API_KEY;
    if (!apiKey) throw new Error('PRINTPAY_API_KEY is not configured');

    // Send API key in headers AND as query param
    const url = `https://printpay.site/api/stk_push?check_status=${encodeURIComponent(checkoutId)}&x_api_key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Authorization': `Bearer ${apiKey}`
      }
    });

    const data = await response.json().catch(() => ({}));
    console.log('[printpay-check-status] response:', JSON.stringify(data));

    return new Response(
      JSON.stringify({
        status: data.status,
        mpesa_receipt_number: data.mpesa_receipt_number || data.receipt || null,
        amount: data.amount,
        phone_number: data.phone_number
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export default async function handler(req, res) { return runNetlifyHandler(req, res, netlifyHandler); }
