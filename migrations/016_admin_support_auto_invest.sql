-- Admin support sessions and auto-invest controls.
-- Global pause is an override; individual preferences remain unchanged.
CREATE TABLE IF NOT EXISTS admin_support_sessions (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES users(id),
  target_user_id TEXT NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended','expired')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  ended_by TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS admin_support_sessions_admin_idx ON admin_support_sessions(admin_id, started_at DESC);
CREATE INDEX IF NOT EXISTS admin_support_sessions_target_idx ON admin_support_sessions(target_user_id, started_at DESC);
CREATE TABLE IF NOT EXISTS user_auto_invest_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT REFERENCES users(id)
);
INSERT INTO admin_settings (key, value) VALUES ('auto_invest_global_disabled', 'false'::jsonb) ON CONFLICT (key) DO NOTHING;
