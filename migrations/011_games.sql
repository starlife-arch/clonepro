CREATE TABLE IF NOT EXISTS game_sessions (
  id TEXT PRIMARY KEY, type TEXT, user_id TEXT REFERENCES users(id), bet NUMERIC(20,8), payout NUMERIC(20,8), result JSONB, status TEXT DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS game_pools (
  id TEXT PRIMARY KEY, type TEXT, total NUMERIC(20,8) DEFAULT 0, updated_at TIMESTAMPTZ DEFAULT NOW()
);
