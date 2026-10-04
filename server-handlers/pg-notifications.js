import { query } from './_lib/postgres.js';
import { requireUser } from './_lib/pg-auth.js';
export default async function pgNotifications(req, res) { try { if (!await requireUser(req, res)) return; const { rows } = await query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20', [req.params.uid]); return res.json(rows); } catch (error) { console.error('[pg] notifications failed', error); return res.status(500).json({ error: 'Server error' }); } }
