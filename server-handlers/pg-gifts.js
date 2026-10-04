import { query } from './_lib/postgres.js';
import { findUser, requireUser } from './_lib/pg-auth.js';
const id = (prefix, uid) => `${prefix}_${Date.now()}_${uid.substring(0, 6)}`;

export async function listGifts(req, res) {
  try { if (!await requireUser(req, res)) return; const { rows } = await query('SELECT * FROM gifts WHERE receiver_id = $1 ORDER BY created_at DESC', [req.params.uid]); return res.json(rows); }
  catch (error) { console.error('[pg] gifts failed', error); return res.status(500).json({ error: 'Server error' }); }
}
export async function sendGift(req, res) {
  const { senderUid, receiverUid, giftType, amount, message = '' } = req.body || {};
  try {
    if (!await requireUser(req, res, senderUid)) return;
    if (!receiverUid || !giftType || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return res.status(400).json({ error: 'receiverUid, giftType, and a positive amount are required' });
    if (!await findUser(receiverUid)) return res.status(404).json({ error: 'Receiver not found' });
    const giftId = id('gift', senderUid);
    const { rows: [gift] } = await query('INSERT INTO gifts (id, sender_id, receiver_id, gift_type, amount, message, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', [giftId, senderUid, receiverUid, giftType, amount, message, 'pending']);
    return res.status(201).json({ success: true, gift });
  } catch (error) { console.error('[pg] send gift failed', error); return res.status(500).json({ error: 'Server error' }); }
}
