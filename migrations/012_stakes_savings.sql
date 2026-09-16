CREATE TABLE IF NOT EXISTS stakes (
  id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), plan TEXT, amount NUMERIC(20,8), status TEXT DEFAULT 'active', total_earned NUMERIC(20,8) DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS savings (
  id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), amount NUMERIC(20,8), status TEXT DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
