-- Add phone as optional secondary contact on users and payment_requests.
-- Email remains the primary (required) identifier; phone is optional.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS recipient_phone TEXT;
