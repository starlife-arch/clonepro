import { getDb, admin, json, cents, creditPlatform, notifyReversal } from './_lib/money-features.js';
import { isAdminUser } from './_lib/predictions.js';

export default async (req, context) => {
  try {
    const { userId, txId, decision, adminOverride = false } = await req.json();
    const id = String(txId || '').trim().toUpperCase();
    const approve = decision === 'approve' || decision === 'approved';
    const reject = decision === 'reject' || decision === 'rejected';
    if (!userId || !id || (!approve && !reject)) return json({ success: false, error: 'Missing or invalid fields' }, 400);
    const db = getDb();
    if (adminOverride && !(await isAdminUser(db, userId))) return json({ success: false, error: 'Admin required' }, 403);
    const transferRef = db.collection('transfers').doc(id);
    let transfer, finalStatus;
    await db.runTransaction(async t => {
      const ts = await t.get(transferRef);
      if (!ts.exists) throw new Error('Transfer not found');
      const tr = ts.data() || {};
      if (tr.reversalStatus !== 'pending') throw new Error('Reversal is not pending');
      if (!adminOverride && tr.toUid !== userId) throw new Error('Only the recipient can respond to this reversal');
      const receiverRef = db.collection('users').doc(tr.toUid);
      const senderRef = db.collection('users').doc(tr.fromUid);
      if (approve) {
        const rs = await t.get(receiverRef);
        const r = rs.data() || {};
        if (Number(r.heldAmount || 0) < Number(tr.received || 0)) throw new Error('Held funds are no longer available');
        if (Number(r.balance || 0) < Number(tr.received || 0)) throw new Error('Recipient balance is insufficient');
        t.update(receiverRef, { balance: admin.firestore.FieldValue.increment(-cents(tr.received)), heldAmount: admin.firestore.FieldValue.increment(-cents(tr.received)) });
        t.update(senderRef, { balance: admin.firestore.FieldValue.increment(cents(tr.amount)) });
        t.set(db.collection('activity').doc(), { uid: tr.fromUid, desc: `↩️ Transfer reversal approved — ${id} refunded in full`, amt: cents(tr.amount), icon: '↩️', type: 'transfer_reversal', createdAt: admin.firestore.FieldValue.serverTimestamp() });
        t.set(db.collection('activity').doc(), { uid: tr.toUid, desc: `↩️ Transfer reversal approved — ${id} deducted`, amt: -cents(tr.received), icon: '↩️', type: 'transfer_reversal', createdAt: admin.firestore.FieldValue.serverTimestamp() });
        finalStatus = 'approved';
      } else {
        t.update(receiverRef, { heldAmount: admin.firestore.FieldValue.increment(-cents(tr.received)) });
        finalStatus = 'rejected';
      }
      t.update(transferRef, { reversalStatus: finalStatus, status: approve ? 'reversed' : 'completed', reversalResolvedAt: admin.firestore.FieldValue.serverTimestamp(), reversalResolvedBy: userId, reversalResolvedByAdmin: !!adminOverride });
      transfer = { id, txId: id, ...tr };
    });
    if (approve && Number(transfer.fee || 0) > 0) await creditPlatform(db, -Number(transfer.fee), `Transfer fee returned for reversal ${id}`, id);
    await notifyReversal(db, { ...transfer, fromName: transfer.fromName, toName: transfer.toName }, 'resolved', finalStatus);
    return json({ success: true, status: finalStatus });
  } catch (e) { return json({ success: false, error: e.message || 'Response failed' }, 400); }
};
