import { query } from './_lib/postgres.js';
import { requireUser } from './_lib/pg-auth.js';

const makeId = (type, uid) => `${type}_${Date.now()}_${uid.slice(0, 8)}`;
const amount = value => Number(value);

/** Persist the PostgreSQL copy of a client-created financial record. Firestore remains the backup write. */
export async function createDeposit(req, res) {
  const { uid, amount: value, method, status = 'pending', phone, checkoutId, receipt } = req.body || {};
  try {
    if (!await requireUser(req, res, uid)) return;
    if (!Number.isFinite(amount(value)) || amount(value) <= 0) return res.status(400).json({ error: 'A positive amount is required' });
    const { rows } = await query('INSERT INTO deposits (id,user_id,amount,method,status,phone,checkout_id,receipt) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [makeId('deposit', uid), uid, value, method || null, status, phone || null, checkoutId || null, receipt || null]);
    return res.status(201).json({ success: true, deposit: rows[0] });
  } catch (error) { console.error('[pg] create deposit failed', error); return res.status(500).json({ error: 'Server error' }); }
}
export async function createWithdrawal(req, res) {
  const { uid, amount: value, method, account, status = 'pending' } = req.body || {};
  try {
    if (!await requireUser(req, res, uid)) return;
    if (!Number.isFinite(amount(value)) || amount(value) <= 0) return res.status(400).json({ error: 'A positive amount is required' });
    const { rows } = await query('INSERT INTO withdrawals (id,user_id,amount,method,account,status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [makeId('withdrawal', uid), uid, value, method || null, account || null, status]);
    return res.status(201).json({ success: true, withdrawal: rows[0] });
  } catch (error) { console.error('[pg] create withdrawal failed', error); return res.status(500).json({ error: 'Server error' }); }
}
export async function createInvestment(req, res) {
  const { uid, amount: value, plan, dailyRate, status = 'active', maturityDate } = req.body || {};
  try {
    if (!await requireUser(req, res, uid)) return;
    if (!Number.isFinite(amount(value)) || amount(value) <= 0) return res.status(400).json({ error: 'A positive amount is required' });
    const { rows } = await query('INSERT INTO investments (id,user_id,plan,amount,daily_rate,status,maturity_date) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [makeId('investment', uid), uid, plan || null, value, dailyRate || null, status, maturityDate || null]);
    return res.status(201).json({ success: true, investment: rows[0] });
  } catch (error) { console.error('[pg] create investment failed', error); return res.status(500).json({ error: 'Server error' }); }
}
export async function createLoan(req, res) {
  const { uid, amount: value, rate, interestRate, status = 'pending', dueDate, penalty = 0 } = req.body || {};
  try {
    if (!await requireUser(req, res, uid)) return;
    if (!Number.isFinite(amount(value)) || amount(value) <= 0) return res.status(400).json({ error: 'A positive amount is required' });
    const { rows } = await query('INSERT INTO loans (id,user_id,amount,interest_rate,status,due_date,penalty) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [makeId('loan', uid), uid, value, interestRate || rate || null, status, dueDate || null, penalty]);
    return res.status(201).json({ success: true, loan: rows[0] });
  } catch (error) { console.error('[pg] create loan failed', error); return res.status(500).json({ error: 'Server error' }); }
}
