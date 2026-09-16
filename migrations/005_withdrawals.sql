CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), amount NUMERIC(20,8), method TEXT, account TEXT, status TEXT DEFAULT 'pending', approved_by TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
