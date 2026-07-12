import { getDb, admin, json, publicMember } from './_lib/money-features.js';

export default async (req, context) => {
  try {
    const { userId, memberId } = await req.json();
    const lookupId = String(memberId || '').trim().toUpperCase();
    if (!userId || !lookupId) return json({ success: false, error: 'Missing user or Member ID' }, 400);
    const db = getDb();
    const usersSnap = await db.collection('users').get();
    const targetDoc = usersSnap.docs.find(d => String(d.data().memberId || d.data().memberCode || d.id.slice(0, 8)).toUpperCase() === lookupId);
    if (!targetDoc) return json({ success: false, error: 'Member not found' }, 404);
    const requesterRef = db.collection('users').doc(userId);
    let result;
    await db.runTransaction(async t => {
      const [requesterSnap, targetSnap] = await Promise.all([t.get(requesterRef), t.get(targetDoc.ref)]);
      if (!requesterSnap.exists) throw new Error('Requester not found');
      const requester = requesterSnap.data() || {}, target = targetSnap.data() || {};
      const available = Number(requester.balance || 0) - Number(requester.heldAmount || 0);
      if (available < 1200) throw new Error('Insufficient available balance for the $1,200 lookup fee');
      t.update(requesterRef, { balance: admin.firestore.FieldValue.increment(-1200) });
      const logRef = db.collection('memberLookups').doc();
      t.set(logRef, { requestedBy: userId, requestedByName: requester.name || requester.fullName || 'Member', targetUid: targetDoc.id, targetMemberId: lookupId, amountCharged: 1200, timestamp: admin.firestore.FieldValue.serverTimestamp() });
      t.set(db.collection('activity').doc(), { uid: userId, desc: `🔍 Member lookup fee for ${lookupId}`, amt: -1200, icon: '🔍', type: 'member_lookup', createdAt: admin.firestore.FieldValue.serverTimestamp() });
      t.set(db.collection('platformAccounts').doc('operations'), { balance: admin.firestore.FieldValue.increment(1200), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      t.set(db.collection('platformAccountLogs').doc(), { account: 'operations', type: 'credit', amount: 1200, note: `Member lookup fee: ${userId} → ${lookupId}`, txRef: `ML-${Date.now()}`, createdAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: 'system' });
      result = publicMember(targetDoc.id, target);
    });
    return json({ success: true, member: result });
  } catch (e) { return json({ success: false, error: e.message || 'Lookup failed' }, 400); }
};
