CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), subject TEXT, status TEXT DEFAULT 'open', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS support_messages (
  id SERIAL PRIMARY KEY, ticket_id TEXT REFERENCES support_tickets(id), sender_id TEXT, message TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
