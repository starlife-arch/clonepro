import { getDb } from './_lib/firebase.js';
import { requireVerifiedAdmin } from './_lib/firebase-auth.js';

const readCollections = {
  'profile.read': ['users', 'profile'],
  'investments.list': ['investments', 'uid'],
  'savings.list': ['savings', 'uid'],
  'stakes.list': ['stakes', 'uid'],
  'tickets.list': ['tickets', 'uid'],
  'transfers.list': ['transfers', 'transfer'],
  'withdrawals.list': ['withdrawals', 'uid'],
  'deposits.list': ['deposits', 'uid'],
  'loans.list': ['loans', 'uid'],
  'messages.list': ['messages', 'message'],
  'notifications.list': ['notifications', 'uid'],
  'activity.list': ['activity', 'uid'],
  'security.list': ['security', 'uid']
};
const asDate = v => v?.toDate ? v.toDate().toISOString() : v ?? null;
const plain = d => { const x=d.data(); return {id:d.id,...x,created_at:asDate(x.createdAt ?? x.created_at),updated_at:asDate(x.updatedAt ?? x.updated_at)}; };
function omitUndefined(value) {
  if (Array.isArray(value)) return value.filter(item => item !== undefined).map(omitUndefined);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, omitUndefined(item)])
  );
}
async function audit(db, adminId, action, targetUid, meta={}) {
  await db.collection('adminActivity').add({
    adminId, action, targetUid, meta: omitUndefined(meta), createdAt: new Date()
  });
}
async function verifySession(db, adminId, targetUid, sessionId) {
  if (!sessionId) return false;
  const ref=db.collection('adminSupportSessions').doc(String(sessionId));
  const snap=await ref.get(); if(!snap.exists)return false;
  const s=snap.data(), expiry=s.expiresAt?.toDate ? s.expiresAt.toDate() : new Date(s.expiresAt || s.expires_at || 0);
  return (s.adminUid || s.admin_id)===adminId && (s.targetUid || s.target_user_id)===targetUid && (s.status || 'active')==='active' && expiry>new Date();
}
function ownerMatch(row, uid) { return [row.uid,row.userId,row.user_id,row.senderUid,row.senderId,row.from].includes(uid); }

export default async function adminSupportAction(req,res) {
  try {
    const admin=await requireVerifiedAdmin(req,res); if(!admin)return;
    const db=getDb();
    const {action,targetUid,sessionId,payload={},confirmed,reason}=req.body||{};
    if(!targetUid || !sessionId)return res.status(400).json({error:'targetUid and sessionId are required'});
    if(!await verifySession(db,admin.id,targetUid,sessionId))return res.status(403).json({error:'A valid active support session for this customer is required'});
    const writes=new Set(['profile.update','tickets.create','tickets.message','messages.send','withdrawals.approve','withdrawals.create-request']);
    const write=writes.has(action);
    if(write && (confirmed!==true || typeof reason!=='string' || reason.trim().length<8)) {
      await audit(db,admin.id,'support_action_rejected',targetUid,{sessionId,action});
      return res.status(400).json({error:'Write actions require confirmed=true and a reason of at least 8 characters'});
    }
    let result;
    if(action==='withdrawals.create-request') {
      const amount=Number(payload.amount);
      const phone=String(payload.phone||'').trim();
      const method=String(payload.method||'').trim();
      const currency=String(payload.currency||'KES').trim().toUpperCase();
      if(!Number.isFinite(amount)||amount<=0||amount>100000000) return res.status(400).json({error:'Enter a valid withdrawal amount greater than zero.'});
      if(!/^\\+?254[17]\\d{8}$/.test(phone.replace(/[\\s()-]/g,'')) && !/^0[17]\\d{8}$/.test(phone.replace(/[\\s()-]/g,''))) return res.status(400).json({error:'Enter a valid Kenyan M-Pesa number (07…, 01…, +2547…, or +2541…).'});
      if(!['mpesa','bank','other'].includes(method)) return res.status(400).json({error:'Choose a supported withdrawal method.'});
      if(String(payload.authorizationNote||'').trim().length<8) return res.status(400).json({error:'Record how the customer authorized this withdrawal (at least 8 characters).'});
      if(!['KES','USD'].includes(currency)) return res.status(400).json({error:'Currency must be KES or USD.'});
      const userSnap=await db.collection('users').doc(String(targetUid)).get();
      if(!userSnap.exists) return res.status(404).json({error:'Customer account not found.'});
      const now=new Date();
      const withdrawalRef=db.collection('withdrawals').doc();
      const record={
        uid:String(targetUid), userId:String(targetUid), amount, currency,
        phone:phone.replace(/[\\s()-]/g,''), method,
        status:'pending', approvalStatus:'pending',
        requestSource:'admin_support', initiatedByAdmin:admin.id,
        supportSessionId:String(sessionId), customerAuthorized:true,
        customerAuthorizationNote:String(payload.authorizationNote||'').trim().slice(0,500),
        reason:reason.trim().slice(0,500),
        requiresFinanceApproval:true,
        createdAt:now, updatedAt:now
      };
      await db.runTransaction(async tx=>{
        const fresh=await tx.get(db.collection('users').doc(String(targetUid)));
        if(!fresh.exists) throw new Error('Customer account not found.');
        tx.create(withdrawalRef,record);
      });
      result={success:true,withdrawal:{id:withdrawalRef.id,...record},note:'Withdrawal request created for finance-team review. No funds were sent and no customer balance was changed.'};
    } else if(action==='withdrawals.approve') {
      const withdrawalId=String(payload.withdrawalId||'').trim();
      if(!withdrawalId)return res.status(400).json({error:'Withdrawal ID is required'});
      const ref=db.collection('withdrawals').doc(withdrawalId);
      const outcome=await db.runTransaction(async tx=>{
        const snap=await tx.get(ref);
        if(!snap.exists)return {error:'Withdrawal not found',status:404};
        const w=snap.data();
        const owner=String(w.uid||w.userId||w.user_id||'');
        if(owner!==String(targetUid))return {error:'Withdrawal does not belong to the selected customer',status:403};
        if(String(w.status||'').toLowerCase()!=='pending')return {error:'Withdrawal is no longer pending; no change was made',status:409};
        tx.update(ref,{status:'approved',approvedBy:admin.id,approvedAt:new Date(),updatedAt:new Date(),supportSessionId:String(sessionId),approvalReason:reason.trim().slice(0,500)});
        return {success:true,withdrawal:{id:snap.id,amount:w.amount,status:'approved',approvedBy:admin.id}};
      });
      if(outcome.error)return res.status(outcome.status).json({error:outcome.error});
      result={...outcome,note:'Approval recorded only. This does not send money; payout execution remains in the configured payment workflow.'};
    } else if(action==='profile.update') {
      const fields=payload.fields||{};
      const allowed={name:'name',phone:'phone',country:'country'};
      const safe=Object.fromEntries(Object.entries(fields).filter(([k,v])=>allowed[k] && typeof v==='string').map(([k,v])=>[allowed[k],v.trim().slice(0,200)]));
      if(!Object.keys(safe).length)return res.status(400).json({error:'No supported profile fields supplied'});
      await db.collection('users').doc(String(targetUid)).update({...safe,updatedAt:new Date()});
      result={success:true,updatedFields:Object.keys(safe)};
    } else if(action==='tickets.create') {
      if(!String(payload.subject||'').trim() || !String(payload.category||'').trim())return res.status(400).json({error:'Ticket subject and category are required'});
      const ref=await db.collection('tickets').add({uid:targetUid,userId:targetUid,subject:String(payload.subject).trim().slice(0,200),category:String(payload.category).trim().slice(0,80),priority:payload.priority||'normal',status:'open',createdAt:new Date(),updatedAt:new Date()});
      result={success:true,ticketId:ref.id};
    } else if(action==='tickets.message') {
      if(!payload.ticketId || !String(payload.message||'').trim())return res.status(400).json({error:'ticketId and message are required'});
      const ref=db.collection('tickets').doc(String(payload.ticketId)), snap=await ref.get();
      if(!snap.exists || (snap.data().uid||snap.data().userId)!==targetUid)return res.status(404).json({error:'Ticket not found for selected customer'});
      await ref.collection('messages').add({uid:targetUid,senderUid:admin.id,senderRole:'admin',message:String(payload.message).trim().slice(0,5000),createdAt:new Date()});
      await ref.update({updatedAt:new Date()});
      result={success:true};
    } else if(action==='messages.send') {
      const receiverUid=String(payload.receiverUid||'');
      if(!receiverUid || receiverUid===targetUid || !String(payload.content||'').trim())return res.status(400).json({error:'A different recipient and message content are required'});
      const receiver=await db.collection('users').doc(receiverUid).get();
      if(!receiver.exists)return res.status(404).json({error:'Receiver not found'});
      const ref=await db.collection('messages').add({senderUid:targetUid,receiverUid,content:String(payload.content).trim().slice(0,5000),type:'text',read:false,createdAt:new Date()});
      result={success:true,message:{id:ref.id,senderUid:targetUid,receiverUid,content:String(payload.content).trim(),type:'text',read:false}};
    } else if(readCollections[action]) {
      const [collection,kind]=readCollections[action];
      if(kind==='profile') {
        const snap=await db.collection(collection).doc(String(targetUid)).get();
        if(!snap.exists)return res.status(404).json({error:'Customer not found'});
        const u=snap.data(); result={id:snap.id,...u};
      } else {
        const snap=await db.collection(collection).limit(1000).get();
        result=snap.docs.map(plain).filter(row => kind==='message' ? [row.senderUid,row.receiverUid,row.senderId,row.receiverId].includes(targetUid) : kind==='transfer' ? [row.senderUid,row.receiverUid,row.senderId,row.receiverId,row.from,row.to].includes(targetUid) : ownerMatch(row,targetUid)).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,100);
      }
    } else return res.status(400).json({error:'Unsupported customer action'});

    await audit(db,admin.id,'support_action_completed',targetUid,{sessionId,action,write,reason:write?reason.trim().slice(0,500):undefined});
    return res.json(result);
  } catch(error) {
    console.error('[admin-support-action] failed',{message:error.message});
    return res.status(500).json({error:'Support action failed'});
  }
}
