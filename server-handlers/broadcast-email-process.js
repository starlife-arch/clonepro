import nodemailer from 'nodemailer';
import { admin, initFirebase, json, personalizeMessage, updateBroadcastLog } from './_lib/broadcast-email.js';
import { resolveSender } from './_lib/senders.js';

const PROCESS_LIMIT = 20;

async function legacyHandler() {
  try {
    const db = initFirebase();
    const snap = await db.collection('emailBroadcastQueue').where('status', '==', 'pending').limit(PROCESS_LIMIT).get();
    if (snap.empty) return json({ success: true, processed: 0 });

    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: { user: process.env.BREVO_SMTP_USER, pass: process.env.BREVO_SMTP_PASS },
    });

    const touchedBroadcasts = new Map();
    let sent = 0;
    let failed = 0;

    for (const doc of snap.docs) {
      const item = doc.data() || {};
      const broadcastId = item.broadcastId;
      if (broadcastId) touchedBroadcasts.set(broadcastId, { subject: item.subject || 'Untitled broadcast' });
      try {
        const name = item.name || 'Member';
        const fromEmail = item.fromKey === 'maintenance'
          ? '"Starlife Advert" <noreply@starlifeadvert.com>'
          : resolveSender(item.fromKey || 'broadcast');
        await transporter.sendMail({
          from: fromEmail,
          to: item.email,
          subject: item.subject || 'Untitled broadcast',
          html: personalizeMessage(item.message, name),
          headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        });
        await doc.ref.update({ status: 'sent', sentAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        sent++;
      } catch (err) {
        failed++;
        await doc.ref.update({
          status: 'failed',
          error: err.message || 'Send failed',
          failedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    for (const [broadcastId, extra] of touchedBroadcasts.entries()) {
      await updateBroadcastLog(db, broadcastId, extra);
    }

    return json({ success: true, processed: snap.size, sent, failed });
  } catch (err) {
    console.error('broadcast-email-process failed:', err);
    return json({ success: false, error: err.message || 'Broadcast email processing failed' }, 500);
  }
};



import { runVercelHandler } from './_lib/vercel-adapter.js';

export default async function handler(req, res) {
  return runVercelHandler(req, res, legacyHandler);
}
