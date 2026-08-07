import handler0 from '../server/functions/admin-delete-login-video.js';
import handler1 from '../server/functions/admin-sign-login-video-upload.js';
import handler2 from '../server/functions/admin-upload-login-video.js';
import handler3 from '../server/functions/ai-support-assistant.js';
import handler4 from '../server/functions/apply-loan-penalties.js';
import handler5 from '../server/functions/backfill-admin-claims.js';
import handler6 from '../server/functions/battle-check-rooms.js';
import handler7 from '../server/functions/battle-claim-prize.js';
import handler8 from '../server/functions/battle-join-multiplayer.js';
import handler9 from '../server/functions/battle-settle-tournament.js';
import handler10 from '../server/functions/battle-settle.js';
import handler11 from '../server/functions/battle-start.js';
import handler12 from '../server/functions/broadcast-email-process.js';
import handler13 from '../server/functions/broadcast-email-proxy.js';
import handler14 from '../server/functions/broadcast-email-queue.js';
import handler15 from '../server/functions/broadcast-email.js';
import handler16 from '../server/functions/broadcast-push.js';
import handler17 from '../server/functions/broadcast-sms.js';
import handler18 from '../server/functions/cancel-prediction-event.js';
import handler19 from '../server/functions/crash-cashout.js';
import handler20 from '../server/functions/crash-start.js';
import handler21 from '../server/functions/daily-report.js';
import handler22 from '../server/functions/detect-duplicate-investments.js';
import handler23 from '../server/functions/disable-2fa.js';
import handler24 from '../server/functions/generate-2fa-secret.js';
import handler25 from '../server/functions/held-balance-misuse-check.js';
import handler26 from '../server/functions/member-lookup.js';
import handler27 from '../server/functions/pesapal-initiate-payment.js';
import handler28 from '../server/functions/pesapal-verify-payment.js';
import handler29 from '../server/functions/place-prediction-bet.js';
import handler30 from '../server/functions/push-config.js';
import handler31 from '../server/functions/redeem-points.js';
import handler32 from '../server/functions/renew-msg-alerts.js';
import handler33 from '../server/functions/request-transfer-reversal.js';
import handler34 from '../server/functions/respond-transfer-reversal.js';
import handler35 from '../server/functions/risk-check.js';
import handler36 from '../server/functions/run-daily-profits.js';
import handler37 from '../server/functions/send-email-proxy.js';
import handler38 from '../server/functions/send-email.js';
import handler39 from '../server/functions/send-push.js';
import handler40 from '../server/functions/send-sms.js';
import handler41 from '../server/functions/send-telegram.js';
import handler42 from '../server/functions/settle-free-prize-prediction.js';
import handler43 from '../server/functions/settle-predictions.js';
import handler44 from '../server/functions/sms-dashboard.js';
import handler45 from '../server/functions/snake-bet.js';
import handler46 from '../server/functions/snake-cashout.js';
import handler47 from '../server/functions/sync-admin-claims.js';
import handler48 from '../server/functions/upload-image.js';
import handler49 from '../server/functions/validate-2fa.js';
import handler50 from '../server/functions/verify-2fa.js';

const handlers = {
  "admin-delete-login-video": handler0,
  "admin-sign-login-video-upload": handler1,
  "admin-upload-login-video": handler2,
  "ai-support-assistant": handler3,
  "apply-loan-penalties": handler4,
  "backfill-admin-claims": handler5,
  "battle-check-rooms": handler6,
  "battle-claim-prize": handler7,
  "battle-join-multiplayer": handler8,
  "battle-settle-tournament": handler9,
  "battle-settle": handler10,
  "battle-start": handler11,
  "broadcast-email-process": handler12,
  "broadcast-email-proxy": handler13,
  "broadcast-email-queue": handler14,
  "broadcast-email": handler15,
  "broadcast-push": handler16,
  "broadcast-sms": handler17,
  "cancel-prediction-event": handler18,
  "crash-cashout": handler19,
  "crash-start": handler20,
  "daily-report": handler21,
  "detect-duplicate-investments": handler22,
  "disable-2fa": handler23,
  "generate-2fa-secret": handler24,
  "held-balance-misuse-check": handler25,
  "member-lookup": handler26,
  "pesapal-initiate-payment": handler27,
  "pesapal-verify-payment": handler28,
  "place-prediction-bet": handler29,
  "push-config": handler30,
  "redeem-points": handler31,
  "renew-msg-alerts": handler32,
  "request-transfer-reversal": handler33,
  "respond-transfer-reversal": handler34,
  "risk-check": handler35,
  "run-daily-profits": handler36,
  "send-email-proxy": handler37,
  "send-email": handler38,
  "send-push": handler39,
  "send-sms": handler40,
  "send-telegram": handler41,
  "settle-free-prize-prediction": handler42,
  "settle-predictions": handler43,
  "sms-dashboard": handler44,
  "snake-bet": handler45,
  "snake-cashout": handler46,
  "sync-admin-claims": handler47,
  "upload-image": handler48,
  "validate-2fa": handler49,
  "verify-2fa": handler50,
};

function routeName(req) {
  const path = req.query?.path;
  if (Array.isArray(path)) return path.join('/');
  if (typeof path === 'string') return path;
  return '';
}

export default async function handler(req, res) {
  const name = routeName(req);
  const routeHandler = handlers[name];
  if (!routeHandler) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();
    return res.status(404).json({ error: 'API route not found' });
  }
  return routeHandler(req, res);
}
