import { query } from './_lib/postgres.js';
import { findUser, requireUser } from './_lib/pg-auth.js';
const id = (prefix, uid) => `${prefix}_${Date.now()}_${uid.substring(0, 6)}`;

export async function listMessages(req, res) {
  try {
    if (!await requireUser(req, res)) return;
    const { rows } = await query('SELECT * FROM messages WHERE sender_id = $1 OR receiver_id = $1 ORDER BY created_at ASC', [req.params.uid]);
    return res.json(rows);
  } catch (error) { console.error('[pg] messages failed', error); return res.status(500).json({ error: 'Server error' }); }
}

export async function sendMessage(req, res) {
  const { senderUid, receiverUid, content, type = 'text' } = req.body || {};
  try {
    if (!await requireUser(req, res, senderUid)) return;
    if (!receiverUid || !content?.trim()) return res.status(400).json({ error: 'receiverUid and content are required' });
    if (!await findUser(receiverUid)) return res.status(404).json({ error: 'Receiver not found' });
    const messageId = id('message', senderUid);
    const { rows: [message] } = await query('INSERT INTO messages (id, sender_id, receiver_id, content, type, read) VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING *', [messageId, senderUid, receiverUid, content.trim(), type]);
    return res.status(201).json({ success: true, message });
  } catch (error) { console.error('[pg] send message failed', error); return res.status(500).json({ error: 'Server error' }); }
}
