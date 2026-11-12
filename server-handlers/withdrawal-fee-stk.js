import { getDb, admin } from './_lib/firebase.js';

function normalizePhone(value) {
  const phone=String(value||'').replace(/\\s+/g,'');
  if(/^(07|01)\\d{8}$/.test(phone)) return '254'+phone.slice(1);
  if(/^254\\d{9}$/.test(phone)) return phone;
  throw new Error('Enter a valid Kenyan M-Pesa phone number');
}

export default async function handler(req,res) {
  let paymentRef=null;
  try {
    if(req.method!=='POST') return res.status(405).json({success:false,error:'Method not allowed'});
    const match=/^Bearer\\s+(.+)$/i.exec(String(req.headers.authorization||''));
    if(!match) return res.status(401).json({success:false,error:'Sign in is required'});
    const decoded=await admin.auth().verifyIdToken(match[1]);
    const uid=decoded.uid;
    const {phone_number,withdrawalAmountUSD,method}=req.body||{};
    const withdrawalAmount=Number(withdrawalAmountUSD);
    if(!Number.isFinite(withdrawalAmount)||withdrawalAmount<=0) return res.status(400).json({success:false,error:'Invalid withdrawal amount'});
    const db=getDb();
    const [userSnap,settingsSnap]=await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('platformSettings').doc('financial').get()
    ]);
    if(!userSnap.exists) return res.status(404).json({success:false,error:'User account not found'});
    const user=userSnap.data()||{};
    const settings=settingsSnap.exists?settingsSnap.data():{};
    const privileges=user.privileges||{};
    let rate=Number(settings.withdrawFeeRate ?? 0.0549);
    if(privileges.freeWithdrawFees===true) rate=0;
    else if(privileges.promoAccessEnabled===true && Number.isFinite(Number(privileges.customWithdrawFeeRate))) rate=Number(privileges.customWithdrawFeeRate);
    if(!Number.isFinite(rate)||rate<0||rate>1) return res.status(500).json({success:false,error:'Withdrawal fee setting is invalid'});
    const feeUSD=Number((withdrawalAmount*rate).toFixed(2));
    if(feeUSD<=0) return res.status(400).json({success:false,error:'No withdrawal fee is due for this account'});
    const fx=Number(process.env.USD_TO_KES_RATE||130);
    if(String(method||'').toLowerCase().includes('m-pesa') && withdrawalAmount>Math.min(3850,Math.floor((500000/fx)*100)/100)) {
      return res.status(400).json({success:false,error:'M-Pesa withdrawals cannot exceed $3,850 or KES 500,000, whichever is lower'});
    }
    const phone=normalizePhone(phone_number);
    const apiKey=process.env.PRINTPAY_API_KEY;
    if(!apiKey) return res.status(500).json({success:false,error:'PRINTPAY_API_KEY is not configured'});
    const paymentId='withdrawal_fee_'+Date.now()+'_'+uid.slice(0,6);
    paymentRef=db.collection('withdrawalFeePayments').doc(paymentId);
    await paymentRef.set({
      uid, withdrawalAmountUSD:withdrawalAmount, feeUSD, feeRate:rate,
      amountKES:Math.round(feeUSD*fx), phone, method:method||'',
      status:'initiating', createdAt:admin.firestore.FieldValue.serverTimestamp()
    });
    const form=new URLSearchParams();
    form.append('x_api_key',apiKey); form.append('phone_number',phone); form.append('amount',String(Math.round(feeUSD*fx)));
    const response=await fetch('https://printpay.site/api/stk_push',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form.toString()});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||['error','failed'].includes(String(data.status||'').toLowerCase())||!data.checkout_id) throw new Error(data.error||data.message||'PrintPay did not return a checkout ID');
    await paymentRef.update({checkoutId:data.checkout_id,status:'pending',stkStartedAt:admin.firestore.FieldValue.serverTimestamp()});
    return res.json({success:true,paymentId,checkoutId:data.checkout_id,feeUSD,amountKES:Math.round(feeUSD*fx)});
  } catch(error) {
    if(paymentRef) await paymentRef.set({status:'failed',failureReason:String(error.message||error),failedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true}).catch(()=>{});
    console.error('[withdrawal-fee-stk]',error);
    return res.status(500).json({success:false,error:error.message||'Could not initiate withdrawal fee payment'});
  }
}
