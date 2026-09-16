import { getDb } from './_lib/firebase.js';
import { query } from './_lib/postgres.js';

const BATCH_SIZE = 500;
const BATCH_DELAY_MS = 2000;
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const value = (data, ...keys) => keys.map((key) => data[key]).find((item) => item !== undefined) ?? null;
const timestamp = (input) => {
  if (!input) return null;
  if (input instanceof Date) return input;
  if (typeof input.toDate === 'function') return input.toDate();
  if (typeof input === 'object' && typeof input.seconds === 'number') return new Date(input.seconds * 1000);
  return input;
};
const json = (input) => input === undefined ? null : JSON.stringify(input);

async function insert(table, columns, values) {
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
  await query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, values);
}

async function insertUnkeyed(table, columns, values) {
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
  const equality = columns.map((column, index) => `${column} IS NOT DISTINCT FROM $${index + 1}`).join(' AND ');
  await query(`INSERT INTO ${table} (${columns.join(', ')}) SELECT ${placeholders} WHERE NOT EXISTS (SELECT 1 FROM ${table} WHERE ${equality}) ON CONFLICT DO NOTHING`, values);
}

async function processBatches(reference, collection, migrateDocument) {
  let lastDoc = null;
  let totalMigrated = 0;

  while (true) {
    let request = reference.orderBy('__name__').limit(BATCH_SIZE);
    if (lastDoc) request = request.startAfter(lastDoc);
    const snapshot = await request.get();
    if (snapshot.empty) break;

    for (const document of snapshot.docs) {
      await migrateDocument({ id: document.id, ...document.data() }, document);
    }

    lastDoc = snapshot.docs.at(-1);
    totalMigrated += snapshot.size;
    console.log(`[migration] ${collection}: ${totalMigrated} so far`);
    await wait(BATCH_DELAY_MS);
  }

  console.log(`[migration] ${collection}: complete (${totalMigrated})`);
  return totalMigrated;
}

async function migrateUsers(report, db) {
  report.users = await processBatches(db.collection('users'), 'users', async (record) => {
    const email = value(record, 'email') || `${record.id}@firestore-migrated.invalid`;
    await insert('users', ['id', 'email', 'name', 'phone', 'referral_code', 'referred_by', 'role', 'status', 'kyc_status', 'kyc_rejection_reason', 'country', 'created_at', 'updated_at'], [record.id, email, value(record, 'name', 'displayName'), value(record, 'phone', 'phoneNumber'), value(record, 'referralCode'), value(record, 'referredBy'), value(record, 'role') || 'user', value(record, 'status') || 'active', value(record, 'kycStatus') || 'none', value(record, 'kycRejectionReason'), value(record, 'country'), timestamp(value(record, 'createdAt')), timestamp(value(record, 'updatedAt'))]);
    await insert('wallets', ['user_id', 'balance', 'game_balance', 'held_balance', 'total_deposited', 'total_withdrawn', 'total_earned', 'updated_at'], [record.id, value(record, 'balance', 'walletBalance') || 0, value(record, 'gameBalance') || 0, value(record, 'heldBalance') || 0, value(record, 'totalDeposited') || 0, value(record, 'totalWithdrawn') || 0, value(record, 'totalEarned') || 0, timestamp(value(record, 'updatedAt'))]);
  });
}

const keyedMigrations = [
  ['deposits', 'deposits', ['user_id', 'amount', 'amount_kes', 'method', 'status', 'receipt', 'checkout_id', 'phone', 'approved_by', 'created_at', 'updated_at'], (r) => [value(r, 'userId'), value(r, 'amount') || 0, value(r, 'amountKes') || 0, value(r, 'method'), value(r, 'status') || 'pending', value(r, 'receipt'), value(r, 'checkoutId'), value(r, 'phone'), value(r, 'approvedBy'), timestamp(value(r, 'createdAt')), timestamp(value(r, 'updatedAt'))]],
  ['withdrawals', 'withdrawals', ['user_id', 'amount', 'method', 'account', 'status', 'approved_by', 'created_at', 'updated_at'], (r) => [value(r, 'userId'), value(r, 'amount') || 0, value(r, 'method'), value(r, 'account', 'phone'), value(r, 'status') || 'pending', value(r, 'approvedBy'), timestamp(value(r, 'createdAt')), timestamp(value(r, 'updatedAt'))]],
  ['investments', 'investments', ['user_id', 'plan', 'amount', 'daily_rate', 'status', 'total_earned', 'maturity_date', 'created_at', 'updated_at'], (r) => [value(r, 'userId'), value(r, 'plan', 'planName'), value(r, 'amount') || 0, value(r, 'dailyRate') || 0, value(r, 'status') || 'active', value(r, 'totalEarned') || 0, timestamp(value(r, 'maturityDate')), timestamp(value(r, 'createdAt')), timestamp(value(r, 'updatedAt'))]],
  ['loans', 'loans', ['user_id', 'amount', 'interest_rate', 'status', 'due_date', 'paid_amount', 'penalty', 'created_at', 'updated_at'], (r) => [value(r, 'userId'), value(r, 'amount') || 0, value(r, 'interestRate') || 0, value(r, 'status') || 'pending', timestamp(value(r, 'dueDate')), value(r, 'paidAmount') || 0, value(r, 'penalty') || 0, timestamp(value(r, 'createdAt')), timestamp(value(r, 'updatedAt'))]],
  ['stakes', 'stakes', ['user_id', 'plan', 'amount', 'status', 'total_earned', 'created_at', 'updated_at'], (r) => [value(r, 'userId'), value(r, 'plan'), value(r, 'amount') || 0, value(r, 'status') || 'active', value(r, 'totalEarned') || 0, timestamp(value(r, 'createdAt')), timestamp(value(r, 'updatedAt'))]],
  ['savings', 'savings', ['user_id', 'amount', 'status', 'created_at', 'updated_at'], (r) => [value(r, 'userId'), value(r, 'amount') || 0, value(r, 'status') || 'active', timestamp(value(r, 'createdAt')), timestamp(value(r, 'updatedAt'))]],
  ['gameSessions', 'game_sessions', ['type', 'user_id', 'bet', 'payout', 'result', 'status', 'created_at'], (r) => [value(r, 'type', 'gameType'), value(r, 'userId'), value(r, 'bet', 'amount') || 0, value(r, 'payout') || 0, json(value(r, 'result')), value(r, 'status') || 'active', timestamp(value(r, 'createdAt'))]],
  ['gamePools', 'game_pools', ['type', 'total', 'updated_at'], (r) => [value(r, 'type', 'gameType'), value(r, 'total') || 0, timestamp(value(r, 'updatedAt'))]]
];

async function migrateKeyed(definition, report, db) {
  const [collection, table, columns, mapper] = definition;
  const count = await processBatches(db.collection(collection), collection, (record) => insert(table, ['id', ...columns], [record.id, ...mapper(record)]));
  if (Object.hasOwn(report, table)) report[table] = count;
}

async function migrateActivity(report, db) {
  report.activity = await processBatches(db.collection('activity'), 'activity', (record) => insertUnkeyed('activity', ['user_id', 'type', 'description', 'amount', 'meta', 'created_at'], [value(record, 'userId'), value(record, 'type'), value(record, 'description'), value(record, 'amount'), json(value(record, 'meta')), timestamp(value(record, 'createdAt'))]));
}

async function migrateNotifications(db) {
  await processBatches(db.collection('notifications'), 'notifications', (record) => insertUnkeyed('notifications', ['user_id', 'title', 'body', 'type', 'read', 'created_at'], [value(record, 'userId'), value(record, 'title'), value(record, 'body', 'message'), value(record, 'type'), value(record, 'read') || false, timestamp(value(record, 'createdAt'))]));
}

async function migrateSupportTickets(db) {
  await processBatches(db.collection('supportTickets'), 'supportTickets', async (ticket) => {
    await insert('support_tickets', ['id', 'user_id', 'subject', 'status', 'created_at', 'updated_at'], [ticket.id, value(ticket, 'userId'), value(ticket, 'subject'), value(ticket, 'status') || 'open', timestamp(value(ticket, 'createdAt')), timestamp(value(ticket, 'updatedAt'))]);
    for (const message of value(ticket, 'messages') || []) await insertUnkeyed('support_messages', ['ticket_id', 'sender_id', 'message', 'created_at'], [ticket.id, value(message, 'senderId', 'userId'), value(message, 'message', 'text'), timestamp(value(message, 'createdAt'))]);
    await processBatches(db.collection('supportTickets').doc(ticket.id).collection('messages'), `supportTickets/${ticket.id}/messages`, (message) => insertUnkeyed('support_messages', ['ticket_id', 'sender_id', 'message', 'created_at'], [ticket.id, value(message, 'senderId', 'userId'), value(message, 'message', 'text'), timestamp(value(message, 'createdAt'))]));
  });
}

async function migrateSettings(db) {
  await processBatches(db.collection('settings'), 'settings', (record) => insert('admin_settings', ['key', 'value', 'updated_at'], [record.id, json(record), timestamp(value(record, 'updatedAt'))]));
}

const collectionMigrations = new Map([
  ['users', migrateUsers],
  ...keyedMigrations.map((definition) => [definition[0], (report, db) => migrateKeyed(definition, report, db)]),
  ['activity', migrateActivity],
  ['notifications', (_report, db) => migrateNotifications(db)],
  ['supportTickets', (_report, db) => migrateSupportTickets(db)],
  ['settings', (_report, db) => migrateSettings(db)]
]);
const migrationOrder = ['users', 'deposits', 'withdrawals', 'investments', 'loans', 'activity', 'notifications', 'supportTickets', 'stakes', 'savings', 'gameSessions', 'gamePools', 'settings'];

async function runMigration(requestedCollection) {
  const report = { users: 0, walletTotals: { balance: '0', gameBalance: '0', heldBalance: '0' }, deposits: 0, withdrawals: 0, investments: 0, loans: 0, activity: 0 };
  const collections = requestedCollection ? [requestedCollection] : migrationOrder;
  const db = getDb();

  for (const collection of collections) await collectionMigrations.get(collection)(report, db);

  const { rows: [wallet] } = await query('SELECT COALESCE(SUM(balance), 0) AS balance, COALESCE(SUM(game_balance), 0) AS "gameBalance", COALESCE(SUM(held_balance), 0) AS "heldBalance" FROM wallets');
  report.walletTotals = wallet;
  console.log('[migration] final reconciliation report', report);
  return report;
}

export default function migrateFromFirestore(req, res) {
  if (!process.env.MIGRATION_SECRET || req.get('x-migration-secret') !== process.env.MIGRATION_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  const requestedCollection = req.body?.collection;
  if (requestedCollection && !collectionMigrations.has(requestedCollection)) return res.status(400).json({ error: 'Unknown collection', collection: requestedCollection });

  res.status(200).json({ status: 'started', message: 'Migration running in background' });
  setImmediate(() => {
    console.log(`[migration] started${requestedCollection ? `: ${requestedCollection}` : ''}`);
    runMigration(requestedCollection).catch((error) => console.error('[migration] failed', error));
  });
}
