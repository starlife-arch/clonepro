import { runNetlifyHandler } from './_lib/vercel-adapter.js';

async function netlifyHandler(req) {
  try {
    if (req.method !== 'POST') throw new Error('Method not allowed');
    const { checkoutId } = await req.json();
    if (!checkoutId) throw new Error('checkoutId is required');
    const response = await fetch(`https://printpay.site/api/stk_push?check_status=${encodeURIComponent(checkoutId)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || 'PrintPay status check failed');
    return new Response(JSON.stringify({ status: data.status, mpesa_receipt_number: data.mpesa_receipt_number, amount: data.amount, phone_number: data.phone_number }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: error.message === 'Method not allowed' ? 405 : 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export default async function handler(req, res) { return runNetlifyHandler(req, res, netlifyHandler); }
