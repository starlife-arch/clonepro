import { handle as handler0 } from '../server-handlers/admin-delete-login-video.js';
import { handle as handler1 } from '../server-handlers/admin-sign-login-video-upload.js';
import { handle as handler2 } from '../server-handlers/admin-upload-login-video.js';
import { handle as handler3 } from '../server-handlers/ai-support-assistant.js';
import { handle as handler4 } from '../server-handlers/apply-loan-penalties.js';
import { handle as handler5 } from '../server-handlers/backfill-admin-claims.js';
import { handle as handler6 } from '../server-handlers/battle-check-rooms.js';
import { handle as handler7 } from '../server-handlers/battle-claim-prize.js';
import { handle as handler8 } from '../server-handlers/battle-join-multiplayer.js';
import { handle as handler9 } from '../server-handlers/battle-settle-tournament.js';
import { handle as handler10 } from '../server-handlers/battle-settle.js';
import { handle as handler11 } from '../server-handlers/battle-start.js';
import { handle as handler12 } from '../server-handlers/broadcast-email-process.js';
import { handle as handler13 } from '../server-handlers/broadcast-email-proxy.js';
import { handle as handler14 } from '../server-handlers/broadcast-email-queue.js';
import { handle as handler15 } from '../server-handlers/broadcast-email.js';
import { handle as handler16 } from '../server-handlers/broadcast-push.js';
import { handle as handler17 } from '../server-handlers/broadcast-sms.js';
import { handle as handler18 } from '../server-handlers/cancel-prediction-event.js';
import { handle as handler19 } from '../server-handlers/crash-cashout.js';
import { handle as handler20 } from '../server-handlers/crash-start.js';
import { handle as handler21 } from '../server-handlers/daily-report.js';
import { handle as handler22 } from '../server-handlers/detect-duplicate-investments.js';
import { handle as handler23 } from '../server-handlers/disable-2fa.js';
import { handle as handler24 } from '../server-handlers/generate-2fa-secret.js';
import { handle as handler25 } from '../server-handlers/held-balance-misuse-check.js';
import { handle as handler26 } from '../server-handlers/member-lookup.js';
import { handle as handler27 } from '../server-handlers/pesapal-initiate-payment.js';
import { handle as handler28 } from '../server-handlers/pesapal-verify-payment.js';
import { handle as handler29 } from '../server-handlers/place-prediction-bet.js';
import { handle as handler30 } from '../server-handlers/push-config.js';
import { handle as handler31 } from '../server-handlers/redeem-points.js';
import { handle as handler32 } from '../server-handlers/renew-msg-alerts.js';
import { handle as handler33 } from '../server-handlers/request-transfer-reversal.js';
import { handle as handler34 } from '../server-handlers/respond-transfer-reversal.js';
import { handle as handler35 } from '../server-handlers/risk-check.js';
import { handle as handler36 } from '../server-handlers/run-daily-profits.js';
import { handle as handler37 } from '../server-handlers/send-email-proxy.js';
import { handle as handler38 } from '../server-handlers/send-email.js';
import { handle as handler39 } from '../server-handlers/send-push.js';
import { handle as handler40 } from '../server-handlers/send-sms.js';
import { handle as handler41 } from '../server-handlers/send-telegram.js';
import { handle as handler42 } from '../server-handlers/settle-free-prize-prediction.js';
import { handle as handler43 } from '../server-handlers/settle-predictions.js';
import { handle as handler44 } from '../server-handlers/sms-dashboard.js';
import { handle as handler45 } from '../server-handlers/snake-bet.js';
import { handle as handler46 } from '../server-handlers/snake-cashout.js';
import { handle as handler47 } from '../server-handlers/sync-admin-claims.js';
import { handle as handler48 } from '../server-handlers/upload-image.js';
import { handle as handler49 } from '../server-handlers/validate-2fa.js';
import { handle as handler50 } from '../server-handlers/verify-2fa.js';

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
