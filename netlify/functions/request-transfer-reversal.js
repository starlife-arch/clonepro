import { getDb, admin, json, cents, notifyReversal } from './_lib/money-features.js';

export default async (req, context) => {
  try {
    const { userId, txId } = await req.json();
    const id = String(txId || '').trim().toUpperCase();
    if (!userId || !id) return json({ success: false, error: 'Missing user or transaction ID' }, 400);
    const db = getDb();
    const transferRef = db.collection('transfers').doc(id);
    let transfer;
    await db.runTransaction(async t => {
      const ts = await t.get(transferRef);
      if (!ts.exists) throw new Error('Transfer not found');
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
      transfer = { id, txId: id, ...tr };
    });
    await notifyReversal(db, transfer, 'requested');
    return json({ success: true });
  } catch (e) { return json({ success: false, error: e.message || 'Request failed' }, 400); }
};
