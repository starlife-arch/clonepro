import { getDb } from './_lib/firebase.js';
import { requireVerifiedAdmin } from './_lib/firebase-auth.js';

const datasets = {
  investments: ['investments', 'uid', 'userId'],
  savings: ['savings', 'uid', 'userId'],
  stakes: ['stakes', 'uid', 'userId'],
  tickets: ['tickets', 'uid', 'userId'],
  transfers: ['transfers', 'senderUid', 'receiverUid'],
  withdrawals: ['withdrawals', 'uid', 'userId'],
  deposits: ['deposits', 'uid', 'userId'],
  loans: ['loans', 'uid', 'userId'],
  drawTickets: ['drawTickets', 'uid', 'userId'],
  notifications: ['notifications', 'uid', 'userId'],
  security: ['security', 'uid', 'userId'],
  loginHistory: ['loginHistory', 'uid', 'userId']
};
const asDate = (value) => value?.toDate ? value.toDate().toISOString() : value ?? null;
function plain(doc) {
  const data = doc.data();
  return { id: doc.id, ...data, created_at: asDate(data.createdAt ?? data.created_at), updated_at: asDate(data.updatedAt ?? data.updated_at) };
}
async function audit(db, adminId, action, targetUser, meta = {}) {
  await db.collection('adminActivity').add({ adminId, action, targetUid: targetUser || null, meta, createdAt: new Date() });
}
async function activeSession(db, sessionId, adminId, targetUid) {
  if (!sessionId || !targetUid) return null;
  const snap = await db.collection('adminSupportSessions').doc(String(sessionId)).get();
  if (!snap.exists) return null;
  const session = snap.data();
  const expires = session.expiresAt?.toDate ? session.expiresAt.toDate() : new Date(session.expires_at || 0);
  if ((session.adminUid || session.admin_id) !== adminId ||
      (session.targetUid || session.target_user_id) !== targetUid ||
      (session.status || 'active') !== 'active' || !(expires > new Date())) return null;
  return { id: snap.id, ...session };
}
async function userRows(db) {
  const snap = await db.collection('users').get();
  return snap.docs.map(plain);
}
export default async function adminSupportData(req, res) {
  try {
    const admin = await requireVerifiedAdmin(req, res);
    if (!admin) return;
    const db = getDb();
    const { action, targetUid, sessionId, dataset, search = '' } = req.method === 'GET' ? req.query : (req.body || {});

    if (action === 'list-customers') {
      const q = String(search || '').trim().toLowerCase();
      const users = (await userRows(db)).filter(u => !u.isAdmin && !['admin','superadmin'].includes(String(u.adminRole || u.role || '').toLowerCase()))
        .filter(u => !q || [u.name, u.email, u.id, u.phone].some(v => String(v || '').toLowerCase().includes(q)))
        .sort((a,b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).slice(0,300);
      await audit(db, admin.id, 'support_customer_directory_viewed', null, { search: q.slice(0,80), count: users.length });
      return res.json(users.map(u => ({ id:u.id, name:u.name || u.displayName || '', email:u.email || '', phone:u.phone || u.phoneNumber || '', status:u.status || '', kyc_status:u.kycStatus || u.kyc_status || '' })));
    }

    if (!targetUid || !sessionId) return res.status(400).json({ error: 'targetUid and sessionId are required' });
    if (!await activeSession(db, sessionId, admin.id, targetUid)) return res.status(403).json({ error: 'A valid active support session for this customer is required' });

    if (action === 'session-activity') {
      const snap = await db.collection('adminActivity').where('adminId','==',admin.id).where('targetUid','==',targetUid).limit(100).get();
      const rows = snap.docs.map(plain).filter(r => r.meta?.sessionId === sessionId || ['support_session_started','support_session_ended'].includes(r.action)).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,50);
      await audit(db, admin.id, 'support_session_activity_viewed', targetUid, { sessionId, count: rows.length });
      return res.json(rows);
    }

    if (action === 'customer-summary') {
      const snap = await db.collection('users').doc(String(targetUid)).get();
      if (!snap.exists) return res.status(404).json({ error: 'Customer not found' });
      const u = snap.data();
      if (u.isAdmin === true || ['admin','superadmin'].includes(String(u.adminRole || u.role || '').toLowerCase())) return res.status(400).json({ error:'Select a customer account' });
      const summary = { id:snap.id, name:u.name || u.displayName || '', email:u.email || '', phone:u.phone || u.phoneNumber || '', role:u.role || 'user', status:u.status || '', kyc_status:u.kycStatus || u.kyc_status || '', country:u.country || '', balance:Number(u.balance ?? u.walletBalance ?? 0), game_balance:Number(u.gameBalance ?? 0), held_balance:Number(u.heldBalance ?? 0), total_deposited:Number(u.totalDeposited ?? 0), total_withdrawn:Number(u.totalWithdrawn ?? 0), total_earned:Number(u.totalEarned ?? 0) };
      await audit(db, admin.id, 'support_customer_summary_viewed', targetUid, { sessionId });
      return res.json(summary);
    }

    if (action === 'customer-dataset') {
      const config = datasets[String(dataset || '')];
      if (!config) return res.status(400).json({ error: 'Unsupported customer dataset' });
      const [collection, ...ownerFields] = config;
      const snap = await db.collection(collection).limit(1000).get();
      const rows = snap.docs.map(plain).filter(row => {
        if (dataset === 'transfers') return [row.senderUid,row.senderId,row.from].includes(targetUid) || [row.receiverUid,row.receiverId,row.to].includes(targetUid);
        return ownerFields.some(field => row[field] === targetUid);
      }).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,100);
      await audit(db, admin.id, 'support_customer_dataset_viewed', targetUid, { sessionId, dataset, count: rows.length });
      return res.json(rows);
    }
    return res.status(400).json({ error: 'Unsupported support data action' });
  } catch (error) {
    console.error('[admin-support-data] failed', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
