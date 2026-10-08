// Admin-only: download every member's email as a CSV (ready to import into Brevo).
// Reads from Firebase Authentication, NOT Firestore, so it still works when the Firestore quota is used up.
import { getDb, admin } from './_lib/firebase.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Quote cells that need it, and defuse spreadsheet formulas (a name like "=HYPERLINK(...)").
function csvCell(value) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

async function requireAdmin(request) {
  const idToken = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!idToken) throw Object.assign(new Error('Auth token required'), { status: 401 });
  let decoded;
  try { decoded = await admin.auth().verifyIdToken(idToken); }
  catch (_) { throw Object.assign(new Error('Sign-in expired - please sign in again'), { status: 401 }); }
  const adminEmail = String(process.env.ADMIN_EMAIL || '').toLowerCase();
  const isOwner = adminEmail && String(decoded.email || '').toLowerCase() === adminEmail;
  if (decoded.adminRole === 'superadmin' || isOwner) return decoded;
  throw Object.assign(new Error('Super Admin required'), { status: 403 });
}

async function netlifyHandler(request) {
  if (request.method !== 'GET' && request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    getDb(); // starts the Firebase app (no database reads happen here)
    await requireAdmin(request);

    const rows = ['EMAIL,FIRSTNAME,LASTNAME'];
    let pageToken;
    do {
      const page = await admin.auth().listUsers(1000, pageToken);
      for (const u of page.users) {
        if (!u.email || u.disabled) continue;
        const [first = '', ...rest] = String(u.displayName || '').trim().split(/\s+/).filter(Boolean);
        rows.push([u.email, first, rest.join(' ')].map(csvCell).join(','));
      }
      pageToken = page.pageToken;
    } while (pageToken);

    return new Response(rows.join('\r\n') + '\r\n', {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="starlife-members.csv"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return json({ error: err.message || 'Export failed' }, err.status || 500);
  }
}

import { runNetlifyHandler } from './_lib/vercel-adapter.js';

export default async function handler(req, res) {
  return runNetlifyHandler(req, res, netlifyHandler);
}
