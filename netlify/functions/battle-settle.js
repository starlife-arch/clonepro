import { json, settleBattleRoomById } from './_lib/battle-royale.js';
export default async (req) => { try { const { roomId='current' } = await req.json().catch(()=>({})); const result=await settleBattleRoomById(roomId); return json(result); } catch(e){ console.error('battle-settle failed',e); return json({success:false,error:e.message||'Settle failed'},500); } };
