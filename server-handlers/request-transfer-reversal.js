import { getDb, admin, json, cents, notifyReversal } from './_lib/money-features.js';

const oldTransferMessage = 'This transaction ID could not be found in our system. This may be because it predates our reversal tracking system. Please contact support and provide your transaction ID — our team can process the reversal manually.';

async function netlifyHandler(req, context) {
  try {
    const { userId, txId, reason = '' } = await req.json();
    const id = String(txId || '').trim().toUpperCase();
    if (!userId || !id) return json({ success: false, error: 'Missing user or transaction ID' }, 400);
    const db = getDb();

    let transferRef = db.collection('transfers').doc(id);
    let transferSnap = await transferRef.get();
    if (!transferSnap.exists) {
      const actSnap = await db.collection('activity').where('uid', '==', userId).where('txId', '==', id).get();
      if (actSnap.empty) throw new Error(oldTransferMessage);
      const act = actSnap.docs[0].data() || {};
      if (!act.toUid && !act.fromUid) throw new Error(oldTransferMessage);
      transferRef = db.collection('transfers').doc(id);
      transferSnap = await transferRef.get();
      if (!transferSnap.exists) {
        const fromUid = act.amt < 0 ? userId : act.fromUid;
        const toUid = act.toUid || (act.amt > 0 ? userId : null);
        if (!fromUid || !toUid || fromUid !== userId) throw new Error(oldTransferMessage);
        const [fromSnap, toSnap] = await Promise.all([db.collection('users').doc(fromUid).get(), db.collection('users').doc(toUid).get()]);
        await transferRef.set({ fromUid, fromName: act.fromName || fromSnap.data()?.name || 'Member', toUid, toName: act.toName || toSnap.data()?.name || 'Member', amount: Math.abs(Number(act.amt || 0)), fee: 0, received: Math.abs(Number(act.amt || 0)), type: 'cash', method: 'internal', status: 'completed', createdAt: act.createdAt || admin.firestore.FieldValue.serverTimestamp(), reversalStatus: null, reconstructedFromActivity: true }, { merge: true });
        transferSnap = await transferRef.get();
      }
    }

    let transfer;
    await db.runTransaction(async t => {
      const ts = await t.get(transferRef);
      if (!ts.exists) throw new Error(oldTransferMessage);
      const tr = ts.data() || {};
      if (tr.fromUid !== userId) throw new Error('Only the original sender can request this reversal');
      if (tr.type !== 'cash') throw new Error('Only cash transfers can be reversed');
      if (tr.status === 'reversed' || tr.reversalStatus) throw new Error('This transfer already has a reversal status');
      const receiverRef = db.collection('users').doc(tr.toUid);
      const rs = await t.get(receiverRef);
      if (!rs.exists) throw new Error('Recipient account not found');
      const r = rs.data() || {};
      const available = Number(r.balance || 0) - Number(r.heldAmount || 0);
      if (available < Number(tr.received || 0)) throw new Error("This transaction can't be reversed right now — the recipient doesn't have sufficient available balance. You can try again later.");
      t.update(receiverRef, { heldAmount: admin.firestore.FieldValue.increment(cents(tr.received)) });
      t.update(transferRef, { reversalStatus: 'pending', reversalRequestedAt: admin.firestore.FieldValue.serverTimestamp(), reversalRequestedBy: userId });
      t.set(db.collection('transferReversals').doc(id), { txId: id, requesterId: tr.fromUid, requesterName: tr.fromName || 'Member', recipientId: tr.toUid, recipientName: tr.toName || 'Member', amount: cents(tr.received || tr.amount), reason: String(reason || 'No reason provided').slice(0, 300), status: 'pending', requestedAt: admin.firestore.FieldValue.serverTimestamp(), resolvedAt: null, resolvedBy: null }, { merge: true });
      transfer = { id, txId: id, ...tr };
    });
    await notifyReversal(db, transfer, 'requested');
    return json({ success: true });
  } catch (e) { return json({ success: false, error: e.message || 'Request failed' }, 400); }
};


import { runNetlifyHandler } from './_lib/vercel-adapter.js';

export default async function handler(req, res) {
  return runNetlifyHandler(req, res, netlifyHandler);
}
