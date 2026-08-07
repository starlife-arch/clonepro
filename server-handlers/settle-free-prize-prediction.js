import { getDb, admin, json, cents, sendPredictionEmail, isAdminUser } from './_lib/predictions.js';

async function legacyHandler(req) {
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);
  try {
    const { eventId, winningOutcomeId, adminId } = await req.json();
    if (!eventId || !winningOutcomeId || !adminId) return json({ success: false, error: 'Missing fields' }, 400);
    const db = getDb();
    if (!(await isAdminUser(db, adminId))) return json({ success: false, error: 'Admin required' }, 403);
    const eventRef = db.collection('predictionEvents').doc(eventId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) throw new Error('Event not found');
    const event = eventSnap.data() || {};
    if (event.eventMode !== 'free_prize') throw new Error('Not a free prize prediction');
    if (event.settled === true || event.status === 'settled') throw new Error('Event already settled');
    const winningOutcome = (event.outcomes || []).find(o => o.id === winningOutcomeId) || { id: winningOutcomeId, label: winningOutcomeId };
    const betsSnap = await db.collection('predictionBets').where('eventId', '==', eventId).where('status', '==', 'pending').get();
    const bets = betsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const winners = bets.filter(b => b.outcomeId === winningOutcomeId);
    const losers = bets.filter(b => b.outcomeId !== winningOutcomeId);
    const prize = cents(event.prize || 0);
    const correctCount = winners.length;
    const prizePerWinner = correctCount > 0 ? Math.floor((prize / correctCount) * 100) / 100 : 0;
    const totalPaid = cents(prizePerWinner * correctCount);
    const remainder = cents(prize - totalPaid);
    const settledAt = new Date();

    for (const bet of winners) {
      await db.runTransaction(async (t) => {
        const userRef = db.collection('users').doc(bet.userId);
        const us = await t.get(userRef);
        if (!us.exists) throw new Error('Winner user not found');
        const u = us.data() || {};
        const bal = Number(u.gameWallet?.balance ?? u.gameWalletBalance ?? 0);
        t.update(userRef, { 'gameWallet.balance': cents(bal + prizePerWinner), gameWalletBalance: cents(bal + prizePerWinner), 'gameWallet.totalWon': admin.firestore.FieldValue.increment(prizePerWinner) });
        t.update(db.collection('predictionBets').doc(bet.id), { status: 'won', payout: prizePerWinner, settledAt: admin.firestore.FieldValue.serverTimestamp() });
        t.set(db.collection('userNotifs').doc(), { uid: bet.userId, msg: `🎁 You predicted correctly! $${prizePerWinner.toFixed(2)} has been added to your Game Wallet from the ${event.title} free prize prediction.`, read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        t.set(db.collection('activity').doc(), { uid: bet.userId, desc: `🎁 Free Prize Prediction win — ${event.title}. Won: $${prizePerWinner.toFixed(2)}`, amt: prizePerWinner, icon: '🎁', type: 'game', createdAt: admin.firestore.FieldValue.serverTimestamp() });
      });
      await sendPredictionEmail('free_prize_won', bet.userEmail, { name: bet.userName, title: event.title, eventTitle: event.title, outcomeLabel: bet.outcomeLabel, resultLabel: winningOutcome.label, prizePerWinner, correctCount, settledAt: settledAt.toLocaleString() });
    }

    for (const bet of losers) {
      await db.collection('predictionBets').doc(bet.id).update({ status: 'lost', payout: 0, settledAt: admin.firestore.FieldValue.serverTimestamp() });
      await db.collection('userNotifs').add({ uid: bet.userId, msg: `The free prize prediction '${event.title}' has been settled. The correct answer was ${winningOutcome.label}. Better luck next time!`, read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    }

    const refund = correctCount === 0 ? prize : remainder;
    if (refund > 0) await db.collection('gamePools').doc('prizePredictions').set({ balance: admin.firestore.FieldValue.increment(refund) }, { merge: true });
    if (totalPaid > 0) await db.collection('gamePools').doc('prizePredictions').set({ totalPaidAllTime: admin.firestore.FieldValue.increment(totalPaid) }, { merge: true });
    await eventRef.update({ status: 'settled', settled: true, result: winningOutcomeId, resultLabel: winningOutcome.label, correctEntries: correctCount, prizePerWinner, settledAt: admin.firestore.FieldValue.serverTimestamp(), settledBy: adminId });
    return json({ success: true, winnersCount: correctCount, prizePerWinner, totalPaid });
  } catch (e) { return json({ success: false, error: e.message }, 400); }
};


import { runVercelHandler } from './_lib/vercel-adapter.js';

export default async function handler(req, res) {
  return runVercelHandler(req, res, legacyHandler);
}
