async function legacyHandler(req, context) {
  try {
    const { to, message } = await req.json();
    if (!to || !message) return new Response(JSON.stringify({ error: 'Missing to or message' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    function normalizePhone(phone) {
      if (!phone) return null;
      const cleaned = String(phone).replace(/[\s\-()]/g, '');
      if (cleaned.startsWith('254') && cleaned.length === 12) return cleaned;
      if (cleaned.startsWith('0') && cleaned.length === 10) return '254' + cleaned.slice(1);
      if (cleaned.startsWith('+254') && cleaned.length === 13) return cleaned.slice(1);
      if (cleaned.length === 9) return '254' + cleaned;
      return null;
    }
    const normalizedPhone = normalizePhone(to);
    if (!normalizedPhone) return new Response(JSON.stringify({ error: 'Invalid phone number', skipped: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const response = await fetch('https://nenasolutions.co.ke/v1/api/sms/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.NENA_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: normalizedPhone, message: message.trim().slice(0, 160) })
    });
    const data = await response.json().catch(() => ({}));
    return new Response(JSON.stringify({ success: response.ok, data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('SMS send error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};


import { runVercelHandler } from './_lib/vercel-adapter.js';

export async function handle(req, res) {
  return runVercelHandler(req, res, legacyHandler);
}
