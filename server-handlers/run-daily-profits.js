import { getDb, admin } from './_lib/firebase.js';

const DEFAULT_INVESTMENT_DAILY_RATE = 0.02;
const BATCH_FLUSH = 400;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function fmt(n) { return Number(n || 0).toFixed(2); }
function genTxId() { return 'TX-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(); }

async function flushBatch(db, batchState) {
  if (batchState.ops > 0) await batchState.batch.commit();
  return { batch: db.batch(), ops: 0 };
}

async function loadInvestmentDailyRate(db) {
  try {
    const snap = await db.collection('platformSettings').doc('financial').get();
    const rate = Number(snap.data()?.investmentDailyRate);
    if (Number.isFinite(rate)) return Math.min(1, Math.max(0, rate));
  } catch (error) {
    console.warn('[run-daily-profits] platform settings unavailable', error);
  }
  return DEFAULT_INVESTMENT_DAILY_RATE;
}

function getEffectiveInvestmentRate(userObj, platformRate) {
  const custom = Number(userObj?.customInvestmentDailyRate);
  if (Number.isFinite(custom) && custom >= 0 && custom <= 1) return custom;
  return platformRate;
}

async function loadUsersByIds(db, uids) {
  const userCache = {};
  const unique = [...new Set(uids.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 30) {
    const chunk = unique.slice(i, i + 30);
    const snap = await db.collection('users').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
    snap.docs.forEach(d => { userCache[d.id] = d.data() || {}; });
  }
  return userCache;
}

async function runDailyProfits() {
  const db = getDb();
  const today = new Date().toDateString();
  const errors = [];
  let investCount = 0;
  let stakeCount = 0;
  let savingsCount = 0;
  let savingsPrincipalReleased = 0;
  let vaultReleased = 0;
  let totalCredited = 0;
  const inc = admin.firestore.FieldValue.increment;
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;
  const platformRate = await loadInvestmentDailyRate(db);

  try {
    const invSnap = await db.collection('investments').where('status', '==', 'active').get();
    const userCache = await loadUsersByIds(db, invSnap.docs.map(d => d.data()?.uid));
    let state = { batch: db.batch(), ops: 0 };

    for (const doc of invSnap.docs) {
      const inv = doc.data() || {};
      try {
        if (!inv.uid) continue;
        if (inv.lastProfitDate === today) continue;
        if (inv.earningEnabled === false) continue;
        if ((inv.amount || 0) <= 0) continue;
        if (['deducted', 'inactive', 'cancelled'].includes(String(inv.status || '').toLowerCase())) continue;
        const uData = userCache[inv.uid];
        if (!uData || uData.isBanned) continue;

        const rate = getEffectiveInvestmentRate(uData, platformRate);
        const profit = parseFloat(((inv.amount || 0) * rate).toFixed(4));
        if (profit <= 0) continue;

        let reinvestAmt = 0;
        let balanceProfit = profit;
        if (uData.autoReinvest && uData.autoReinvestPct > 0) {
          reinvestAmt = parseFloat((profit * uData.autoReinvestPct / 100).toFixed(4));
          balanceProfit = parseFloat((profit - reinvestAmt).toFixed(4));
        }

        state.batch.update(db.collection('users').doc(inv.uid), { balance: inc(balanceProfit), totalEarned: inc(profit) });
        state.ops++;
        state.batch.update(doc.ref, { totalPaid: inc(profit), lastProfitDate: today, lastProfitAt: serverTimestamp() });
        state.ops++;

        if (reinvestAmt > 0) {
          const newInvRef = db.collection('investments').doc();
          state.batch.set(newInvRef, { uid: inv.uid, userName: uData.name, userEmail: uData.email, amount: reinvestAmt, method: 'Auto-Reinvest', txid: 'AR-' + genTxId(), status: 'active', earningEnabled: true, dailyProfit: reinvestAmt * rate, totalPaid: 0, createdAt: serverTimestamp() });
          state.ops++;
          state.batch.set(db.collection('activity').doc(), { uid: inv.uid, desc: `Auto-reinvested $${fmt(reinvestAmt)} (${uData.autoReinvestPct}% of $${fmt(profit)} profit)`, amt: -reinvestAmt, icon: '🔄', type: 'profit', createdAt: serverTimestamp() });
          state.ops++;
        }

        state.batch.set(db.collection('activity').doc(), { uid: inv.uid, desc: `Investment daily profit ${(rate * 100).toFixed(2)}% (${today})`, amt: profit, icon: '📈', type: 'profit', createdAt: serverTimestamp() });
        state.ops++;
        state.batch.set(db.collection('userNotifs').doc(), { uid: inv.uid, msg: `📈 Daily profit +$${profit.toFixed(2)} from $${fmt(inv.amount)} investment at ${(rate * 100).toFixed(2)}%`, read: false, createdAt: serverTimestamp() });
        state.ops++;
        investCount++;
        totalCredited += balanceProfit;
        if (state.ops >= BATCH_FLUSH) state = await flushBatch(db, state);
      } catch (error) {
        errors.push({ scope: 'investment', id: doc.id, error: error.message });
      }
    }
    if (state.ops > 0) await state.batch.commit();
  } catch (error) {
    errors.push({ scope: 'investments', error: error.message });
  }

  try {
    const DAILY_POOL = parseFloat((2000000 / 365).toFixed(4));
    const BASE_POOL = 500000;
    const shSnap = await db.collection('users').where('shareholderStake', '>', 0).get();
    const realStake = shSnap.docs.reduce((s, d) => s + (d.data().shareholderStake || 0), 0);
    const totalStake = realStake + BASE_POOL;
    if (realStake > 0) {
      let state = { batch: db.batch(), ops: 0 };
      for (const doc of shSnap.docs) {
        const u = doc.data() || {};
        try {
          if (u.isBanned || u.shareholderEarningsPaused || u.shLastProfitDate === today) continue;
          const stake = u.shareholderStake || 0;
          if (stake <= 0) continue;
          const earn = parseFloat(((stake / totalStake) * DAILY_POOL).toFixed(4));
          if (earn <= 0) continue;
          state.batch.update(doc.ref, { balance: inc(earn), shareholderEarned: inc(earn), shareholderDistributed: inc(earn), totalEarned: inc(earn), shLastProfitDate: today });
          state.ops++;
          state.batch.set(db.collection('activity').doc(), { uid: doc.id, desc: `Shareholder daily earn ($${stake.toFixed(2)} stake / $${totalStake.toFixed(2)} pool × $${DAILY_POOL.toFixed(2)}) = $${earn.toFixed(4)} (${today})`, amt: earn, icon: '💎', type: 'shareholder', createdAt: serverTimestamp() });
          state.ops++;
          state.batch.set(db.collection('userNotifs').doc(), { uid: doc.id, msg: `💎 Shareholder earning +$${earn.toFixed(4)} from $${stake.toFixed(2)} stake`, read: false, createdAt: serverTimestamp() });
          state.ops++;
          stakeCount++;
          totalCredited += earn;
          if (state.ops >= BATCH_FLUSH) state = await flushBatch(db, state);
        } catch (error) {
          errors.push({ scope: 'shareholder', id: doc.id, error: error.message });
        }
      }
      if (state.ops > 0) await state.batch.commit();
    }
  } catch (error) {
    errors.push({ scope: 'shareholders', error: error.message });
  }

  try {
    const savSnap = await db.collection('savings').where('status', '==', 'active').get();
    const savUserCache = await loadUsersByIds(db, savSnap.docs.map(d => d.data()?.uid));
    let state = { batch: db.batch(), ops: 0 };
    for (const doc of savSnap.docs) {
      const sav = doc.data() || {};
      try {
        if (!sav.uid) continue;
        const unlockDate = sav.unlockDate ? new Date(sav.unlockDate.seconds * 1000) : null;
        if (unlockDate && new Date() >= unlockDate) {
          if (state.ops > 0) state = await flushBatch(db, state);
          const amount = Number(sav.amount || 0);
          if (amount > 0) {
            const released = await db.runTransaction(async tx => {
              const freshSnap = await tx.get(doc.ref);
              const fresh = freshSnap.data() || {};
              if (fresh.status !== 'active') return false;
              tx.update(db.collection('users').doc(sav.uid), { balance: inc(amount), savingsBalance: inc(-amount) });
              tx.update(doc.ref, { status: 'completed', completedAt: serverTimestamp() });
              return true;
            });
            if (released) {
              const msg = `Savings matured — $${fmt(amount)} principal returned to your balance`;
              state.batch.set(db.collection('activity').doc(), { uid: sav.uid, desc: msg, amt: amount, icon: '🏦', type: 'savings', createdAt: serverTimestamp() });
              state.ops++;
              state.batch.set(db.collection('userNotifs').doc(), { uid: sav.uid, msg, read: false, createdAt: serverTimestamp() });
              state.ops++;
              savingsPrincipalReleased++;
              totalCredited += amount;
            }
          }
          if (state.ops >= BATCH_FLUSH) state = await flushBatch(db, state);
          continue;
        }
        if (sav.savLastProfitDate === today) continue;
        const uData = savUserCache[sav.uid];
        if (!uData || uData.isBanned) continue;
        const profit = parseFloat(((sav.amount || 0) * 0.03).toFixed(4));
        if (profit <= 0) continue;
        state.batch.update(db.collection('users').doc(sav.uid), { savingsEarned: inc(profit), totalEarned: inc(profit) });
        state.ops++;
        state.batch.update(doc.ref, { totalPaid: inc(profit), savLastProfitDate: today, savLastProfitAt: serverTimestamp() });
        state.ops++;
        state.batch.set(db.collection('activity').doc(), { uid: sav.uid, desc: `Savings 3% daily profit on $${fmt(sav.amount || 0)} (${today})`, amt: profit, icon: '🏦', type: 'savings', createdAt: serverTimestamp() });
        state.ops++;
        state.batch.set(db.collection('userNotifs').doc(), { uid: sav.uid, msg: `🏦 Savings profit: +$${profit.toFixed(4)} (3% on $${fmt(sav.amount || 0)})`, read: false, createdAt: serverTimestamp() });
        state.ops++;
        savingsCount++;
        totalCredited += profit;
        if (state.ops >= BATCH_FLUSH) state = await flushBatch(db, state);
      } catch (error) {
        errors.push({ scope: 'savings', id: doc.id, error: error.message });
      }
    }
    if (state.ops > 0) await state.batch.commit();
  } catch (error) {
    errors.push({ scope: 'savings', error: error.message });
  }

  try {
    const vaultSnap = await db.collection('savingsVault').where('status', '==', 'locked').get();
    let state = { batch: db.batch(), ops: 0 };
    const now = new Date();
    for (const doc of vaultSnap.docs) {
      const v = doc.data() || {};
      try {
        if (!v.uid || !v.unlocksAt) continue;
        const unlockDate = new Date(v.unlocksAt.seconds * 1000);
        if (now < unlockDate) continue;
        if (state.ops > 0) state = await flushBatch(db, state);
        const receive = Number(v.receive || 0);
        const bonus = Number(v.bonus || 0);
        if (receive <= 0) continue;
        const released = await db.runTransaction(async tx => {
          const freshSnap = await tx.get(doc.ref);
          const fresh = freshSnap.data() || {};
          if (fresh.status !== 'locked') return false;
          tx.update(db.collection('users').doc(v.uid), { balance: inc(receive), totalEarned: inc(bonus) });
          tx.update(doc.ref, { status: 'released', releasedAt: serverTimestamp() });
          return true;
        });
        if (released) {
          state.batch.set(db.collection('activity').doc(), { uid: v.uid, desc: `Vault released: $${fmt(receive)} (+$${fmt(bonus)} bonus)`, amt: receive, icon: '🔐', type: 'deposit', createdAt: serverTimestamp() });
          state.ops++;
          state.batch.set(db.collection('userNotifs').doc(), { uid: v.uid, msg: `🔐 Vault unlocked! $${fmt(receive)} added to your balance (+$${fmt(bonus)} bonus)`, read: false, createdAt: serverTimestamp() });
          state.ops++;
          vaultReleased++;
          totalCredited += receive;
        }
        if (state.ops >= BATCH_FLUSH) state = await flushBatch(db, state);
      } catch (error) {
        errors.push({ scope: 'vault', id: doc.id, error: error.message });
      }
    }
    if (state.ops > 0) await state.batch.commit();
  } catch (error) {
    errors.push({ scope: 'vault', error: error.message });
  }

  const result = { success: errors.length === 0, date: today, investCount, stakeCount, savingsCount, savingsPrincipalReleased, vaultReleased, totalCredited: parseFloat(totalCredited.toFixed(4)), errors };
  await db.collection('profitRunLogs').add({ runAt: serverTimestamp(), ...result });
  return result;
}

async function netlifyHandler() {
  try {
    return json(await runDailyProfits());
  } catch (error) {
    console.error('[run-daily-profits] failed', error);
    try {
      await getDb().collection('profitRunLogs').add({ runAt: admin.firestore.FieldValue.serverTimestamp(), investCount: 0, stakeCount: 0, savingsCount: 0, savingsPrincipalReleased: 0, vaultReleased: 0, totalCredited: 0, errors: [{ scope: 'fatal', error: error.message || 'Daily profit run failed' }] });
    } catch (_) {}
    return json({ success: false, error: error.message || 'Daily profit run failed' }, 500);
  }
};



import { runNetlifyHandler } from './_lib/vercel-adapter.js';

export default async function handler(req, res) {
  return runNetlifyHandler(req, res, netlifyHandler);
}
