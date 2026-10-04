import { getDb, admin, json, cents, todayKey, sendPredictionEmail, asDate } from './_lib/predictions.js';

async function netlifyHandler(req, context) {
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);
  try {
    const { userId, eventId, outcomeId, betAmount } = await req.json();
    const amount = cents(betAmount);
    if (!userId || !eventId || !outcomeId) return json({ success: false, error: 'Missing fields' }, 400);
    const db = getDb();
    const userRef = db.collection('users').doc(userId);
    const eventRef = db.collection('predictionEvents').doc(eventId);
    const poolRef = db.collection('gamePools').doc('predictions');
    const dup = await db.collection('predictionBets').where('userId', '==', userId).where('eventId', '==', eventId).where('outcomeId', '==', outcomeId).where('status', '==', 'pending').limit(1).get();
    if (!dup.empty) return json({ success: false, error: 'You already bet this outcome' }, 400);
    let betData, userData;
    await db.runTransaction(async (t) => {
      const [userSnap, eventSnap, poolSnap] = await Promise.all([t.get(userRef), t.get(eventRef), t.get(poolRef)]);
      if (!userSnap.exists) throw new Error('User not found');
      if (!eventSnap.exists) throw new Error('Event not found');
      userData = userSnap.data() || {};
      const event = eventSnap.data() || {};
      const pool = poolSnap.exists ? (poolSnap.data() || {}) : {};
      const minBet = Number(pool.minBet ?? 1), maxBet = Number(pool.maxBet ?? 50);
      if (amount < minBet || amount > maxBet) throw new Error(`Bet must be between $${minBet} and $${maxBet}`);
      if (event.status !== 'open') throw new Error('Event is not open');
      const deadline = asDate(event.bettingDeadline);
      if (deadline && deadline.getTime() <= Date.now()) throw new Error('Betting deadline has passed');
      const day = todayKey();
      const dailyTotal = pool.dailyPayoutDate === day ? Number(pool.dailyPayoutTotal || 0) : 0;
      if (pool.enabled === false) throw new Error('Predictions are paused');
      // Do not block bet placement just because the pool is near reserve; settlement enforces payout safety.
      if (dailyTotal >= Number(pool.dailyPayoutCap || 1000)) throw new Error('Daily payout cap reached');
      const gameWallet = userData.gameWallet || {};
      const balance = Number(gameWallet.balance ?? userData.gameWalletBalance ?? 0);
      if (balance < amount) throw new Error('Insufficient Game Wallet balance');
      const outcome = (event.outcomes || []).find(o => o.id === outcomeId);
      if (!outcome) throw new Error('Outcome not found');
      const odds = Number(outcome.odds);
      const potentialPayout = cents(amount * odds);
      const betRef = db.collection('predictionBets').doc();
      betData = { eventId, eventTitle: event.title || '', userId, userName: userData.name || userData.fullName || 'Member', userEmail: userData.email || '', memberId: userData.memberId || userData.memberCode || '', outcomeId, outcomeLabel: outcome.label, odds, betAmount: amount, potentialPayout, status: 'pending', placedAt: admin.firestore.FieldValue.serverTimestamp(), settledAt: null, payout: null, bettingDeadline: event.bettingDeadline };
      t.update(userRef, { 'gameWallet.balance': cents(balance - amount), gameWalletBalance: cents(balance - amount) });
      t.set(poolRef, { balance: admin.firestore.FieldValue.increment(cents(amount * 0.85)), totalBetsAllTime: admin.firestore.FieldValue.increment(amount), dailyPayoutDate: day }, { merge: true });
      t.set(db.collection('platformFees').doc(), { type: 'prediction_lost_bet_house_edge', amt: cents(amount * 0.15), uid: userId, eventId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      t.set(betRef, betData);
      t.update(eventRef, { totalBets: admin.firestore.FieldValue.increment(1), totalBetAmount: admin.firestore.FieldValue.increment(amount) });
      t.set(db.collection('userNotifs').doc(), { uid: userId, msg: `🔮 Bet placed on ${outcome.label} @ ${odds}x for $${amount.toFixed(2)}. Event: ${event.title}.`, read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      t.set(db.collection('activity').doc(), { uid: userId, desc: `🔮 Prediction bet — ${event.title} — ${outcome.label} @ ${odds}x. Bet: $${amount.toFixed(2)}`, amt: -amount, icon: '🔮', type: 'game', createdAt: admin.firestore.FieldValue.serverTimestamp() });
    });
    await sendPredictionEmail('prediction_bet_placed', userData.email, { name: betData.userName, eventTitle: betData.eventTitle, outcomeLabel: betData.outcomeLabel, odds: betData.odds, betAmount: amount, potentialPayout: betData.potentialPayout, bettingDeadline: asDate(betData.bettingDeadline)?.toLocaleString() || '' });
    return json({ success: true });
  } catch (e) { return json({ success: false, error: e.message }, 400); }
};


import { runNetlifyHandler } from './_lib/vercel-adapter.js';

export default async function handler(req, res) {
  return runNetlifyHandler(req, res, netlifyHandler);
}
