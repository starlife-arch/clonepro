CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT, phone TEXT, referral_code TEXT, referred_by TEXT, role TEXT DEFAULT 'user', status TEXT DEFAULT 'active', kyc_status TEXT DEFAULT 'none', kyc_rejection_reason TEXT, country TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
