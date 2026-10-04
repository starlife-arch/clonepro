CREATE TABLE IF NOT EXISTS investments (
  id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), plan TEXT, amount NUMERIC(20,8), daily_rate NUMERIC(10,4), status TEXT DEFAULT 'active', total_earned NUMERIC(20,8) DEFAULT 0, maturity_date TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
