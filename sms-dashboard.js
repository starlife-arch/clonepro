import { getDb } from './_lib/firebase.js';

function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }
async function nenaGet(path) {
  const response = await fetch(`https://nenasolutions.co.ke/v1/api/${path}`, { headers: { Authorization: `Bearer ${process.env.NENA_API_TOKEN}` } });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, data };
}

async function netlifyHandler(req, context) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'history';
    if (action === 'balance') return json(await nenaGet('wallet/balance'));
    if (action === 'logs') return json(await nenaGet('sms/logs'));
    const snap = await getDb().collection('smsBroadcastLogs').orderBy('sentAt', 'desc').limit(10).get();
    return json({ success: true, history: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (err) { return json({ error: err.message }, 500); }
};


import { runNetlifyHandler } from './_lib/vercel-adapter.js';

export default async function handler(req, res) {
  return runNetlifyHandler(req, res, netlifyHandler);
}
