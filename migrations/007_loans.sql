CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), amount NUMERIC(20,8), interest_rate NUMERIC(10,4), status TEXT DEFAULT 'pending', due_date TIMESTAMPTZ, paid_amount NUMERIC(20,8) DEFAULT 0, penalty NUMERIC(20,8) DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
