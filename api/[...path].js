import handler0 from '../server-handlers/admin-delete-login-video.js';
import handler1 from '../server-handlers/admin-sign-login-video-upload.js';
import handler2 from '../server-handlers/admin-upload-login-video.js';
import handler3 from '../server-handlers/ai-support-assistant.js';
import handler4 from '../server-handlers/apply-loan-penalties.js';
import handler5 from '../server-handlers/backfill-admin-claims.js';
import handler6 from '../server-handlers/battle-check-rooms.js';
import handler7 from '../server-handlers/battle-claim-prize.js';
import handler8 from '../server-handlers/battle-join-multiplayer.js';
import handler9 from '../server-handlers/battle-settle-tournament.js';
import handler10 from '../server-handlers/battle-settle.js';
import handler11 from '../server-handlers/battle-start.js';
import handler12 from '../server-handlers/broadcast-email-process.js';
import handler13 from '../server-handlers/broadcast-email-proxy.js';
import handler14 from '../server-handlers/broadcast-email-queue.js';
import handler15 from '../server-handlers/broadcast-email.js';
import handler16 from '../server-handlers/broadcast-push.js';
import handler17 from '../server-handlers/broadcast-sms.js';
import handler18 from '../server-handlers/cancel-prediction-event.js';
import handler19 from '../server-handlers/crash-cashout.js';
import handler20 from '../server-handlers/crash-start.js';
import handler21 from '../server-handlers/daily-report.js';
import handler22 from '../server-handlers/detect-duplicate-investments.js';
import handler23 from '../server-handlers/disable-2fa.js';
import handler24 from '../server-handlers/generate-2fa-secret.js';
import handler25 from '../server-handlers/held-balance-misuse-check.js';
import handler26 from '../server-handlers/member-lookup.js';
import handler27 from '../server-handlers/pesapal-initiate-payment.js';
import handler28 from '../server-handlers/pesapal-verify-payment.js';
import handler29 from '../server-handlers/place-prediction-bet.js';
import handler30 from '../server-handlers/push-config.js';
import handler31 from '../server-handlers/redeem-points.js';
import handler32 from '../server-handlers/renew-msg-alerts.js';
import handler33 from '../server-handlers/request-transfer-reversal.js';
import handler34 from '../server-handlers/respond-transfer-reversal.js';
import handler35 from '../server-handlers/risk-check.js';
import handler36 from '../server-handlers/run-daily-profits.js';
import handler37 from '../server-handlers/send-email-proxy.js';
import handler38 from '../server-handlers/send-email.js';
import handler39 from '../server-handlers/send-push.js';
import handler40 from '../server-handlers/send-sms.js';
import handler41 from '../server-handlers/send-telegram.js';
import handler42 from '../server-handlers/settle-free-prize-prediction.js';
import handler43 from '../server-handlers/settle-predictions.js';
import handler44 from '../server-handlers/sms-dashboard.js';
import handler45 from '../server-handlers/snake-bet.js';
import handler46 from '../server-handlers/snake-cashout.js';
import handler47 from '../server-handlers/sync-admin-claims.js';
import handler48 from '../server-handlers/upload-image.js';
import handler49 from '../server-handlers/validate-2fa.js';
import handler50 from '../server-handlers/verify-2fa.js';

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
