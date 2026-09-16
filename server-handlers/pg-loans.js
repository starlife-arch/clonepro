import { query } from './_lib/postgres.js';
import { requireUser } from './_lib/pg-auth.js';
export default async function pgLoans(req, res) { try { if (!await requireUser(req, res)) return; const { rows } = await query('SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC', [req.params.uid]); return res.json(rows); } catch (error) { console.error('[pg] loans failed', error); return res.status(500).json({ error: 'Server error' }); } }
