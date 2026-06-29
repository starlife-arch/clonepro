import { getDb, admin, json, cents, isAdminUser } from './_lib/predictions.js';

export default async (req, context) => {
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);
  try {
    const { eventId, adminId } = await req.json();
    if (!eventId || !adminId) return json({ success: false, error: 'Missing fields' }, 400);
    const db = getDb();
    if (!(await isAdminUser(db, adminId))) return json({ success: false, error: 'Admin required' }, 403);
    const eventSnap = await db.collection('predictionEvents').doc(eventId).get();
    if (!eventSnap.exists) throw new Error('Event not found');
    const event = eventSnap.data() || {};
    const betsSnap = await db.collection('predictionBets').where('eventId', '==', eventId).where('status', '==', 'pending').get();
    let totalRefunded = 0;
    for (const doc of betsSnap.docs) {
      const bet = { id: doc.id, ...doc.data() };
      const amount = cents(bet.betAmount);
      await db.runTransaction(async (t) => {
        const userRef = db.collection('users').doc(bet.userId);
        const us = await t.get(userRef);
        if (!us.exists) throw new Error('User not found');
        const u = us.data() || {}, bal = Number(u.gameWallet?.balance ?? u.gameWalletBalance ?? 0);
        t.update(userRef, { 'gameWallet.balance': cents(bal + amount), gameWalletBalance: cents(bal + amount) });
        t.update(db.collection('predictionBets').doc(bet.id), { status: 'refunded', payout: amount, settledAt: admin.firestore.FieldValue.serverTimestamp() });
        t.set(db.collection('userNotifs').doc(), { uid: bet.userId, msg: `Your $${amount.toFixed(2)} bet on ${event.title} has been refunded — event cancelled.`, read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      });
      totalRefunded = cents(totalRefunded + amount);
    }
    await db.collection('gamePools').doc('predictions').set({ balance: admin.firestore.FieldValue.increment(-totalRefunded) }, { merge: true });
    await db.collection('predictionEvents').doc(eventId).update({ status: 'cancelled', cancelledAt: admin.firestore.FieldValue.serverTimestamp(), cancelledBy: adminId });
    return json({ success: true, totalRefunded });
  } catch (e) { return json({ success: false, error: e.message }, 400); }
};
