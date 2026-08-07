async function legacyHandler(req) {
  if (req.method !== 'GET') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ vapidKey: process.env.FCM_VAPID_KEY || '' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};


import { runVercelHandler } from './_lib/vercel-adapter.js';

export async function handle(req, res) {
  return runVercelHandler(req, res, legacyHandler);
}
