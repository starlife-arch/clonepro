import { getDb } from './_lib/firebase.js';
import { sendTelegramMessage } from './_lib/telegram.js';
import { createAlertIfNotExists, timestampToDate } from './_lib/alerts.js';

/**
 * Firestore collections used:
 * - READ: investments
 * - WRITE: risk_alerts
 */
async function legacyHandler(req, context) {
  if (!['GET', 'POST'].includes(req.method)) {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  const lookbackHours = Number(process.env.DUPLICATE_INVESTMENT_LOOKBACK_HOURS || 24);
  const windowMinutes = Number(process.env.DUPLICATE_INVESTMENT_WINDOW_MINUTES || 10);

  try {
    const db = getDb();
    const cutoff = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
    const investmentsSnap = await db.collection('investments').get();

    const byUserAmount = new Map();

    for (const doc of investmentsSnap.docs) {
      const row = doc.data() || {};
      const userId = row.userId || row.uid;
      const amount = Number(row.amount);
      const createdAt = timestampToDate(row.createdAt || row.timestamp || row.executedAt);

      if (!userId || !Number.isFinite(amount) || !createdAt || createdAt < cutoff) {
        continue;
      }

      const key = `${userId}::${amount}`;
      if (!byUserAmount.has(key)) {
        byUserAmount.set(key, []);
      }

      byUserAmount.get(key).push({
        id: doc.id,
        userId,
        memberId: row.memberId || null,
        amount,
        createdAt,
        raw: row
      });
    }

    let newAlerts = 0;
    const createdGroups = [];

    for (const [, items] of byUserAmount.entries()) {
      items.sort((a, b) => a.createdAt - b.createdAt);

      let cluster = [];
      for (const item of items) {
        if (cluster.length === 0) {
          cluster.push(item);
          continue;
        }

        const previous = cluster[cluster.length - 1];
        const minutesDiff = (item.createdAt - previous.createdAt) / (1000 * 60);

        if (minutesDiff <= windowMinutes) {
          cluster.push(item);
        } else {
          if (cluster.length >= 2) {
            const result = await createDuplicateAlert(db, cluster);
            if (result.created) {
              newAlerts += 1;
              createdGroups.push(result.summary);
            }
          }
          cluster = [item];
        }
      }

      if (cluster.length >= 2) {
        const result = await createDuplicateAlert(db, cluster);
        if (result.created) {
          newAlerts += 1;
          createdGroups.push(result.summary);
        }
      }
    }

    if (createdGroups.length > 0) {
      const details = createdGroups.slice(0, 20).map((group, index) => (
        `${index + 1}) ${group.userId} (${group.memberId || 'no-memberId'})\n` +
        `amount=${group.amount}, count=${group.count}, likelyAffectedBalance=${group.likelyAffectedBalance}\n` +
        `investmentIds=${group.investmentDocIds.join(', ')}\n` +
        `timestamps=${group.timestamps.join(', ')}`
      ));

      const message = [
        '🚨 <b>Duplicate Investment Alert</b>',
        `New duplicate alerts: <b>${createdGroups.length}</b>`,
        '',
        ...details
      ].join('\n');

      await sendTelegramMessage(message);
    }

    return new Response(JSON.stringify({
        ok: true,
        scannedInvestments: investmentsSnap.size,
        newAlerts
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

async function createDuplicateAlert(db, cluster) {
  const first = cluster[0];
  const last = cluster[cluster.length - 1];
  const amount = first.amount;
  const count = cluster.length;
  const timestamps = cluster.map((x) => x.createdAt.toISOString());
  const investmentDocIds = cluster.map((x) => x.id);
  const likelyAffectedBalance = amount * count;

  const alertKey = [
    'risk:duplicate_investment',
    first.userId,
    amount,
    first.createdAt.toISOString(),
    last.createdAt.toISOString(),
    count
  ].join(':');

  const response = await createAlertIfNotExists({
    db,
    alertKey,
    alertType: 'duplicate_investment',
    payload: {
      userId: first.userId,
      memberId: first.memberId,
      amount,
      count,
      timestamps,
      likelyAffectedBalance,
      investmentDocIds
    }
  });

  return {
    created: response.created,
    summary: {
      userId: first.userId,
      memberId: first.memberId,
      amount,
      count,
      timestamps,
      likelyAffectedBalance,
      investmentDocIds
    }
  };
}


import { runVercelHandler } from './_lib/vercel-adapter.js';

export async function handle(req, res) {
  return runVercelHandler(req, res, legacyHandler);
}
