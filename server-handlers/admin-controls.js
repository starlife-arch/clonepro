import { randomUUID } from 'node:crypto';
import { query, pool } from './_lib/postgres.js';
import { requireAdmin } from './_lib/pg-auth.js';

async function audit(adminId, action, targetUser, meta = {}) {
  await query(
    'INSERT INTO admin_activity (admin_id, action, target_user, meta) VALUES ($1,$2,$3,$4::jsonb)',
    [adminId, action, targetUser || null, JSON.stringify(meta)]
  );
}
async function globalDisabled() {
  const { rows } = await query("SELECT value FROM admin_settings WHERE key='auto_invest_global_disabled'");
  return rows[0]?.value === true || rows[0]?.value === 'true';
}

export default async function adminControls(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const { action } = req.body || {};
    if (req.method === 'GET' || action === 'status') {
      const disabled = await globalDisabled();
      const { rows } = await query("SELECT COUNT(*)::int AS total_users, COUNT(*) FILTER (WHERE p.enabled)::int AS individually_enabled FROM users u LEFT JOIN user_auto_invest_preferences p ON p.user_id=u.id WHERE u.role <> 'admin'");
      return res.json({ globalDisabled: disabled, ...rows[0] });
    }
    if (action === 'set-global-auto-invest') {
      if (typeof req.body.disabled !== 'boolean') return res.status(400).json({ error: 'disabled must be a boolean' });
      await query("INSERT INTO admin_settings(key,value,updated_at) VALUES('auto_invest_global_disabled',$1::jsonb,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()", [JSON.stringify(req.body.disabled)]);
      await audit(admin.id, req.body.disabled ? 'auto_invest_global_disabled' : 'auto_invest_global_restored', null, { disabled: req.body.disabled, preferencesPreserved: true });
      return res.json({ success: true, globalDisabled: req.body.disabled, preferencesPreserved: true });
    }
    if (action === 'set-user-auto-invest') {
      const { targetUid, enabled } = req.body || {};
      if (!targetUid || typeof enabled !== 'boolean') return res.status(400).json({ error: 'targetUid and boolean enabled are required' });
      const target = await query('SELECT id,role FROM users WHERE id=$1', [targetUid]);
      if (!target.rows[0]) return res.status(404).json({ error: 'User not found' });
      if (target.rows[0].role === 'admin') return res.status(400).json({ error: 'Select a customer account' });
      await query('INSERT INTO user_auto_invest_preferences(user_id,enabled,updated_at,updated_by) VALUES($1,$2,NOW(),$3) ON CONFLICT(user_id) DO UPDATE SET enabled=EXCLUDED.enabled,updated_at=NOW(),updated_by=EXCLUDED.updated_by', [targetUid, enabled, admin.id]);
      await audit(admin.id, enabled ? 'auto_invest_user_enabled' : 'auto_invest_user_disabled', targetUid, { enabled });
      return res.json({ success: true, targetUid, enabled, globallyPaused: await globalDisabled() });
    }
    if (action === 'get-user-auto-invest') {
      const { targetUid } = req.body || {};
      if (!targetUid) return res.status(400).json({ error: 'targetUid is required' });
      const { rows } = await query("SELECT u.id, COALESCE(p.enabled,TRUE) AS enabled FROM users u LEFT JOIN user_auto_invest_preferences p ON p.user_id=u.id WHERE u.id=$1 AND u.role <> 'admin'", [targetUid]);
      if (!rows[0]) return res.status(404).json({ error: 'User not found' });
      const disabled = await globalDisabled();
      return res.json({ ...rows[0], globalDisabled: disabled, effectiveEnabled: rows[0].enabled && !disabled });
    }
    if (action === 'approve-withdrawal') {
      const { withdrawalId, confirmed, reason } = req.body || {};
      if (!withdrawalId || confirmed !== true || typeof reason !== 'string' || reason.trim().length < 8) {
        return res.status(400).json({ error: 'withdrawalId, confirmed=true, and a reason of at least 8 characters are required' });
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query("UPDATE withdrawals SET status='approved',approved_by=$2,updated_at=NOW() WHERE id=$1 AND status='pending' RETURNING id,user_id,amount,method", [withdrawalId, admin.id]);
        if (!result.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Withdrawal not found or no longer pending' });
        }
        await client.query("INSERT INTO admin_activity(admin_id,action,target_user,meta) VALUES($1,'withdrawal_approved',$2,$3::jsonb)", [admin.id,result.rows[0].user_id,JSON.stringify({withdrawalId,amount:String(result.rows[0].amount),reason:reason.trim(),confirmed:true})]);
        await client.query('COMMIT');
        return res.json({ success:true, withdrawal:result.rows[0], note:'Approval recorded; payout execution remains in the configured payment workflow.' });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    }
    if (action === 'start-support-session') {
      const { targetUid, reason } = req.body || {};
      if (!targetUid || typeof reason !== 'string' || reason.trim().length < 8) return res.status(400).json({ error: 'targetUid and support reason of at least 8 characters are required' });
      const target = await query("SELECT id FROM users WHERE id=$1 AND role <> 'admin'", [targetUid]);
      if (!target.rows[0]) return res.status(404).json({ error: 'Customer account not found' });
      const id = randomUUID();
      const { rows } = await query("INSERT INTO admin_support_sessions(id,admin_id,target_user_id,reason,expires_at) VALUES($1,$2,$3,$4,NOW()+INTERVAL '30 minutes') RETURNING id,admin_id,target_user_id,reason,status,started_at,expires_at", [id,admin.id,targetUid,reason.trim()]);
      await audit(admin.id, 'support_session_started', targetUid, { sessionId:id, reason:reason.trim(), expiresInMinutes:30 });
      return res.status(201).json({ session:rows[0], banner:'SUPPORT SESSION — ADMIN ACTIONS ARE AUDITED', permittedActions:['view_account','manage_auto_invest','approve_withdrawal_with_explicit_confirmation'] });
    }
    if (action === 'end-support-session') {
      const { sessionId } = req.body || {};
      if (!sessionId) return res.status(400).json({ error:'sessionId is required' });
      const { rows } = await query("UPDATE admin_support_sessions SET status='ended',ended_at=NOW(),ended_by=$2 WHERE id=$1 AND admin_id=$2 AND status='active' AND expires_at>NOW() RETURNING target_user_id", [sessionId,admin.id]);
      if (!rows[0]) return res.status(404).json({ error:'Active support session not found' });
      await audit(admin.id,'support_session_ended',rows[0].target_user_id,{sessionId});
      return res.json({ success:true });
    }
    return res.status(400).json({ error:'Unsupported admin control action' });
  } catch (error) {
    console.error('[admin-controls] failed', error);
    return res.status(500).json({ error:'Server error' });
  }
}
