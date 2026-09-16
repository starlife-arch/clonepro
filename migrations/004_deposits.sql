CREATE TABLE IF NOT EXISTS deposits (
  id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), amount NUMERIC(20,8), amount_kes NUMERIC(20,2), method TEXT, status TEXT DEFAULT 'pending', receipt TEXT, checkout_id TEXT, phone TEXT, approved_by TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
