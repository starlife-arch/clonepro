import { getDb, admin, json, cents, todayKey } from './predictions.js';

const siteUrl = () => process.env.URL || process.env.SITE_URL || 'https://starlifeadvert.netlify.app';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function generateCrashPoint() {
  const rand = Math.random();
  if (rand < 0.30) return 1.00 + Math.random() * 0.20;
  if (rand < 0.55) return 1.20 + Math.random() * 0.30;
  if (rand < 0.75) return 1.50 + Math.random() * 0.50;
  if (rand < 0.90) return 2.00 + Math.random() * 3.00;
  if (rand < 0.98) return 5.00 + Math.random() * 5.00;
  return 10.00 + Math.random() * 40.00;
}

const defaultCrashPool = () => ({
  balance: 500,
  reserveMinimum: 300,
  dailyPayoutCap: 1000,
  dailyPayoutTotal: 0,
  dailyPayoutDate: todayKey(),
  totalBetsAllTime: 0,
  totalPayoutsAllTime: 0,
  totalProfitAllTime: 0,
  enabled: true,
  minBet: 0.50,
  maxBet: 500,
  autoCashoutDelayMs: 500
});

async function notifyAdmins(db, msg) {
  const admins = await db.collection('users').where('isAdmin', '==', true).limit(20).get();
  admins.forEach((doc) => db.collection('userNotifs').add({ uid: doc.id, msg, read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() }));
}

async function sendLowBalanceEmail(user) {
  if (!user?.email) return;
  try {
    await fetch(`${siteUrl()}/.netlify/functions/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-token': process.env.EMAIL_API_TOKEN || '' },
      body: JSON.stringify({
        type: 'game_low_balance',
        to: user.email,
        fromKey: 'games',
        data: { name: user.name || user.fullName || 'Member', balance: cents(user.gameWallet?.balance ?? user.gameWalletBalance ?? 0), message: `Your Game Wallet balance is below $5. Current balance: $${cents(user.gameWallet?.balance ?? user.gameWalletBalance ?? 0).toFixed(2)}. Top up before playing more games.` }
      })
    });
  } catch (e) { console.warn('crash low balance email failed', e.message); }
}

async function maybeNotifyLowBalance(db, userRef, userData, balance) {
  if (Number(balance) >= 5) return;
  const day = todayKey();
  if (userData.gameWallet?.lowBalanceEmailDate === day || userData.gameWalletLowBalanceEmailDate === day) return;
  await userRef.set({ 'gameWallet.lowBalanceEmailDate': day, gameWalletLowBalanceEmailDate: day }, { merge: true });
  await sendLowBalanceEmail({ ...userData, gameWallet: { ...(userData.gameWallet || {}), balance } });
}

export { getDb, admin, json, cents, todayKey, sleep, generateCrashPoint, defaultCrashPool, notifyAdmins, maybeNotifyLowBalance };
