// server-handlers/send-email-proxy.js
// Called by the frontend for transactional emails (welcome, deposit, withdrawal, etc.)
// The frontend sends NO token — this function injects it server-side from the env var.

async function legacyHandler(req, context) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json().catch(() => ({}));

    const siteUrl = process.env.URL || 'http://localhost:8888';

    const response = await fetch(
      `${siteUrl}/api/send-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-token': process.env.EMAIL_API_TOKEN || ''
        },
        body: JSON.stringify(body)
      }
    );

    const text = await response.text();
    return new Response(text, { status: response.status, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('send-email-proxy error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};


import { runVercelHandler } from './_lib/vercel-adapter.js';

export async function handle(req, res) {
  return runVercelHandler(req, res, legacyHandler);
}
