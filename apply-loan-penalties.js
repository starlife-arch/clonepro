import { getDb, admin } from './_lib/firebase.js';
import { sendTelegramMessage } from './_lib/telegram.js';

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function sendLoanEmail(type, to, data) {
  if (!to) return;
  const siteUrl = process.env.URL || process.env.SITE_URL || 'http://localhost:8888';
  const response = await fetch(`${siteUrl}/api/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-token': process.env.EMAIL_API_TOKEN || '' },
    body: JSON.stringify({ type, to, data }),
  });
  if (!response.ok) throw new Error(`send-email failed with ${response.status}`);
}

export async function runLoanPenalties() {
  const db = getDb();
  const now = new Date();
  const snap = await db.collection('loans').where('status', '==', 'active').get();
  let updated = 0;
  let warned = 0;

  for (const doc of snap.docs) {
    const loan = doc.data() || {};
    const due = toDate(loan.dueDate);
    if (!due || now <= due) continue;

    const daysLate = Math.floor((now - due) / 86400000);
    if (daysLate < 1) continue;

    if (daysLate === 1 && !loan.overdueWarningSentAt) {
      try {
        await sendLoanEmail('loan_overdue', loan.userEmail, {
          name: loan.userName,
          amount: loan.amount,
          dueDate: due.toISOString(),
          timestamp: now.toISOString(),
        });
        await doc.ref.update({ overdueWarningSentAt: admin.firestore.FieldValue.serverTimestamp() });
        warned++;
      } catch (e) { console.error('[loan overdue email] failed', e); }
    }

    const periods = daysLate >= 1 ? Math.max(1, Math.floor(daysLate / 7)) : 0;
    const newPenalty = parseFloat((Number(loan.amount || 0) * 0.05 * periods).toFixed(2));
    const oldPenalty = Number(loan.penalty || 0);
    if (newPenalty > oldPenalty) {
      await doc.ref.update({ penalty: newPenalty, lastPenaltyAt: admin.firestore.FieldValue.serverTimestamp() });
      updated++;

      await db.collection('userNotifs').add({
        uid: loan.uid,
        msg: `⚠️ Your loan is overdue. A late fee of $${newPenalty.toFixed(2)} now applies (total owed: $${(Number(loan.amount || 0) + newPenalty).toFixed(2)}).`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      try {
        await sendLoanEmail('loan_penalty_applied', loan.userEmail, {
          name: loan.userName,
          principal: loan.amount,
          penalty: newPenalty,
          totalOwed: Number(loan.amount || 0) + newPenalty,
          daysLate,
          dueDate: due.toISOString(),
          timestamp: now.toISOString(),
        });
      } catch (e) { console.error('[penalty email] failed', e); }

      if (daysLate >= 30 && !loan.countedAsDefault && loan.uid) {
        await db.collection('users').doc(loan.uid).update({ loanDefaultCount: admin.firestore.FieldValue.increment(1) });
        await doc.ref.update({ countedAsDefault: true });
      }
    }
  }

  if (updated > 0 || warned > 0) {
    try {
      await sendTelegramMessage(`⚠️ <b>Loan Alerts Processed</b>\nPenalty updates: ${updated}\nOverdue warnings: ${warned}`);
    } catch (e) { console.error('Telegram loan penalty alert failed:', e); }
  }

  return new Response(JSON.stringify({ updated, warned }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};


import { runNetlifyHandler } from './_lib/vercel-adapter.js';

export default async function handler(req, res) {
  const secret = req.headers?.['x-cron-secret'] || req.headers?.get?.('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  return runNetlifyHandler(req, res, async () => {
    await runLoanPenalties();
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  });
}
