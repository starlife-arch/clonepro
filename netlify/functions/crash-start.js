import { getDb, admin, json, cents, todayKey, generateCrashPoint, defaultCrashPool, notifyAdmins } from './_lib/crash.js';

export default async (req, context) => {
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);
  try {
    const { userId, betAmount, autoCashout } = await req.json();
    const amount = cents(betAmount);
    const auto = autoCashout === '' || autoCashout == null ? null : Math.floor(Number(autoCashout) * 100) / 100;
    if (!userId || !amount) return json({ success: false, error: 'Missing fields' }, 400);
    if (auto !== null && (!Number.isFinite(auto) || auto <= 1)) return json({ success: false, error: 'Auto cashout must be above 1.00x' }, 400);
    const db = getDb();
    const userRef = db.collection('users').doc(userId);
    const poolRef = db.collection('gamePools').doc('crash');
    const sessionRef = db.collection('gameSessions').doc();
    const crashPoint = Math.round(generateCrashPoint() * 100) / 100;
    const day = todayKey();
    let pausedMessage = '';
    await db.runTransaction(async (t) => {
      const [userSnap, poolSnap] = await Promise.all([t.get(userRef), t.get(poolRef)]);
      if (!userSnap.exists) throw new Error('User not found');
      const user = userSnap.data() || {};
      const pool = { ...defaultCrashPool(), ...(poolSnap.exists ? poolSnap.data() : {}) };
      const dailyTotal = pool.dailyPayoutDate === day ? Number(pool.dailyPayoutTotal || 0) : 0;
      if (amount < Number(pool.minBet) || amount > Number(pool.maxBet)) throw new Error(`Bet must be between $${Number(pool.minBet).toFixed(2)} and $${Number(pool.maxBet).toFixed(2)}`);
      if (pool.enabled === false) throw new Error('Crash is paused');
      if (Number(pool.balance || 0) < Number(pool.reserveMinimum || 0)) { pausedMessage = '💥 Crash pool is below reserve and has been paused.'; throw new Error('Crash pool below reserve'); }
      if (dailyTotal >= Number(pool.dailyPayoutCap || 1000)) throw new Error('Daily payout cap reached');
      const balance = Number(user.gameWallet?.balance ?? user.gameWalletBalance ?? 0);
      if (balance < amount) throw new Error('Insufficient Game Wallet balance');
      t.update(userRef, { 'gameWallet.balance': cents(balance - amount), gameWalletBalance: cents(balance - amount) });
      t.set(poolRef, { ...(!poolSnap.exists ? defaultCrashPool() : {}), balance: cents(Number(pool.balance || 0) + amount * 0.85), dailyPayoutDate: day, dailyPayoutTotal: dailyTotal, totalBetsAllTime: cents(Number(pool.totalBetsAllTime || 0) + amount), totalProfitAllTime: cents(Number(pool.totalProfitAllTime || 0) + amount * 0.15), lastBetAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      t.set(db.collection('platformFees').doc(), { type: 'crash_lost_bet_house_edge', amt: cents(amount * 0.15), uid: userId, sessionId: sessionRef.id, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      t.set(sessionRef, { game: 'crash', userId, userName: user.name || user.fullName || 'Member', userEmail: user.email || '', betAmount: amount, crashPoint, autoCashout: auto, status: 'active', startedAtMs: Date.now(), startedAt: admin.firestore.FieldValue.serverTimestamp() });
      t.set(db.collection('activity').doc(), { uid: userId, desc: `💥 Crash bet placed. Bet: $${amount.toFixed(2)}`, amt: -amount, icon: '💥', type: 'game', createdAt: admin.firestore.FieldValue.serverTimestamp() });
    });
    return json({ success: true, sessionId: sessionRef.id, crashPoint });
  } catch (e) {
    if (String(e.message).includes('below reserve')) { try { const db = getDb(); await db.collection('gamePools').doc('crash').set({ enabled: false }, { merge: true }); await notifyAdmins(db, '💥 Crash pool is below reserve and has been paused.'); } catch (_) {} }
    return json({ success: false, error: e.message }, 400);
  }
};
