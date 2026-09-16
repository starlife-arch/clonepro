import { query } from './_lib/postgres.js';
import { requireUser } from './_lib/pg-auth.js';

export default async function pgUser(req, res) {
  try {
    if (!await requireUser(req, res)) return;
    const { rows } = await query(`
      SELECT u.id, u.name, u.email, u.role, u.status, u.kyc_status,
        COALESCE(w.balance, 0) AS balance, COALESCE(w.game_balance, 0) AS game_balance,
        COALESCE(w.held_balance, 0) AS held_balance, COALESCE(w.total_deposited, 0) AS total_deposited,
        COALESCE(w.total_withdrawn, 0) AS total_withdrawn, COALESCE(w.total_earned, 0) AS total_earned
      FROM users u LEFT JOIN wallets w ON w.user_id = u.id WHERE u.id = $1
    `, [req.params.uid]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    return res.json(rows[0]);
  } catch (error) {
    console.error('[pg] user lookup failed', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
