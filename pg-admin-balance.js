import { query } from './_lib/postgres.js';
import { findUser, requireAdmin } from './_lib/pg-auth.js';

export default async function pgAdminBalance(req, res) {
  try {
    const { adminUid, targetUid, amount, action, reason } = req.body || {};
    if (!await requireAdmin(req, res, adminUid)) return;
    if (!targetUid || !['add', 'deduct'].includes(action) || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return res.status(400).json({ error: 'Invalid balance request' });
    if (!await findUser(targetUid)) return res.status(404).json({ error: 'User not found' });

    const numericAmount = String(amount);
    const operator = action === 'add' ? '+' : '-';
    const condition = action === 'deduct' ? 'AND balance >= $2' : '';
    const { rows } = await query(`
      WITH updated AS (
        UPDATE wallets SET balance = balance ${operator} $2::numeric, updated_at = NOW()
        WHERE user_id = $1 ${condition} RETURNING balance
      ), ledger_entry AS (
        INSERT INTO ledger (user_id, type, amount, balance_after, description, ref_id)
        SELECT $1, $3, $4::numeric, balance, $5, $6 FROM updated
        RETURNING balance_after
      )
      SELECT balance_after FROM ledger_entry
    `, [targetUid, numericAmount, `admin_${action}`, action === 'add' ? numericAmount : `-${numericAmount}`, reason || `Admin balance ${action}`, adminUid]);
    if (!rows[0]) return res.status(400).json({ error: action === 'deduct' ? 'Insufficient balance' : 'Wallet not found' });
    return res.json({ targetUid, action, amount: numericAmount, balance: rows[0].balance_after });
  } catch (error) {
    console.error('[pg] admin balance failed', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
