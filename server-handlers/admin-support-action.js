import { query } from './_lib/postgres.js';
import { requireAdmin } from './_lib/pg-auth.js';

// Only these user-capable handlers can be called from an audited support session.
// No arbitrary import paths or admin-only/global handlers are accepted.
const operations = {
  'profile.read': { module: './pg-user.js', exportName: 'default', method: 'GET', write: false },
  'profile.update': { module: './pg-user-update.js', exportName: 'default', method: 'POST', write: true },
  'investments.list': { module: './pg-investments.js', exportName: 'default', method: 'GET', write: false },
  'savings.list': { module: './pg-savings.js', exportName: 'listSavings', method: 'GET', write: false },
  'savings.create': { module: './pg-savings.js', exportName: 'createSavings', method: 'POST', write: true },
  'stakes.list': { module: './pg-stakes.js', exportName: 'listStakes', method: 'GET', write: false },
  'stakes.create': { module: './pg-stakes.js', exportName: 'createStake', method: 'POST', write: true },
  'tickets.list': { module: './pg-tickets.js', exportName: 'tickets', method: 'GET', write: false },
  'tickets.create': { module: './pg-tickets.js', exportName: 'createTicket', method: 'POST', write: true },
  'tickets.message': { module: './pg-tickets.js', exportName: 'ticketMessage', method: 'POST', write: true },
  'transfers.list': { module: './pg-transfers.js', exportName: 'transfers', method: 'GET', write: false },
  'transfers.send': { module: './pg-transfers.js', exportName: 'sendTransfer', method: 'POST', write: true, financial: true },
  'withdrawals.list': { module: './pg-withdrawals.js', exportName: 'default', method: 'GET', write: false },
  'deposits.list': { module: './pg-deposits.js', exportName: 'default', method: 'GET', write: false },
  'loans.list': { module: './pg-loans.js', exportName: 'default', method: 'GET', write: false },
  'messages.list': { module: './pg-messages.js', exportName: 'listMessages', method: 'GET', write: false },
  'messages.send': { module: './pg-messages.js', exportName: 'sendMessage', method: 'POST', write: true },
  'notifications.list': { module: './pg-notifications.js', exportName: 'default', method: 'GET', write: false },
  'activity.list': { module: './pg-activity.js', exportName: 'default', method: 'GET', write: false },
  'security.list': { module: './pg-security.js', exportName: 'security', method: 'GET', write: false }
};

async function audit(adminId, action, targetUid, meta) {
  await query(
    'INSERT INTO admin_activity(admin_id,action,target_user,meta) VALUES($1,$2,$3,$4::jsonb)',
    [adminId, action, targetUid, JSON.stringify(meta || {})]
  );
}

export default async function adminSupportAction(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const { action, targetUid, sessionId, payload = {}, confirmed, reason } = req.body || {};
  const op = operations[String(action || '')];
  if (!op) return res.status(400).json({ error: 'Unsupported customer action' });
  if (!targetUid || !sessionId) return res.status(400).json({ error: 'targetUid and sessionId are required' });

  const { rows: sessions } = await query(
    "SELECT id FROM admin_support_sessions WHERE id=$1 AND admin_id=$2 AND target_user_id=$3 AND status='active' AND expires_at>NOW()",
    [sessionId, admin.id, targetUid]
  );
  if (!sessions[0]) return res.status(403).json({ error: 'A valid active support session for this customer is required' });

  if (op.write && (confirmed !== true || typeof reason !== 'string' || reason.trim().length < 8)) {
    return res.status(400).json({ error: 'Write actions require confirmed=true and a reason of at least 8 characters' });
  }

  // Force customer ownership fields server-side; never trust a target UID in the payload.
  const body = { ...(payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}) };
  if (action === 'profile.update' || action === 'savings.create' || action === 'stakes.create' || action === 'tickets.create' || action === 'tickets.message') body.uid = targetUid;
  if (action === 'transfers.send') body.senderUid = targetUid;
  if (action === 'messages.send') body.senderUid = targetUid;

  if (action === 'savings.create' || action === 'stakes.create' || action === 'transfers.send') {
    if (!Number.isFinite(Number(body.amount)) || Number(body.amount) <= 0) return res.status(400).json({ error: 'Amount must be a positive number' });
  }
  if (action === 'transfers.send' && (!body.receiverUid || body.receiverUid === targetUid)) return res.status(400).json({ error: 'Choose a valid recipient other than the selected customer' });
  if (action === 'messages.send' && (!body.receiverUid || !String(body.content || '').trim())) return res.status(400).json({ error: 'A recipient and message content are required' });
  if (action === 'tickets.message' && (!body.ticketId || !String(body.message || '').trim())) return res.status(400).json({ error: 'ticketId and message are required' });
  if (action === 'tickets.create' && (!String(body.subject || '').trim() || !String(body.category || '').trim())) return res.status(400).json({ error: 'Ticket subject and category are required' });

  const route = '/api/support-session/' + String(action).slice(0, 80);
  await audit(admin.id, 'support_action_started', targetUid, {
    sessionId, action, method: op.method, route, write: op.write,
    financial: !!op.financial, reason: op.write ? reason.trim().slice(0, 500) : undefined
  });

  let statusCode = 200;
  let responseBody;
  let completed = false;
  const mockRes = {
    headersSent: false,
    status(code) { statusCode = code; return this; },
    json(data) { responseBody = data; completed = true; this.headersSent = true; return this; },
    send(data) { responseBody = data; completed = true; this.headersSent = true; return this; },
    end(data) { responseBody = data; completed = true; this.headersSent = true; return this; },
    setHeader() { return this; }
  };
  const mockReq = {
    method: op.method, body, params: { uid: targetUid }, query: {},
    originalUrl: route, url: route,
    get(name) {
      const values = {
        'x-user-uid': targetUid,
        'x-admin-uid': admin.id,
        'x-support-session-id': sessionId
      };
      return values[String(name || '').toLowerCase()];
    }
  };

  try {
    const mod = await import(op.module);
    const handler = op.exportName === 'default' ? mod.default : mod[op.exportName];
    if (typeof handler !== 'function') throw new Error('Configured customer action handler is unavailable');
    await handler(mockReq, mockRes);
    if (!completed) {
      statusCode = 502;
      responseBody = { error: 'Customer handler did not return a result; no success was assumed' };
    }
    await audit(admin.id, statusCode < 400 ? 'support_action_completed' : 'support_action_failed', targetUid, { sessionId, action, statusCode, success: statusCode < 400 });
    return res.status(statusCode).json(responseBody);
  } catch (error) {
    console.error('[admin-support-action] failed', { action, message: error.message });
    await audit(admin.id, 'support_action_failed', targetUid, { sessionId, action, statusCode: 500, error: String(error.message || error).slice(0, 180) });
    return res.status(500).json({ error: 'Support action failed; the audit event was recorded' });
  }
}
