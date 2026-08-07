import { getDb, admin, json, cents } from './_lib/battle-royale.js';

async function netlifyHandler(req) {
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);
  try {
    const { userId, points } = await req.json();
    const pts = Number(points || 0);
    if (!userId || pts < 1000 || pts % 1000 !== 0) return json({ success: false, error: 'Redeem points in multiples of 1000' }, 400);
    const usd = cents(pts / 1000);
    const db = getDb();
    await db.runTransaction(async (t) => {
      const ur = db.collection('users').doc(userId);
      const pr = db.collection('gamePools').doc('pointsPool');
      const [us, ps] = await Promise.all([t.get(ur), t.get(pr)]);
      if (!us.exists) throw new Error('User not found');
      const u = us.data() || {};
      const p = ps.exists ? (ps.data() || {}) : { enabled: true, balance: 0 };
      if (p.enabled === false) throw new Error('Points redemption temporarily unavailable. Please try again later.');
      if (Number(u.points || 0) < pts) throw new Error('Insufficient points');
      t.update(ur, {
        points: admin.firestore.FieldValue.increment(-pts),
        'gameWallet.balance': admin.firestore.FieldValue.increment(usd),
        gameWalletBalance: admin.firestore.FieldValue.increment(usd),
      });
      t.set(pr, {
        enabled: p.enabled !== false,
        balance: admin.firestore.FieldValue.increment(-usd),
        totalRedeemedAllTime: admin.firestore.FieldValue.increment(usd),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      t.set(ur.collection('pointsHistory').doc(), { points: -pts, desc: `Points redeemed — ${pts} pts → $${usd.toFixed(2)}`, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      t.set(db.collection('activity').doc(), { uid: userId, desc: `🏅 Points redeemed — ${pts} pts → $${usd.toFixed(2)}`, amt: usd, icon: '🏅', type: 'points_redeem', createdAt: admin.firestore.FieldValue.serverTimestamp() });
    });
    return json({ success: true, usdCredited: usd });
  } catch (e) {
    return json({ success: false, error: e.message || 'Redeem failed' }, 500);
  }
};


import { runNetlifyHandler } from './_lib/vercel-adapter.js';

export default async function handler(req, res) {
  return runNetlifyHandler(req, res, netlifyHandler);
}
