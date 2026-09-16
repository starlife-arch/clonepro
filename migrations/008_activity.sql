CREATE TABLE IF NOT EXISTS activity (
  id SERIAL PRIMARY KEY, user_id TEXT REFERENCES users(id), type TEXT, description TEXT, amount NUMERIC(20,8), meta JSONB, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS activity_user_idx ON activity(user_id);
CREATE INDEX IF NOT EXISTS activity_created_idx ON activity(created_at DESC);
