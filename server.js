import express from 'express';
import cron from 'node-cron';
import { runDailyProfits } from './server-handlers/run-daily-profits.js';
import { runLoanPenalties } from './server-handlers/apply-loan-penalties.js';
import { runDailyReport } from './server-handlers/daily-report.js';
import { runHeldBalanceCheck } from './server-handlers/held-balance-misuse-check.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runMigrations } from './server-handlers/_lib/migrate.js';
import migrateHandler from './server-handlers/migrate-from-firestore.js';

import handler0 from './server-handlers/admin-delete-login-video.js';
import handler1 from './server-handlers/admin-sign-login-video-upload.js';
import handler2 from './server-handlers/admin-upload-login-video.js';
import handler3 from './server-handlers/ai-support-assistant.js';
import handler4 from './server-handlers/apply-loan-penalties.js';
import handler5 from './server-handlers/backfill-admin-claims.js';
import handler6 from './server-handlers/battle-check-rooms.js';
import handler7 from './server-handlers/battle-claim-prize.js';
import handler8 from './server-handlers/battle-join-multiplayer.js';
import handler9 from './server-handlers/battle-settle-tournament.js';
import handler10 from './server-handlers/battle-settle.js';
import handler11 from './server-handlers/battle-start.js';
import handler12 from './server-handlers/broadcast-email-process.js';
import handler13 from './server-handlers/broadcast-email-proxy.js';
import handler14 from './server-handlers/broadcast-email-queue.js';
import handler15 from './server-handlers/broadcast-email.js';
import handler16 from './server-handlers/broadcast-push.js';
import handler17 from './server-handlers/broadcast-sms.js';
import handler18 from './server-handlers/cancel-prediction-event.js';
import handler19 from './server-handlers/crash-cashout.js';
import handler20 from './server-handlers/crash-start.js';
import handler21 from './server-handlers/daily-report.js';
import handler22 from './server-handlers/detect-duplicate-investments.js';
import handler23 from './server-handlers/disable-2fa.js';
import handler24 from './server-handlers/generate-2fa-secret.js';
import handler25 from './server-handlers/held-balance-misuse-check.js';
import handler26 from './server-handlers/member-lookup.js';
import handler27 from './server-handlers/pesapal-initiate-payment.js';
import handler28 from './server-handlers/pesapal-verify-payment.js';
import handler29 from './server-handlers/place-prediction-bet.js';
import handler30 from './server-handlers/push-config.js';
import handler31 from './server-handlers/redeem-points.js';
import handler32 from './server-handlers/renew-msg-alerts.js';
import handler33 from './server-handlers/request-transfer-reversal.js';
import handler34 from './server-handlers/respond-transfer-reversal.js';
import handler35 from './server-handlers/risk-check.js';
import handler36 from './server-handlers/run-daily-profits.js';
import handler37 from './server-handlers/send-email-proxy.js';
import handler38 from './server-handlers/send-email.js';
import handler39 from './server-handlers/send-push.js';
import handler40 from './server-handlers/send-sms.js';
import handler41 from './server-handlers/send-telegram.js';
import handler42 from './server-handlers/settle-free-prize-prediction.js';
import handler43 from './server-handlers/settle-predictions.js';
import handler44 from './server-handlers/sms-dashboard.js';
import handler45 from './server-handlers/snake-bet.js';
import handler46 from './server-handlers/snake-cashout.js';
import handler47 from './server-handlers/sync-admin-claims.js';
import handler48 from './server-handlers/upload-image.js';
import handler49 from './server-handlers/validate-2fa.js';
import handler50 from './server-handlers/verify-2fa.js';
import printpayStkPush from './server-handlers/printpay-stk-push.js';
import printpayCheckStatus from './server-handlers/printpay-check-status.js';
import printpayWebhook from './server-handlers/printpay-webhook.js';
import pgUser from './server-handlers/pg-user.js';
import pgDeposits from './server-handlers/pg-deposits.js';
import pgWithdrawals from './server-handlers/pg-withdrawals.js';
import pgInvestments from './server-handlers/pg-investments.js';
import pgLoans from './server-handlers/pg-loans.js';
import pgActivity from './server-handlers/pg-activity.js';
import pgNotifications from './server-handlers/pg-notifications.js';
import pgAdminUsers from './server-handlers/pg-admin-users.js';
import pgAdminBalance from './server-handlers/pg-admin-balance.js';
import pgAdminActivity from './server-handlers/pg-admin-activity.js';

const app = express();
const rootDir = dirname(fileURLToPath(import.meta.url));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-token, x-migration-secret, x-user-uid, x-admin-uid');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.all('/api/admin-delete-login-video', handler0);
app.all('/api/admin-sign-login-video-upload', handler1);
app.all('/api/admin-upload-login-video', handler2);
app.all('/api/ai-support-assistant', handler3);
app.all('/api/apply-loan-penalties', handler4);
app.all('/api/backfill-admin-claims', handler5);
app.all('/api/battle-check-rooms', handler6);
app.all('/api/battle-claim-prize', handler7);
app.all('/api/battle-join-multiplayer', handler8);
app.all('/api/battle-settle-tournament', handler9);
app.all('/api/battle-settle', handler10);
app.all('/api/battle-start', handler11);
app.all('/api/broadcast-email-process', handler12);
app.all('/api/broadcast-email-proxy', handler13);
app.all('/api/broadcast-email-queue', handler14);
app.all('/api/broadcast-email', handler15);
app.all('/api/broadcast-push', handler16);
app.all('/api/broadcast-sms', handler17);
app.all('/api/cancel-prediction-event', handler18);
app.all('/api/crash-cashout', handler19);
app.all('/api/crash-start', handler20);
app.all('/api/daily-report', handler21);
app.all('/api/detect-duplicate-investments', handler22);
app.all('/api/disable-2fa', handler23);
app.all('/api/generate-2fa-secret', handler24);
app.all('/api/held-balance-misuse-check', handler25);
app.all('/api/member-lookup', handler26);
app.all('/api/pesapal-initiate-payment', handler27);
app.all('/api/pesapal-verify-payment', handler28);
app.all('/api/place-prediction-bet', handler29);
app.all('/api/push-config', handler30);
app.all('/api/redeem-points', handler31);
app.all('/api/renew-msg-alerts', handler32);
app.all('/api/request-transfer-reversal', handler33);
app.all('/api/respond-transfer-reversal', handler34);
app.all('/api/risk-check', handler35);
app.all('/api/run-daily-profits', handler36);
app.all('/api/send-email-proxy', handler37);
app.all('/api/send-email', handler38);
app.all('/api/send-push', handler39);
app.all('/api/send-sms', handler40);
app.all('/api/send-telegram', handler41);
app.all('/api/settle-free-prize-prediction', handler42);
app.all('/api/settle-predictions', handler43);
app.all('/api/sms-dashboard', handler44);
app.all('/api/snake-bet', handler45);
app.all('/api/snake-cashout', handler46);
app.all('/api/sync-admin-claims', handler47);
app.all('/api/upload-image', handler48);
app.all('/api/validate-2fa', handler49);
app.all('/api/verify-2fa', handler50);
app.all('/api/printpay-stk-push', printpayStkPush);
app.all('/api/printpay-check-status', printpayCheckStatus);
app.all('/api/printpay-webhook', printpayWebhook);
app.post('/api/migrate-from-firestore', migrateHandler);
app.get('/api/pg/user/:uid', pgUser);
app.get('/api/pg/deposits/:uid', pgDeposits);
app.get('/api/pg/withdrawals/:uid', pgWithdrawals);
app.get('/api/pg/investments/:uid', pgInvestments);
app.get('/api/pg/loans/:uid', pgLoans);
app.get('/api/pg/activity/:uid', pgActivity);
app.get('/api/pg/notifications/:uid', pgNotifications);
app.get('/api/pg/admin/users', pgAdminUsers);
app.post('/api/pg/admin/balance', pgAdminBalance);
app.get('/api/pg/admin/activity', pgAdminActivity);

for (const asset of ['index.html', 'styles.css', 'app.js', 'firebase-messaging-sw.js']) {
  app.get(`/${asset}`, (req, res) => res.sendFile(join(rootDir, asset)));
}
app.get('/pesapal-callback', (req, res) => res.sendFile(join(rootDir, 'index.html')));
app.get('*', (req, res) => res.sendFile(join(rootDir, 'index.html')));

cron.schedule('0 1 * * *', async () => {
  console.log('[cron] running daily profits...');
  try { await runDailyProfits(); console.log('[cron] daily profits done'); }
  catch (e) { console.error('[cron] daily profits failed', e); }
});

cron.schedule('0 2 * * *', async () => {
  console.log('[cron] running loan penalties...');
  try { await runLoanPenalties(); console.log('[cron] loan penalties done'); }
  catch (e) { console.error('[cron] loan penalties failed', e); }
});

cron.schedule('0 6 * * *', async () => {
  console.log('[cron] running daily report...');
  try { await runDailyReport(); console.log('[cron] daily report done'); }
  catch (e) { console.error('[cron] daily report failed', e); }
});

cron.schedule('0 3 * * *', async () => {
  console.log('[cron] running held balance check...');
  try { await runHeldBalanceCheck(); console.log('[cron] held balance check done'); }
  catch (e) { console.error('[cron] held balance check failed', e); }
});

await runMigrations();
console.log('[db] migrations complete');

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on port ${port}`));
