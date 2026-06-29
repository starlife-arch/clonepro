import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { getDb, admin } from './firebase.js';
import { resolveSender } from './senders.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

async function readJson(req) {
  return await req.json().catch(() => ({}));
}

function normalizeToken(token) {
  return String(token || '').trim().replace(/\s+/g, '').toUpperCase();
}

function formatManualKey(base32) {
  return String(base32 || '').replace(/(.{4})/g, '$1 ').trim();
}

function backupCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let raw = '';
  for (let i = 0; i < 8; i += 1) raw += alphabet[crypto.randomInt(0, alphabet.length)];
  return raw.slice(0, 4) + '-' + raw.slice(4);
}

function generateBackupCodes(count = 8) {
  return Array.from({ length: count }, backupCode);
}

async function sendSecurityEmail(to, name, subject, message) {
  if (!to) return;
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com', port: 587, secure: false,
    auth: { user: process.env.BREVO_SMTP_USER, pass: process.env.BREVO_SMTP_PASS },
  });
  await transporter.sendMail({
    from: resolveSender('noreply'), to, subject,
    html: `<p>Hello ${name || 'Member'},</p><p>${message}</p><p>Starlife Advert</p>`,
    text: `Hello ${name || 'Member'},\n\n${message}\n\nStarlife Advert`,
  });
}

export { admin, getDb, json, readJson, normalizeToken, formatManualKey, generateBackupCodes, sendSecurityEmail };
