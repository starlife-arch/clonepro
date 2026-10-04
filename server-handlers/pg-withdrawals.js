import { query } from './_lib/postgres.js';
import { requireUser } from './_lib/pg-auth.js';
export default async function pgWithdrawals(req, res) { try { if (!await requireUser(req, res)) return; const { rows } = await query('SELECT * FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC', [req.params.uid]); return res.json(rows); } catch (error) { console.error('[pg] withdrawals failed', error); return res.status(500).json({ error: 'Server error' }); } }
