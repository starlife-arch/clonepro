import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { getDb, admin } from './firebase.js';
import { resolveSender } from './senders.js';


const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Secret(bytes = 20) {
  const buf = crypto.randomBytes(bytes);
  let bits = '';
  for (const byte of buf) bits += byte.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    out += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return out;
}

function base32ToBuffer(secret) {
  const clean = String(secret || '').replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  let bits = '';
  for (const ch of clean) {
    const val = BASE32_ALPHABET.indexOf(ch);
    if (val < 0) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function hotp(secret, counter) {
  const key = base32ToBuffer(secret);
  const msg = Buffer.alloc(8);
  msg.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  msg.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac('sha1', key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, '0');
}

function verifyTotp({ secret, token, window = 1, step = 30, now = Date.now() }) {
  const clean = normalizeToken(token);
  if (!/^\d{6}$/.test(clean)) return false;
  const counter = Math.floor(now / 1000 / step);
  for (let drift = -window; drift <= window; drift += 1) {
    if (hotp(secret, counter + drift) === clean) return true;
  }
  return false;
}

function otpauthUrl({ secret, accountName, issuer = 'Starlife' }) {
  const label = `${issuer}:${accountName}`;
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: '30' });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

function qrCodeUrl(otpauth) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(otpauth)}`;
}

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

export { admin, getDb, json, readJson, normalizeToken, formatManualKey, base32Secret, verifyTotp, otpauthUrl, qrCodeUrl, generateBackupCodes, sendSecurityEmail };
