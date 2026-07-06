// netlify/functions/broadcast-email-background.js
import nodemailer from 'nodemailer';
import admin from 'firebase-admin';
import { resolveSender } from './_lib/senders.js';

// ── Firebase init (supports both JSON and individual vars) ────────────────────
function initFirebase() {
  if (admin.apps.length) return admin.firestore();
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    : null;
  const credential = sa
    ? admin.credential.cert(sa)
    : admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      });
  admin.initializeApp({ credential });
  return admin.firestore();
}

const MAX_LOG_ERRORS = 25;

function cleanRecipientKey(value) {
  return String(value || '').trim();
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

async function findUserByMemberIdOrUid(db, memberIdOrUid) {
  const key = cleanRecipientKey(memberIdOrUid);
  if (!key) return null;

  const direct = await db.collection('users').doc(key).get();
  if (direct.exists) return direct;

  const memberFields = ['memberId', 'memberID', 'uid'];
  for (const field of memberFields) {
    const snap = await db.collection('users').where(field, '==', key).limit(1).get();
    if (!snap.empty) return snap.docs[0];
  }

  const upperKey = key.toUpperCase();
  const allUsers = await db.collection('users').get();
  return allUsers.docs.find(doc => {
    const data = doc.data() || {};
    return doc.id.substring(0, 8).toUpperCase() === upperKey
      || String(data.memberId || '').toUpperCase() === upperKey
      || String(data.memberID || '').toUpperCase() === upperKey;
  }) || null;
}

function userDocToRecipient(doc) {
  const data = doc.data() || {};
  return {
    email: data.email,
    name: data.name || data.displayName || 'Member',
  };
}

async function resolveRecipients(db, recipients) {
  if (recipients === 'all') {
    const usersSnap = await db.collection('users').get();
    return usersSnap.docs.map(userDocToRecipient).filter(r => r.email);
  }

  if (Array.isArray(recipients)) {
    const resolved = [];
    for (const item of recipients) {
      const key = cleanRecipientKey(item);
      if (!key) continue;
      if (looksLikeEmail(key)) {
        resolved.push({ email: key, name: 'Member' });
        continue;
      }
      const userSnap = await findUserByMemberIdOrUid(db, key);
      if (!userSnap) throw new Error(`User not found: ${key}`);
      const recipient = userDocToRecipient(userSnap);
      if (recipient.email) resolved.push(recipient);
    }
    return resolved;
  }

  if (typeof recipients === 'string' && recipients.startsWith('single:')) {
    const memberIdOrUid = recipients.slice('single:'.length);
    const userSnap = await findUserByMemberIdOrUid(db, memberIdOrUid);
    if (!userSnap) throw new Error('User not found');
    const recipient = userDocToRecipient(userSnap);
    return recipient.email ? [recipient] : [];
  }

  throw new Error('Invalid recipients format');
}

async function writeBroadcastLog(db, details) {
  await db.collection('broadcastLogs').add({
    subject: details.subject || 'Untitled broadcast',
    recipients: Number(details.recipients || 0),
    sent: Number(details.sent || 0),
    failed: Number(details.failed || 0),
    errors: (details.errors || []).slice(0, MAX_LOG_ERRORS),
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    adminTriggered: true,
  });
}

export default async (req, context) => {
  let db;
  let subject = 'Untitled broadcast';
  let totalRecipients = 0;
  let sent = 0;
  let failed = 0;
  let errors = [];

  try {
    // 1. Security check
    const token = req.headers.get('x-api-token');
    if (token !== process.env.EMAIL_API_TOKEN) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    subject = body.subject || subject;
    const { message, recipients, fromKey } = body;
    if (!subject || !message) {
      return new Response('Missing subject or message', { status: 400 });
    }

    db = initFirebase();

    // 2. Setup Brevo SMTP
    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.BREVO_SMTP_USER,
        pass: process.env.BREVO_SMTP_PASS,
      },
    });
    await transporter.verify();

    // 3. Get recipients
    const recipientsList = await resolveRecipients(db, recipients);
    totalRecipients = recipientsList.length;

    if (!recipientsList.length) {
      await writeBroadcastLog(db, { subject, recipients: 0, sent: 0, failed: 0, errors: [] });
      return new Response(JSON.stringify({ sent: 0, failed: 0, errors: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // 4. Send emails
    const fromEmail = fromKey === 'maintenance' ? '"Starlife Advert" <noreply@starlifeadvert.com>' : resolveSender(fromKey || 'broadcast');

    const batchSize = 10;
    for (let i = 0; i < recipientsList.length; i += batchSize) {
      const batch = recipientsList.slice(i, i + batchSize);
      const results = await Promise.allSettled(batch.map(async ({ email, name }) => {
        let personalizedMessage = message
          .replace(/Dear Member/gi, `Dear ${name}`)
          .replace(/Hi \[Name\]/gi, `Hi ${name}`)
          .replace(/\[Name\]/g, name);
        if (!personalizedMessage.includes(name)) {
          personalizedMessage = `<p>Dear ${name},</p>\n${personalizedMessage}`;
        }
        await transporter.sendMail({ from: fromEmail, to: email, subject, html: personalizedMessage, headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
        return { email };
      }));
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') sent++;
        else {
          failed++;
          errors.push({ email: batch[idx].email, error: result.reason?.message || 'Send failed' });
        }
      });
    }

    await writeBroadcastLog(db, { subject, recipients: totalRecipients, sent, failed, errors });

    // 5. Telegram alert
    try {
      const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL;
      if (siteUrl) {
        await fetch(`${siteUrl}/.netlify/functions/send-telegram`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `📢 *Broadcast Sent*\nSubject: ${subject}\nRecipients: ${totalRecipients}\nSent: ${sent}\nFailed: ${failed}`,
          }),
        });
      }
    } catch (e) { console.error('Telegram alert failed:', e); }

    return new Response(JSON.stringify({ sent, failed, errors, totalRecipients }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    const message = err?.message || 'Broadcast failed';
    errors.push({ error: message });
    console.error('broadcast-email-background error:', err);
    try {
      db = db || initFirebase();
      await writeBroadcastLog(db, { subject, recipients: totalRecipients, sent, failed: totalRecipients || failed, errors });
    } catch (logErr) {
      console.error('broadcast-email-background log write failed:', logErr);
    }
    return new Response(JSON.stringify({ error: message, sent, failed: totalRecipients || failed, errors }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
