CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY, value JSONB, updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS admin_activity (
  id SERIAL PRIMARY KEY, admin_id TEXT, action TEXT, target_user TEXT, meta JSONB, created_at TIMESTAMPTZ DEFAULT NOW()
);
