import { getDb, admin, json, cents, todayKey, maybeNotifyLowBalance } from './_lib/crash.js';

const defaultSnakePool = () => ({ balance: 500, reserveMinimum: 200, dailyPayoutCap: 500, dailyPayoutTotal: 0, dailyPayoutDate: todayKey(), totalBetsAllTime: 0, totalPayoutsAllTime: 0, totalProfitAllTime: 0, enabled: true, minBet: 0.50, maxBet: 100, maxTransferIn: 500 });

export default async (req, context) => {
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);
  try {
    const { userId, sessionId, score, multiplier, outcome } = await req.json();
    if (!userId || !sessionId || !['cashout', 'died'].includes(outcome)) return json({ success: false, error: 'Missing fields' }, 400);
    const db = getDb();
    const sessionRef = db.collection('gameSessions').doc(sessionId);
    let response = { success: true, payout: 0 };
    let lowBalanceUserRef = null, lowBalanceUserData = null, lowBalance = null;
    await db.runTransaction(async (t) => {
      const snap = await t.get(sessionRef);
      if (!snap.exists) throw new Error('Session not found');
      const s = snap.data() || {};
      if (s.userId !== userId || s.status !== 'active') throw new Error('Session is not active');
      const betAmount = Number(s.betAmount || 0);
      const userRef = db.collection('users').doc(userId);
      const poolRef = db.collection('gamePools').doc('snake');
      const [userSnap, poolSnap] = await Promise.all([t.get(userRef), t.get(poolRef)]);
      const user = userSnap.data() || {}, pool = { ...defaultSnakePool(), ...(poolSnap.data() || {}) };
      const walletBalance = Number(user.gameWallet?.balance ?? user.gameWalletBalance ?? 0);
      const safeScore = Math.max(0, Number(score || 0));
      if (outcome === 'cashout') {
        const mult = Math.min(3, Math.max(1, Math.floor(Number(multiplier || 1) * 100) / 100));
        const payout = cents(Math.floor(betAmount * mult * 100) / 100);
        const day = todayKey();
        const dailyTotal = pool.dailyPayoutDate === day ? Number(pool.dailyPayoutTotal || 0) : 0;
        if (Number(pool.balance || 0) - payout < Number(pool.reserveMinimum || 0)) throw new Error('Snake pool reserve would be breached');
        if (dailyTotal + payout > Number(pool.dailyPayoutCap || 500)) throw new Error('Daily payout cap reached');
        t.update(userRef, { 'gameWallet.balance': cents(walletBalance + payout), gameWalletBalance: cents(walletBalance + payout), 'gameWallet.totalWon': admin.firestore.FieldValue.increment(payout) });
        t.set(poolRef, { balance: admin.firestore.FieldValue.increment(-payout), dailyPayoutDate: day, dailyPayoutTotal: admin.firestore.FieldValue.increment(payout), totalPayoutsAllTime: admin.firestore.FieldValue.increment(payout) }, { merge: true });
        t.update(sessionRef, { status: 'completed', outcome: 'cashout', payout, score: safeScore, multiplier: mult, completedAt: admin.firestore.FieldValue.serverTimestamp() });
        t.set(db.collection('userNotifs').doc(), { uid: userId, msg: `🐍 Cashed out at ${mult.toFixed(2)}x — $${payout.toFixed(2)} added to Game Wallet!`, read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        t.set(db.collection('activity').doc(), { uid: userId, desc: `🐍 Snake — Cashed out at ${mult.toFixed(2)}x. Won: $${payout.toFixed(2)}`, amt: payout, icon: '🐍', type: 'game', createdAt: admin.firestore.FieldValue.serverTimestamp() });
        response = { success: true, payout };
        lowBalance = cents(walletBalance + payout); lowBalanceUserRef = userRef; lowBalanceUserData = user;
      } else {
        t.update(userRef, { 'gameWallet.totalLost': admin.firestore.FieldValue.increment(betAmount) });
        t.update(sessionRef, { status: 'completed', outcome: 'lost', payout: 0, score: safeScore, completedAt: admin.firestore.FieldValue.serverTimestamp() });
        t.set(db.collection('userNotifs').doc(), { uid: userId, msg: `🐍 Game over. Score: ${safeScore}. You lost $${betAmount.toFixed(2)}.`, read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        t.set(db.collection('activity').doc(), { uid: userId, desc: `🐍 Snake — Game over. Score: ${safeScore}. Lost: $${betAmount.toFixed(2)}`, amt: -betAmount, icon: '🐍', type: 'game', createdAt: admin.firestore.FieldValue.serverTimestamp() });
        lowBalance = walletBalance; lowBalanceUserRef = userRef; lowBalanceUserData = user;
      }
    });
    if (lowBalanceUserRef) await maybeNotifyLowBalance(db, lowBalanceUserRef, lowBalanceUserData, lowBalance);
    return json(response);
  } catch (e) { return json({ success: false, error: e.message }, 400); }
};
