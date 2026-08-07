import { getDb, admin, json, cents, todayKey, notifyAdmins } from './_lib/crash.js';

const defaultSnakePool = () => ({ balance: 500, reserveMinimum: 200, dailyPayoutCap: 500, dailyPayoutTotal: 0, dailyPayoutDate: todayKey(), totalBetsAllTime: 0, totalPayoutsAllTime: 0, totalProfitAllTime: 0, enabled: true, minBet: 0.50, maxBet: 100, maxTransferIn: 500 });

async function legacyHandler(req, context) {
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);
  try {
    const { userId, betAmount } = await req.json();
    const amount = cents(betAmount);
    if (!userId || !amount) return json({ success: false, error: 'Missing fields' }, 400);
    const db = getDb();
    const userRef = db.collection('users').doc(userId);
    const poolRef = db.collection('gamePools').doc('snake');
    const sessionRef = db.collection('gameSessions').doc();
    const day = todayKey();
    await db.runTransaction(async (t) => {
      const [userSnap, poolSnap] = await Promise.all([t.get(userRef), t.get(poolRef)]);
      if (!userSnap.exists) throw new Error('User not found');
      const user = userSnap.data() || {};
      const pool = { ...defaultSnakePool(), ...(poolSnap.exists ? poolSnap.data() : {}) };
      const dailyTotal = pool.dailyPayoutDate === day ? Number(pool.dailyPayoutTotal || 0) : 0;
      if (amount < Number(pool.minBet) || amount > Number(pool.maxBet)) throw new Error(`Bet must be between $${Number(pool.minBet).toFixed(2)} and $${Number(pool.maxBet).toFixed(2)}`);
      if (pool.enabled === false) throw new Error('Snake is currently unavailable. Check back soon.');
      // Allow the session to start; reserve limits are enforced when a cashout payout is requested.
      if (dailyTotal >= Number(pool.dailyPayoutCap || 500)) throw new Error('Daily limit reached. Snake resets at midnight.');
      const balance = Number(user.gameWallet?.balance ?? user.gameWalletBalance ?? 0);
      if (balance < amount) throw new Error('Insufficient Game Wallet balance. Add funds to play.');
      t.update(userRef, { 'gameWallet.balance': cents(balance - amount), gameWalletBalance: cents(balance - amount) });
      t.set(poolRef, { ...(!poolSnap.exists ? defaultSnakePool() : {}), balance: cents(Number(pool.balance || 0) + amount * 0.85), dailyPayoutDate: day, dailyPayoutTotal: dailyTotal, totalBetsAllTime: cents(Number(pool.totalBetsAllTime || 0) + amount), totalProfitAllTime: cents(Number(pool.totalProfitAllTime || 0) + amount * 0.15), lastBetAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      t.set(db.collection('platformFees').doc(), { type: 'snake_house_edge', amt: cents(amount * 0.15), uid: userId, sessionId: sessionRef.id, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      t.set(sessionRef, { game: 'snake', userId, userName: user.name || user.fullName || 'Member', userEmail: user.email || '', betAmount: amount, status: 'active', startedAt: admin.firestore.FieldValue.serverTimestamp() });
      t.set(db.collection('activity').doc(), { uid: userId, desc: `🐍 Snake bet placed. Bet: $${amount.toFixed(2)}`, amt: -amount, icon: '🐍', type: 'game', createdAt: admin.firestore.FieldValue.serverTimestamp() });
    });
    return json({ success: true, sessionId: sessionRef.id });
  } catch (e) {
    return json({ success: false, error: e.message }, 400);
  }
};


import { runVercelHandler } from './_lib/vercel-adapter.js';

export default async function handler(req, res) {
  return runVercelHandler(req, res, legacyHandler);
}
