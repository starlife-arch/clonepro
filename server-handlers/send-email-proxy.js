// API send-email-proxy handler
// Called by the frontend for transactional emails (welcome, deposit, withdrawal, etc.)
// The frontend sends NO token — this function injects it server-side without a fragile self-fetch.

import { netlifyHandler as sendEmail } from './send-email.js';
import { runNetlifyHandler } from './_lib/vercel-adapter.js';

function tokenRequest(req, body) {
  return {
    ...req,
    method: 'POST',
    headers: { get: name => String(name).toLowerCase() === 'x-api-token' ? (process.env.EMAIL_API_TOKEN || '') : req.headers.get(name) },
    json: async () => body,
  };
}

async function netlifyHandler(req, context) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json().catch(() => ({}));
    return sendEmail(tokenRequest(req, body), context);
  } catch (err) {
    console.error('send-email-proxy error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export default async function handler(req, res) {
  return runNetlifyHandler(req, res, netlifyHandler);
}
