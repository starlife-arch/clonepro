import { getDb, admin, json, cents, todayKey, sendPredictionEmail, isAdminUser } from './_lib/predictions.js';

export default async (req, context) => {
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);
  try {
    const { eventId, winningOutcomeId, adminId } = await req.json();
    console.log('settle-predictions winningOutcomeId:', winningOutcomeId);
    if (!eventId || !winningOutcomeId || !adminId) return json({ success: false, error: 'Missing fields' }, 400);
    const db = getDb();
    if (!(await isAdminUser(db, adminId))) return json({ success: false, error: 'Admin required' }, 403);
    const eventRef = db.collection('predictionEvents').doc(eventId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) throw new Error('Event not found');
    const event = eventSnap.data() || {};
    if (event.status !== 'closed') throw new Error('Event must be closed before settlement');
    const betsSnap = await db.collection('predictionBets').where('eventId', '==', eventId).where('status', '==', 'pending').get();
    const bets = betsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const settledAt = new Date();
    let winnersCount = 0, totalPaidOut = 0;
    for (const bet of bets.filter(b => b.outcomeId !== winningOutcomeId)) {
      await db.collection('predictionBets').doc(bet.id).update({ status: 'lost', payout: 0, settledAt: admin.firestore.FieldValue.serverTimestamp() });
      await db.collection('userNotifs').add({ uid: bet.userId, msg: `😔 Your prediction on ${bet.outcomeLabel} for ${event.title} was incorrect. You lost $${Number(bet.betAmount || 0).toFixed(2)}.`, read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      await sendPredictionEmail('prediction_result_lost', bet.userEmail, { name: bet.userName, eventTitle: event.title, outcomeLabel: bet.outcomeLabel, betAmount: bet.betAmount, settledAt: settledAt.toLocaleString() });
    }
    for (const bet of bets.filter(b => b.outcomeId === winningOutcomeId)) {
      const grossPayout = cents(Number(bet.betAmount || 0) * Number(bet.odds || 0));
      const profit = cents(grossPayout - Number(bet.betAmount || 0));
      const houseCut = cents(profit * 0.05);
      const netPayout = cents(grossPayout - houseCut);
      await db.runTransaction(async (t) => {
        const userRef = db.collection('users').doc(bet.userId);
        const poolRef = db.collection('gamePools').doc('predictions');
        const [userSnap, poolSnap] = await Promise.all([t.get(userRef), t.get(poolRef)]);
        if (!userSnap.exists) throw new Error('Winner user not found');
        const u = userSnap.data() || {}, pool = poolSnap.data() || {};
        const day = todayKey();
        const dailyTotal = pool.dailyPayoutDate === day ? Number(pool.dailyPayoutTotal || 0) : 0;
        if (dailyTotal + netPayout > Number(pool.dailyPayoutCap || 1000)) throw new Error('Daily payout cap would be exceeded');
        const bal = Number(u.gameWallet?.balance ?? u.gameWalletBalance ?? 0);
        t.update(userRef, { 'gameWallet.balance': cents(bal + netPayout), gameWalletBalance: cents(bal + netPayout), 'gameWallet.totalWon': admin.firestore.FieldValue.increment(netPayout) });
        t.update(poolRef, { balance: admin.firestore.FieldValue.increment(-netPayout), dailyPayoutTotal: admin.firestore.FieldValue.increment(netPayout), dailyPayoutDate: day, totalPayoutsAllTime: admin.firestore.FieldValue.increment(netPayout), totalProfitAllTime: admin.firestore.FieldValue.increment(houseCut) });
        t.update(db.collection('predictionBets').doc(bet.id), { status: 'won', payout: netPayout, settledAt: admin.firestore.FieldValue.serverTimestamp() });
        t.set(db.collection('platformFees').doc(), { type: 'prediction_win_profit_house_cut', amt: houseCut, uid: bet.userId, eventId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        t.set(db.collection('userNotifs').doc(), { uid: bet.userId, msg: `🎉 Your prediction on ${bet.outcomeLabel} for ${event.title} was correct! $${netPayout.toFixed(2)} added to Game Wallet!`, read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        t.set(db.collection('activity').doc(), { uid: bet.userId, desc: `🔮 Prediction win — ${event.title} — ${bet.outcomeLabel} @ ${bet.odds}x. Won: $${netPayout.toFixed(2)}`, amt: netPayout, icon: '🔮', type: 'game', createdAt: admin.firestore.FieldValue.serverTimestamp() });
      });
      winnersCount += 1; totalPaidOut = cents(totalPaidOut + netPayout);
      await sendPredictionEmail('prediction_result_won', bet.userEmail, { name: bet.userName, eventTitle: event.title, outcomeLabel: bet.outcomeLabel, odds: bet.odds, betAmount: bet.betAmount, netPayout, settledAt: settledAt.toLocaleString() });
    }
    await eventRef.update({ status: 'settled', result: winningOutcomeId, settledAt: admin.firestore.FieldValue.serverTimestamp(), settledBy: adminId });
    return json({ success: true, winnersCount, totalPaidOut });
  } catch (e) { return json({ success: false, error: e.message }, 400); }
};
