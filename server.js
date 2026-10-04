import express from 'express';
import { createServer } from 'http';
import { readFileSync } from 'fs';

const app = express();
const PORT = process.env.PORT || 3000;

// ── CORS — must be first ─────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-token, x-user-uid, x-cron-secret, x-migration-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// ── Body parsing ─────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Health check ─────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'ok', service: 'Starlife Backend' }));

// ── API Routes ────────────────────────────────────────────────────────
// Helper to load handler and wrap it
async function loadHandler(path) {
  const mod = await import(path);
  return mod.default;
}

function route(app, method, path, handlerPath) {
  app[method](path, async (req, res) => {
    try {
      const handler = await loadHandler(handlerPath);
      await handler(req, res);
    } catch (err) {
      console.error(`[${path}] error:`, err.message);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    }
  });
}

// All routes
route(app, 'post', '/api/printpay-stk-push',        './server-handlers/printpay-stk-push.js');
route(app, 'post', '/api/printpay-check-status',    './server-handlers/printpay-check-status.js');
route(app, 'post', '/api/printpay-webhook',         './server-handlers/printpay-webhook.js');
route(app, 'post', '/api/send-telegram',            './server-handlers/send-telegram.js');
route(app, 'post', '/api/send-email',               './server-handlers/send-email.js');
route(app, 'post', '/api/send-email-proxy',         './server-handlers/send-email-proxy.js');
route(app, 'post', '/api/send-push',                './server-handlers/send-push.js');
route(app, 'post', '/api/send-sms',                 './server-handlers/send-sms.js');
route(app, 'post', '/api/ai-support-assistant',     './server-handlers/ai-support-assistant.js');
route(app, 'post', '/api/broadcast-email',          './server-handlers/broadcast-email.js');
route(app, 'post', '/api/broadcast-email-queue',    './server-handlers/broadcast-email-queue.js');
route(app, 'post', '/api/broadcast-email-process',  './server-handlers/broadcast-email-process.js');
route(app, 'post', '/api/broadcast-email-proxy',    './server-handlers/broadcast-email-proxy.js');
route(app, 'post', '/api/broadcast-push',           './server-handlers/broadcast-push.js');
route(app, 'post', '/api/broadcast-sms',            './server-handlers/broadcast-sms.js');
route(app, 'post', '/api/run-daily-profits',        './server-handlers/run-daily-profits.js');
route(app, 'post', '/api/apply-loan-penalties',     './server-handlers/apply-loan-penalties.js');
route(app, 'post', '/api/daily-report',             './server-handlers/daily-report.js');
route(app, 'post', '/api/held-balance-misuse-check','./server-handlers/held-balance-misuse-check.js');
route(app, 'post', '/api/detect-duplicate-investments', './server-handlers/detect-duplicate-investments.js');
route(app, 'post', '/api/renew-msg-alerts',         './server-handlers/renew-msg-alerts.js');
route(app, 'post', '/api/pesapal-initiate-payment', './server-handlers/pesapal-initiate-payment.js');
route(app, 'post', '/api/pesapal-verify-payment',   './server-handlers/pesapal-verify-payment.js');
route(app, 'post', '/api/upload-image',             './server-handlers/upload-image.js');
route(app, 'post', '/api/redeem-points',            './server-handlers/redeem-points.js');
route(app, 'post', '/api/push-config',              './server-handlers/push-config.js');
route(app, 'get',  '/api/push-config',              './server-handlers/push-config.js');
route(app, 'post', '/api/member-lookup',            './server-handlers/member-lookup.js');
route(app, 'post', '/api/risk-check',               './server-handlers/risk-check.js');
route(app, 'post', '/api/validate-2fa',             './server-handlers/validate-2fa.js');
route(app, 'post', '/api/generate-2fa-secret',      './server-handlers/generate-2fa-secret.js');
route(app, 'post', '/api/disable-2fa',              './server-handlers/disable-2fa.js');
route(app, 'post', '/api/backfill-admin-claims',    './server-handlers/backfill-admin-claims.js');
route(app, 'post', '/api/sync-admin-claims',        './server-handlers/sync-admin-claims.js');
route(app, 'post', '/api/battle-start',             './server-handlers/battle-start.js');
route(app, 'post', '/api/battle-settle',            './server-handlers/battle-settle.js');
route(app, 'post', '/api/battle-join-multiplayer',  './server-handlers/battle-join-multiplayer.js');
route(app, 'post', '/api/battle-check-rooms',       './server-handlers/battle-check-rooms.js');
route(app, 'post', '/api/battle-claim-prize',       './server-handlers/battle-claim-prize.js');
route(app, 'post', '/api/battle-settle-tournament', './server-handlers/battle-settle-tournament.js');
route(app, 'post', '/api/crash-start',              './server-handlers/crash-start.js');
route(app, 'post', '/api/crash-cashout',            './server-handlers/crash-cashout.js');
route(app, 'post', '/api/snake-bet',                './server-handlers/snake-bet.js');
route(app, 'post', '/api/snake-cashout',            './server-handlers/snake-cashout.js');
route(app, 'post', '/api/place-prediction-bet',     './server-handlers/place-prediction-bet.js');
route(app, 'post', '/api/settle-predictions',       './server-handlers/settle-predictions.js');
route(app, 'post', '/api/settle-free-prize-prediction', './server-handlers/settle-free-prize-prediction.js');
route(app, 'post', '/api/cancel-prediction-event',  './server-handlers/cancel-prediction-event.js');
route(app, 'post', '/api/request-transfer-reversal','./server-handlers/request-transfer-reversal.js');
route(app, 'post', '/api/respond-transfer-reversal','./server-handlers/respond-transfer-reversal.js');
route(app, 'post', '/api/sms-dashboard',            './server-handlers/sms-dashboard.js');
route(app, 'post', '/api/admin-sign-login-video-upload', './server-handlers/admin-sign-login-video-upload.js');
route(app, 'post', '/api/admin-upload-login-video', './server-handlers/admin-upload-login-video.js');
route(app, 'post', '/api/admin-delete-login-video', './server-handlers/admin-delete-login-video.js');
route(app, 'post', '/api/migrate-pg-to-firestore',  './server-handlers/migrate-pg-to-firestore.js');

// ── Start ─────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`Starlife backend running on port ${PORT}`));
