import { query } from './_lib/postgres.js';
import { requireAdmin } from './_lib/pg-auth.js';
export default async function pgAdminActivity(req, res) { try { if (!await requireAdmin(req, res)) return; const { rows } = await query('SELECT * FROM admin_activity ORDER BY created_at DESC LIMIT 200'); return res.json(rows); } catch (error) { console.error('[pg] admin activity failed', error); return res.status(500).json({ error: 'Server error' }); } }
