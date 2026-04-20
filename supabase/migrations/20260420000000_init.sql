-- users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 1000000,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS on users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can only select their own profile
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Allow inserts during signup
CREATE POLICY "Users can insert their own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- payment_requests table
CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMP NOT NULL,
  scheduled_payment_date TIMESTAMP,
  expired INTEGER NOT NULL DEFAULT 0,
  repeated INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for payment_requests
CREATE INDEX idx_payment_requests_sender_id_status ON payment_requests(sender_id, status);
CREATE INDEX idx_payment_requests_recipient_id_status ON payment_requests(recipient_id, status);
CREATE INDEX idx_payment_requests_expires_at ON payment_requests(expires_at);
CREATE INDEX idx_payment_requests_scheduled_payment_date ON payment_requests(scheduled_payment_date);

-- Enable RLS on payment_requests
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

-- Users can view requests where they are sender or recipient
CREATE POLICY "Users can view their requests" ON payment_requests
  FOR SELECT USING (
    auth.uid() = sender_id OR
    auth.uid() = recipient_id OR
    auth.email() = recipient_email
  );

-- payment_transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES payment_requests(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  transaction_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS on payment_transactions
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their transactions
CREATE POLICY "Users can view their transactions" ON payment_transactions
  FOR SELECT USING (
    auth.uid() = from_user_id OR
    auth.uid() = to_user_id
  );

-- Trigger to auto-populate recipient_id when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE payment_requests
  SET recipient_id = NEW.id, updated_at = NOW()
  WHERE recipient_email = NEW.email
    AND recipient_id IS NULL
    AND status IN (1, 5);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user();
