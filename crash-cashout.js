import { getDb, admin, json, cents, todayKey, sleep, defaultCrashPool, maybeNotifyLowBalance } from './_lib/crash.js';

async function netlifyHandler(req, context) {
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);
  try {
    const { userId, sessionId, cashoutMultiplier, outcome } = await req.json();
    if (!userId || !sessionId || !['cashout', 'crashed'].includes(outcome)) return json({ success: false, error: 'Missing fields' }, 400);
    const db = getDb();
    const sessionRef = db.collection('gameSessions').doc(sessionId);
    const firstSnap = await sessionRef.get();
    if (!firstSnap.exists) return json({ success: false, error: 'Session not found' }, 404);
    const first = firstSnap.data() || {};
    if (first.userId !== userId || first.status !== 'active') return json({ success: false, error: 'Session is not active' }, 400);
    const poolSnap = await db.collection('gamePools').doc('crash').get();
    const delay = Number((poolSnap.data() || {}).autoCashoutDelayMs ?? 500);
    if (outcome === 'cashout' && first.autoCashout && Math.abs(Number(cashoutMultiplier) - Number(first.autoCashout)) < 0.02) await sleep(delay);
    let response = { success: true };
    let lowBalanceUserRef = null, lowBalanceUserData = null, lowBalance = null;
    await db.runTransaction(async (t) => {
      const snap = await t.get(sessionRef);
      if (!snap.exists) throw new Error('Session not found');
      const s = snap.data() || {};
      if (s.userId !== userId || s.status !== 'active') throw new Error('Session is not active');
      const betAmount = Number(s.betAmount || 0), crashPoint = Number(s.crashPoint || 1);
      const userRef = db.collection('users').doc(userId);
      const poolRef = db.collection('gamePools').doc('crash');
      const [userSnap, poolTxSnap] = await Promise.all([t.get(userRef), t.get(poolRef)]);
      const user = userSnap.data() || {}, pool = { ...defaultCrashPool(), ...(poolTxSnap.data() || {}) };
      const walletBalance = Number(user.gameWallet?.balance ?? user.gameWalletBalance ?? 0);
      if (outcome === 'cashout') {
        const mult = Math.floor(Number(cashoutMultiplier || 0) * 100) / 100;
        if (!Number.isFinite(mult) || mult <= 1) throw new Error('Invalid cashout multiplier');
        const serverElapsed = s.startedAtMs ? (Date.now() - Number(s.startedAtMs)) / 1000 : 0;
        const delayedMultiplier = s.autoCashout && Math.abs(mult - Number(s.autoCashout)) < 0.02 ? Math.pow(1.06, serverElapsed) : mult;
        if (mult >= crashPoint || delayedMultiplier >= crashPoint) { response = { success: false, crashed: true, crashPoint }; return; }
        const grossPayout = Math.floor(betAmount * mult * 100) / 100;
        const profit = grossPayout - betAmount;
        const houseCut = Math.floor(profit * 0.05 * 100) / 100;
        const netPayout = cents(grossPayout - houseCut);
        const day = todayKey();
        const dailyTotal = pool.dailyPayoutDate === day ? Number(pool.dailyPayoutTotal || 0) : 0;
        if (Number(pool.balance || 0) - netPayout < Number(pool.reserveMinimum || 0)) throw new Error('Crash pool reserve would be breached');
        if (dailyTotal + netPayout > Number(pool.dailyPayoutCap || 1000)) throw new Error('Daily payout cap reached');
        t.update(userRef, { 'gameWallet.balance': cents(walletBalance + netPayout), gameWalletBalance: cents(walletBalance + netPayout), 'gameWallet.totalWon': admin.firestore.FieldValue.increment(netPayout) });
        t.set(poolRef, { balance: admin.firestore.FieldValue.increment(-netPayout), dailyPayoutDate: day, dailyPayoutTotal: admin.firestore.FieldValue.increment(netPayout), totalPayoutsAllTime: admin.firestore.FieldValue.increment(netPayout), totalProfitAllTime: admin.firestore.FieldValue.increment(houseCut) }, { merge: true });
        t.update(sessionRef, { status: 'completed', outcome: 'cashout', cashoutMultiplier: mult, payout: netPayout, completedAt: admin.firestore.FieldValue.serverTimestamp() });
        t.set(db.collection('userNotifs').doc(), { uid: userId, msg: `💥 Cashed out at ${mult.toFixed(2)}x — $${netPayout.toFixed(2)} added to Game Wallet!`, read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        t.set(db.collection('activity').doc(), { uid: userId, desc: `💥 Crash — Cashed out at ${mult.toFixed(2)}x. Won: $${netPayout.toFixed(2)}`, amt: netPayout, icon: '💥', type: 'game', createdAt: admin.firestore.FieldValue.serverTimestamp() });
        response = { success: true, payout: netPayout };
        lowBalanceUserRef = userRef; lowBalanceUserData = user; lowBalance = cents(walletBalance + netPayout);
      } else {
        t.update(userRef, { 'gameWallet.totalLost': admin.firestore.FieldValue.increment(betAmount) });
        t.update(sessionRef, { status: 'completed', outcome: 'crashed', payout: 0, completedAt: admin.firestore.FieldValue.serverTimestamp() });
        t.set(db.collection('userNotifs').doc(), { uid: userId, msg: `💥 Crashed at ${crashPoint.toFixed(2)}x. You lost $${betAmount.toFixed(2)}.`, read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        t.set(db.collection('activity').doc(), { uid: userId, desc: `💥 Crash — Crashed at ${crashPoint.toFixed(2)}x. Lost: $${betAmount.toFixed(2)}`, amt: -betAmount, icon: '💥', type: 'game', createdAt: admin.firestore.FieldValue.serverTimestamp() });
        lowBalanceUserRef = userRef; lowBalanceUserData = user; lowBalance = walletBalance;
      }
    });
    if (lowBalanceUserRef) await maybeNotifyLowBalance(db, lowBalanceUserRef, lowBalanceUserData, lowBalance);
    return json(response);
  } catch (e) { return json({ success: false, error: e.message }, 400); }
};


import { runNetlifyHandler } from './_lib/vercel-adapter.js';

export default async function handler(req, res) {
  return runNetlifyHandler(req, res, netlifyHandler);
}
