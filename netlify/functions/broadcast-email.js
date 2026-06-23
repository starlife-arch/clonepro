// netlify/functions/broadcast-email.js
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

export default async (req, context) => {
  // 1. Security check
  const token = req.headers.get('x-api-token');
  if (token !== process.env.EMAIL_API_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { subject, message, recipients, fromKey } = await req.json().catch(() => ({}));
  if (!subject || !message) {
    return new Response('Missing subject or message', { status: 400 });
  }

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

  // 3. Get recipients
  let recipientsList = [];

  if (recipients === 'all') {
    const db = initFirebase();
    const usersSnap = await db.collection('users').get();
    recipientsList = usersSnap.docs
      .map(doc => ({
        email: doc.data().email,
        name: doc.data().name || doc.data().displayName || 'Member',
      }))
      .filter(r => r.email);
  } else if (Array.isArray(recipients)) {
    recipientsList = recipients.map(email => ({ email, name: 'Member' }));
  } else if (typeof recipients === 'string' && recipients.startsWith('single:')) {
    const memberIdOrUid = recipients.split(':')[1];
    const db = initFirebase();
    let userSnap = await db.collection('users').doc(memberIdOrUid).get();
    if (!userSnap.exists) {
      const allUsers = await db.collection('users').get();
      const match = allUsers.docs.find(
        doc => doc.id.substring(0, 8).toUpperCase() === memberIdOrUid.toUpperCase()
      );
      if (match) userSnap = match;
    }
    if (userSnap && userSnap.exists) {
      recipientsList = [{
        email: userSnap.data().email,
        name: userSnap.data().name || userSnap.data().displayName || 'Member',
      }];
    } else {
      return new Response('User not found', { status: 404 });
    }
  } else {
    return new Response('Invalid recipients format', { status: 400 });
  }

  if (!recipientsList.length) {
    return new Response(JSON.stringify({ sent: 0, failed: 0, errors: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // 4. Send emails
  let sent = 0, failed = 0, errors = [];
  const fromEmail = fromKey === 'maintenance' ? '"Starlife Advert" <noreply@starlifeadvert.com>' : resolveSender(fromKey || 'broadcast');

  for (const { email, name } of recipientsList) {
    let personalizedMessage = message
      .replace(/Dear Member/gi, `Dear ${name}`)
      .replace(/Hi \[Name\]/gi, `Hi ${name}`)
      .replace(/\[Name\]/g, name);
    if (!personalizedMessage.includes(name)) {
      personalizedMessage = `<p>Dear ${name},</p>\n${personalizedMessage}`;
    }
    try {
      await transporter.sendMail({ from: fromEmail, to: email, subject, html: personalizedMessage, headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
      sent++;
    } catch (err) {
      failed++;
      errors.push({ email, error: err.message });
    }
  }

  // 5. Telegram alert
  try {
    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL;
    await fetch(`${siteUrl}/.netlify/functions/send-telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `📢 *Broadcast Sent*\nSubject: ${subject}\nRecipients: ${recipientsList.length}\nSent: ${sent}\nFailed: ${failed}`,
      }),
    });
  } catch (e) { console.error('Telegram alert failed:', e); }

  return new Response(JSON.stringify({ sent, failed, errors, totalRecipients: recipientsList.length }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
