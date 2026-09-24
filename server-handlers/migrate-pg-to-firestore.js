import { getDb, admin } from './_lib/firebase.js';
import { query } from './_lib/postgres.js';

const SECRET = process.env.MIGRATION_SECRET || 'starlife2026migration';

function pgTs(ts) {
  if (!ts) return null;
  const d = ts instanceof Date ? ts : new Date(ts);
  return isNaN(d.getTime()) ? null : admin.firestore.Timestamp.fromDate(d);
}

async function recoverDeposits(db, report) {
  const { rows } = await query(`SELECT d.*, u.name as user_name, u.email as user_email FROM deposits d LEFT JOIN users u ON u.id = d.user_id ORDER BY d.created_at DESC LIMIT 2000`);
  let written = 0, skipped = 0;
  for (const row of rows) {
    try {
      const ref = db.collection('deposits').doc(row.id);
      if ((await ref.get()).exists) { skipped++; continue; }
      await ref.set({ uid: row.user_id, userName: row.user_name || '', userEmail: row.user_email || '', amount: Number(row.amount || 0), amountKES: Number(row.amount_kes || 0), method: row.method || 'Unknown', status: row.status || 'pending', ref: row.receipt || row.id, txId: row.receipt || row.id, phone: row.phone || '', checkoutId: row.checkout_id || '', createdAt: pgTs(row.created_at) || admin.firestore.FieldValue.serverTimestamp(), _fromPg: true });
      written++;
    } catch (e) { report.errors.push({ table: 'deposits', id: row.id, error: e.message }); }
  }
  report.deposits = { written, skipped };
}

async function recoverWithdrawals(db, report) {
  const { rows } = await query(`SELECT w.*, u.name as user_name, u.email as user_email FROM withdrawals w LEFT JOIN users u ON u.id = w.user_id ORDER BY w.created_at DESC LIMIT 2000`);
  let written = 0, skipped = 0;
  for (const row of rows) {
    try {
      const ref = db.collection('withdrawals').doc(row.id);
      if ((await ref.get()).exists) { skipped++; continue; }
      const amt = Number(row.amount || 0);
      await ref.set({ uid: row.user_id, userName: row.user_name || '', userEmail: row.user_email || '', txId: row.id, amount: amt, fee: parseFloat((amt * 0.1).toFixed(2)), net: parseFloat((amt * 0.9).toFixed(2)), method: row.method || 'Unknown', details: row.account || '', status: row.status || 'pending', createdAt: pgTs(row.created_at) || admin.firestore.FieldValue.serverTimestamp(), _fromPg: true });
      written++;
    } catch (e) { report.errors.push({ table: 'withdrawals', id: row.id, error: e.message }); }
  }
  report.withdrawals = { written, skipped };
}

async function recoverInvestments(db, report) {
  const { rows } = await query(`SELECT inv.*, u.name as user_name, u.email as user_email FROM investments inv LEFT JOIN users u ON u.id = inv.user_id ORDER BY inv.created_at DESC LIMIT 5000`);
  let written = 0, skipped = 0;
  for (const row of rows) {
    try {
      const ref = db.collection('investments').doc(row.id);
      if ((await ref.get()).exists) { skipped++; continue; }
      const amount = Number(row.amount || 0);
      const rate = Number(row.daily_rate || 0.02);
      await ref.set({ uid: row.user_id, userName: row.user_name || '', userEmail: row.user_email || '', amount, method: row.plan || 'Investment', txid: row.id, status: row.status || 'active', earningEnabled: row.status === 'active', dailyProfit: parseFloat((amount * rate).toFixed(4)), totalPaid: Number(row.total_earned || 0), createdAt: pgTs(row.created_at) || admin.firestore.FieldValue.serverTimestamp(), _fromPg: true });
      written++;
    } catch (e) { report.errors.push({ table: 'investments', id: row.id, error: e.message }); }
  }
  report.investments = { written, skipped };
}

async function recoverLoans(db, report) {
  const { rows } = await query(`SELECT l.*, u.name as user_name, u.email as user_email FROM loans l LEFT JOIN users u ON u.id = l.user_id ORDER BY l.created_at DESC LIMIT 500`);
  let written = 0, skipped = 0;
  for (const row of rows) {
    try {
      const ref = db.collection('loans').doc(row.id);
      if ((await ref.get()).exists) { skipped++; continue; }
      const amount = Number(row.amount || 0);
      const rate = Number(row.interest_rate || 0.10);
      const interest = parseFloat((amount * rate).toFixed(4));
      await ref.set({ uid: row.user_id, userName: row.user_name || '', userEmail: row.user_email || '', amount, interest, receive: parseFloat((amount - interest).toFixed(4)), rate, term: 7, status: row.status || 'pending', penalty: Number(row.penalty || 0), dueDate: pgTs(row.due_date), createdAt: pgTs(row.created_at) || admin.firestore.FieldValue.serverTimestamp(), _fromPg: true });
      written++;
    } catch (e) { report.errors.push({ table: 'loans', id: row.id, error: e.message }); }
  }
  report.loans = { written, skipped };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const secret = req.headers['x-migration-secret'];
  if (secret !== SECRET) return res.status(401).json({ error: 'Unauthorized' });
  const db = getDb();
  const report = { startedAt: new Date().toISOString(), errors: [] };
  const { collections = ['deposits','withdrawals','investments','loans'] } = req.body || {};
  if (collections.includes('deposits'))    await recoverDeposits(db, report);
  if (collections.includes('withdrawals')) await recoverWithdrawals(db, report);
  if (collections.includes('investments')) await recoverInvestments(db, report);
  if (collections.includes('loans'))       await recoverLoans(db, report);
  report.completedAt = new Date().toISOString();
  report.success = report.errors.length === 0;
  return res.json(report);
}
