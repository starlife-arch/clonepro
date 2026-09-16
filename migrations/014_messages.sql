CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT,
  receiver_id TEXT,
  content TEXT,
  type TEXT DEFAULT 'text',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS messages_sender_idx ON messages(sender_id);
CREATE INDEX IF NOT EXISTS messages_receiver_idx ON messages(receiver_id);

CREATE TABLE IF NOT EXISTS gifts (
  id TEXT PRIMARY KEY,
  sender_id TEXT,
  receiver_id TEXT,
  gift_type TEXT,
  amount NUMERIC(20,8),
  message TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
