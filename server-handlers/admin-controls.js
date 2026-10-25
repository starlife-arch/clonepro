import { randomUUID } from 'node:crypto';
import { getDb } from './_lib/firebase.js';
import { requireVerifiedAdmin } from './_lib/firebase-auth.js';

const dateValue = (v) => v?.toDate ? v.toDate() : (v ? new Date(v) : null);
async function audit(db, adminId, action, targetUid, meta = {}) {
  await db.collection('adminActivity').add({ adminId, action, targetUid: targetUid || null, meta, createdAt: new Date() });
}
async function setting(db, key, fallback) {
  const snap = await db.collection('adminSettings').doc(key).get();
  return snap.exists ? snap.data().value : fallback;
}
async function saveSetting(db, key, value, adminId) {
  await db.collection('adminSettings').doc(key).set({ key, value, updatedAt: new Date(), updatedBy: adminId }, { merge: true });
}
async function getActiveSession(db, adminId, targetUid, sessionId) {
  if (!targetUid || !sessionId) return null;
  const ref = db.collection('adminSupportSessions').doc(String(sessionId));
  const snap = await ref.get();
  if (!snap.exists) return null;
  const s = snap.data();
  const expires = dateValue(s.expiresAt || s.expires_at);
  if ((s.adminUid || s.admin_id) !== adminId || (s.targetUid || s.target_user_id) !== targetUid ||
      (s.status || 'active') !== 'active' || !expires || expires <= new Date()) return null;
  return { ref, data:s, id:snap.id };
}
function isAdminUser(u) { return u?.isAdmin === true || ['admin','superadmin'].includes(String(u?.adminRole || u?.role || '').toLowerCase()); }

export default async function adminControls(req, res) {
  try {
    const admin = await requireVerifiedAdmin(req, res);
    if (!admin) return;
    const db = getDb();
    const { action } = req.body || {};
    if (req.method === 'GET' || action === 'status') {
      const disabled = await setting(db, 'auto_invest_global_disabled', false);
      const users = await db.collection('users').get();
      const prefs = await db.collection('userAutoInvestPreferences').get();
      const total = users.docs.filter(d => !isAdminUser(d.data())).length;
      const enabled = prefs.docs.filter(d => d.data().enabled === true).length;
      return res.json({ globalDisabled: disabled === true || disabled === 'true', minimumReinvestAmount: Number(await setting(db, 'auto_reinvest_minimum_amount', 1)), total_users: total, individually_enabled: enabled });
    }
    if (action === 'set-global-auto-invest') {
      if (typeof req.body.disabled !== 'boolean') return res.status(400).json({ error:'disabled must be a boolean' });
      await saveSetting(db, 'auto_invest_global_disabled', req.body.disabled, admin.id);
      await audit(db, admin.id, req.body.disabled ? 'auto_invest_global_disabled' : 'auto_invest_global_restored', null, { disabled:req.body.disabled, preferencesPreserved:true });
      return res.json({ success:true, globalDisabled:req.body.disabled, preferencesPreserved:true });
    }
    if (action === 'set-minimum-reinvest-amount') {
      const amount = Number(req.body?.amount);
      if (!Number.isFinite(amount) || amount < 0 || amount > 1000000) return res.status(400).json({ error:'amount must be between 0 and 1,000,000' });
      await saveSetting(db, 'auto_reinvest_minimum_amount', amount, admin.id);
      await audit(db, admin.id, 'auto_reinvest_minimum_amount_updated', null, { amount });
      return res.json({ success:true, minimumReinvestAmount:amount });
    }
    if (['set-user-auto-invest','clear-user-auto-invest','get-user-auto-invest'].includes(action)) {
      const { targetUid, sessionId } = req.body || {};
      if (!targetUid) return res.status(400).json({ error:'targetUid is required' });
      if (!await getActiveSession(db, admin.id, targetUid, sessionId)) return res.status(403).json({ error:'A valid active support session for this customer is required' });
      const userSnap = await db.collection('users').doc(String(targetUid)).get();
      if (!userSnap.exists || isAdminUser(userSnap.data())) return res.status(404).json({ error:'Customer account not found' });
      const ref = db.collection('userAutoInvestPreferences').doc(String(targetUid));
      if (action === 'get-user-auto-invest') {
        const pref = await ref.get();
        return res.json({ targetUid, admin_override_enabled:pref.exists && typeof pref.data().enabled === 'boolean' ? pref.data().enabled : null, globalDisabled:!!(await setting(db,'auto_invest_global_disabled',false)), minimumReinvestAmount:Number(await setting(db,'auto_reinvest_minimum_amount',1)) });
      }
      if (action === 'set-user-auto-invest') {
        if (typeof req.body.enabled !== 'boolean') return res.status(400).json({ error:'enabled must be a boolean' });
        await ref.set({ userUid:targetUid, enabled:req.body.enabled, updatedAt:new Date(), updatedBy:admin.id }, { merge:true });
        await audit(db,admin.id,req.body.enabled?'auto_invest_user_enabled':'auto_invest_user_disabled',targetUid,{enabled:req.body.enabled,sessionId});
        return res.json({success:true,targetUid,enabled:req.body.enabled,globallyPaused:!!(await setting(db,'auto_invest_global_disabled',false))});
      }
      await ref.delete();
      await audit(db,admin.id,'auto_invest_user_override_cleared',targetUid,{sessionId,fallsBackToCustomerPreference:true});
      return res.json({success:true,targetUid,override:null,fallsBackToCustomerPreference:true});
    }
    if (action === 'start-support-session') {
      const { targetUid, reason } = req.body || {};
      if (!targetUid || typeof reason !== 'string' || reason.trim().length < 8) return res.status(400).json({ error:'targetUid and support reason of at least 8 characters are required' });
      const target = await db.collection('users').doc(String(targetUid)).get();
      if (!target.exists || isAdminUser(target.data())) return res.status(404).json({ error:'Customer account not found' });
      const id = randomUUID(), now = new Date(), expires = new Date(now.getTime()+30*60*1000);
      const session = { id, adminUid:admin.id, targetUid:String(targetUid), reason:reason.trim(), status:'active', startedAt:now, expiresAt:expires };
      await db.collection('adminSupportSessions').doc(id).set(session);
      await audit(db,admin.id,'support_session_started',targetUid,{sessionId:id,reason:reason.trim(),expiresInMinutes:30});
      return res.status(201).json({session:{id,admin_id:admin.id,target_user_id:String(targetUid),reason:reason.trim(),status:'active',started_at:now.toISOString(),expires_at:expires.toISOString()},banner:'SUPPORT SESSION — ADMIN ACTIONS ARE AUDITED'});
    }
    if (action === 'end-support-session') {
      const { sessionId } = req.body || {};
      const snap = sessionId ? await db.collection('adminSupportSessions').doc(String(sessionId)).get() : null;
      if (!snap?.exists) return res.status(404).json({error:'Active support session not found'});
      const s=snap.data();
      if ((s.adminUid || s.admin_id)!==admin.id || (s.status || 'active')!=='active') return res.status(404).json({error:'Active support session not found'});
      await snap.ref.update({status:'ended',endedAt:new Date(),endedBy:admin.id});
      await audit(db,admin.id,'support_session_ended',s.targetUid || s.target_user_id,{sessionId});
      return res.json({success:true});
    }
    if (action === 'approve-withdrawal') {
      const { withdrawalId, confirmed, reason } = req.body || {};
      if (!withdrawalId || confirmed !== true || typeof reason !== 'string' || reason.trim().length < 8) return res.status(400).json({error:'withdrawalId, confirmed=true, and a reason of at least 8 characters are required'});
      const ref = db.collection('withdrawals').doc(String(withdrawalId));
      const snap = await ref.get();
      if (!snap.exists || String(snap.data().status || '').toLowerCase() !== 'pending') return res.status(409).json({error:'Withdrawal not found or no longer pending'});
      await ref.update({status:'approved',approvedBy:admin.id,updatedAt:new Date()});
      await audit(db,admin.id,'withdrawal_approved',snap.data().uid || snap.data().userId,{withdrawalId,amount:snap.data().amount,reason:reason.trim(),confirmed:true});
      return res.json({success:true,withdrawal:{id:snap.id,...snap.data(),status:'approved',approvedBy:admin.id},note:'Approval recorded; payout execution remains in the configured payment workflow.'});
    }
    return res.status(400).json({error:'Unsupported admin control action'});
  } catch (error) {
    console.error('[admin-controls] failed', error);
    return res.status(500).json({error:'Server error'});
  }
}
