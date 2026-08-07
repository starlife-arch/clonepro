import { getDb, admin, json, settleBattleRoomById, createFreshBattleRoom } from './_lib/battle-royale.js';
async function legacyHandler() { try { const db=getDb(); const now=Date.now(); const hourAgo=admin.firestore.Timestamp.fromMillis(now - 60*60*1000); const snap=await db.collection('battleRoyaleRooms').where('status','==','countdown').get(); const settled=[]; for(const doc of snap.docs){ const r=doc.data()||{}; const full=Number(r.realPlayerCount||0)>=Number(r.maxPlayers||20); const old=r.countdownStartedAt&&r.countdownStartedAt.toMillis&&r.countdownStartedAt.toMillis()<=hourAgo.toMillis(); if(full||old){ try{ const result=await settleBattleRoomById(doc.id); settled.push({roomId:doc.id,winner:result.winner}); }catch(e){ console.error('battle-check-rooms settle failed',doc.id,e); } } } const current=await db.collection('battleRoyaleRooms').doc('current').get(); if(!current.exists) await createFreshBattleRoom(db); return json({success:true,settled}); } catch(e){ console.error('battle-check-rooms failed',e); return json({success:false,error:e.message||'Room check failed'},500); } };


import { runVercelHandler } from './_lib/vercel-adapter.js';

export default async function handler(req, res) {
  return runVercelHandler(req, res, legacyHandler);
}
