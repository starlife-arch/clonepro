CREATE TABLE IF NOT EXISTS ledger (
  id SERIAL PRIMARY KEY, user_id TEXT REFERENCES users(id), type TEXT NOT NULL, amount NUMERIC(20,8) NOT NULL, balance_after NUMERIC(20,8), description TEXT, ref_id TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
