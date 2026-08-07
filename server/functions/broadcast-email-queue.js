import crypto from 'crypto';
import { admin, initFirebase, json, resolveRecipients } from './_lib/broadcast-email.js';

async function netlifyHandler(req, context) {
  try {
    if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

    const token = req.headers.get('x-api-token');
    if (token !== process.env.EMAIL_API_TOKEN) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const subject = body.subject || 'Untitled broadcast';
    const { message, recipients, fromKey } = body;
    if (!subject || !message) return json({ error: 'Missing subject or message' }, 400);

    const db = initFirebase();
    const recipientsList = await resolveRecipients(db, recipients);
    const broadcastId = crypto.randomUUID();
    const now = admin.firestore.FieldValue.serverTimestamp();

    await db.collection('broadcastLogs').doc(broadcastId).set({
      broadcastId,
      subject,
      recipients: recipientsList.length,
      totalRecipients: recipientsList.length,
      sent: 0,
      failed: 0,
      pending: recipientsList.length,
      status: recipientsList.length ? 'queued' : 'completed',
      createdAt: now,
      updatedAt: now,
      adminTriggered: true,
    });

    let batch = db.batch();
    let opCount = 0;
    for (const recipient of recipientsList) {
      const ref = db.collection('emailBroadcastQueue').doc();
      batch.set(ref, {
        broadcastId,
        email: recipient.email,
        name: recipient.name || 'Member',
        subject,
        message,
        fromKey: fromKey || 'broadcast',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      });
      opCount++;
      if (opCount === 450) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    }
    if (opCount) await batch.commit();

    return json({ queued: recipientsList.length, totalRecipients: recipientsList.length, broadcastId });
  } catch (err) {
    console.error('broadcast-email-queue error:', err);
    return json({ error: err.message || 'Broadcast queue failed' }, 500);
  }
};


import { runNetlifyHandler } from './_lib/vercel-adapter.js';

export default async function handler(req, res) {
  return runNetlifyHandler(req, res, netlifyHandler);
}
