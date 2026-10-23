import { query } from './_lib/postgres.js';
import { requireVerifiedAdmin } from './_lib/pg-auth.js';

const datasets = {
  investments: { sql: 'SELECT id, plan, amount, daily_rate, status, total_earned, maturity_date, created_at FROM investments WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100' },
  savings: { sql: 'SELECT id, amount, status, created_at, updated_at FROM savings WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100' },
  stakes: { sql: 'SELECT id, plan, amount, status, total_earned, created_at, updated_at FROM stakes WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100' },
  tickets: { sql: 'SELECT id, subject, category, status, priority, created_at, updated_at FROM tickets WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 100' },
  transfers: { sql: 'SELECT id, sender_id, receiver_id, amount, note, status, created_at FROM transfers WHERE sender_id=$1 OR receiver_id=$1 ORDER BY created_at DESC LIMIT 100' },
  withdrawals: { sql: 'SELECT id, amount, method, status, created_at, updated_at FROM withdrawals WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100' },
  deposits: { sql: 'SELECT id, amount, method, status, created_at, updated_at FROM deposits WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100' },
  loans: { sql: 'SELECT id, amount, status, created_at, updated_at FROM loans WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100' },
  drawTickets: { sql: 'SELECT id, draw_id, quantity, created_at FROM draw_tickets WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100' },
  notifications: { sql: 'SELECT id, title, content, read, created_at FROM targeted_announcements WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100' },
  security: { sql: 'SELECT id, event_type, ip_address, device, created_at FROM security_events WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100' },
  loginHistory: { sql: 'SELECT id, ip_address, device, location, created_at FROM login_history WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100' }
};

async function audit(adminId, action, targetUser, meta = {}) {
  await query(
    'INSERT INTO admin_activity (admin_id, action, target_user, meta) VALUES ($1,$2,$3,$4::jsonb)',
    [adminId, action, targetUser || null, JSON.stringify(meta)]
  );
}

export default async function adminSupportData(req, res) {
  try {
    const admin = await requireVerifiedAdmin(req, res);
    if (!admin) return;
    const { action, targetUid, sessionId, dataset, search = '' } = req.method === 'GET' ? req.query : (req.body || {});

    if (action === 'list-customers') {
      const { rows } = await query(
        `SELECT u.id, u.name, u.email, u.phone, u.status, u.kyc_status,
          COALESCE(w.balance,0) AS balance, COALESCE(w.game_balance,0) AS game_balance
         FROM users u LEFT JOIN wallets w ON w.user_id=u.id
         WHERE u.role <> 'admin'
           AND ($1 = '' OR u.name ILIKE $2 OR u.email ILIKE $2 OR u.id ILIKE $2 OR u.phone ILIKE $2)
         ORDER BY u.created_at DESC LIMIT 300`,
        [String(search || '').trim(), `%${String(search || '').trim()}%`]
      );
      await audit(admin.id, 'support_customer_directory_viewed', null, { search: String(search || '').slice(0, 80), count: rows.length });
      return res.json(rows);
    }

    if (!targetUid || !sessionId) return res.status(400).json({ error: 'targetUid and sessionId are required' });
    const { rows: sessions } = await query(
      `SELECT id FROM admin_support_sessions
       WHERE id=$1 AND admin_id=$2 AND target_user_id=$3 AND status='active' AND expires_at>NOW()`,
      [sessionId, admin.id, targetUid]
    );
    if (!sessions[0]) return res.status(403).json({ error: 'A valid active support session for this customer is required' });

    if (action === 'session-activity') {
      const { rows } = await query(
        `SELECT id, action, target_user, meta, created_at
         FROM admin_activity
         WHERE admin_id=$1 AND target_user=$2
           AND (meta->>'sessionId'=$3 OR action IN ('support_session_started','support_session_ended'))
         ORDER BY created_at DESC LIMIT 50`,
        [admin.id, targetUid, sessionId]
      );
      await audit(admin.id, 'support_session_activity_viewed', targetUid, { sessionId, count: rows.length });
      return res.json(rows);
    }

    if (action === 'customer-summary') {
      const { rows } = await query(
        `SELECT u.id,u.name,u.email,u.phone,u.role,u.status,u.kyc_status,u.country,u.created_at,
          COALESCE(w.balance,0) AS balance,COALESCE(w.game_balance,0) AS game_balance,
          COALESCE(w.held_balance,0) AS held_balance,COALESCE(w.total_deposited,0) AS total_deposited,
          COALESCE(w.total_withdrawn,0) AS total_withdrawn,COALESCE(w.total_earned,0) AS total_earned
         FROM users u LEFT JOIN wallets w ON w.user_id=u.id WHERE u.id=$1 AND u.role <> 'admin'`,
        [targetUid]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Customer not found' });
      await audit(admin.id, 'support_customer_summary_viewed', targetUid, { sessionId });
      return res.json(rows[0]);
    }

    if (action === 'customer-dataset') {
      const config = datasets[String(dataset || '')];
      if (!config) return res.status(400).json({ error: 'Unsupported customer dataset' });
      const params = dataset === 'transfers' ? [targetUid, targetUid] : [targetUid];
      const sql = dataset === 'transfers'
        ? 'SELECT id,sender_id,receiver_id,amount,note,status,created_at FROM transfers WHERE sender_id=$1 OR receiver_id=$2 ORDER BY created_at DESC LIMIT 100'
        : config.sql;
      const { rows } = await query(sql, params);
      await audit(admin.id, 'support_customer_dataset_viewed', targetUid, { sessionId, dataset, count: rows.length });
      return res.json(rows);
    }

    return res.status(400).json({ error: 'Unsupported support data action' });
  } catch (error) {
    console.error('[admin-support-data] failed', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
