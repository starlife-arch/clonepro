CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY, user_id TEXT REFERENCES users(id), balance NUMERIC(20,8) DEFAULT 0, game_balance NUMERIC(20,8) DEFAULT 0, held_balance NUMERIC(20,8) DEFAULT 0, total_deposited NUMERIC(20,8) DEFAULT 0, total_withdrawn NUMERIC(20,8) DEFAULT 0, total_earned NUMERIC(20,8) DEFAULT 0, updated_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(user_id)
);
