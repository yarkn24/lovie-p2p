-- ============================================================
-- Security fixes migration (idempotent)
-- Addresses C1-C6, H3-H5, H9-H10, M4, M5 from audit report
-- ============================================================

-- M4: TIMESTAMP → TIMESTAMPTZ (no-op if already TIMESTAMPTZ)
ALTER TABLE users
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE payment_requests
  ALTER COLUMN expires_at             TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC',
  ALTER COLUMN scheduled_payment_date TYPE TIMESTAMPTZ USING scheduled_payment_date AT TIME ZONE 'UTC',
  ALTER COLUMN created_at             TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at             TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE payment_transactions
  ALTER COLUMN paid_at    TYPE TIMESTAMPTZ USING paid_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- C3 / M5: Add constraints (idempotent via exception catch)
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT balance_non_negative CHECK (balance >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE payment_requests ADD CONSTRAINT status_valid CHECK (status IN (1, 2, 3, 4, 5, 6, 7));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- C2+C3: Atomic balance adjustment
-- ============================================================
CREATE OR REPLACE FUNCTION adjust_balance(p_user_id UUID, p_delta INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  UPDATE users
    SET balance = balance + p_delta, updated_at = NOW()
    WHERE id = p_user_id AND balance + p_delta >= 0
    RETURNING balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: balance would go negative';
  END IF;

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- C4+C6: Atomic execute_payment with row-level locking
-- ============================================================
CREATE OR REPLACE FUNCTION execute_payment(
  p_request_id   UUID,
  p_from_user_id UUID,
  p_to_user_id   UUID,
  p_amount       INTEGER
) RETURNS void AS $$
DECLARE
  v_status  INTEGER;
  v_balance INTEGER;
BEGIN
  SELECT status INTO v_status
    FROM payment_requests WHERE id = p_request_id FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND: payment request % does not exist', p_request_id;
  END IF;

  IF v_status != 1 THEN
    RAISE EXCEPTION 'INVALID_STATUS: expected 1 (pending), got %', v_status;
  END IF;

  SELECT balance INTO v_balance
    FROM users WHERE id = p_from_user_id FOR UPDATE;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: balance % < amount %', v_balance, p_amount;
  END IF;

  UPDATE users SET balance = balance - p_amount WHERE id = p_from_user_id;
  UPDATE users SET balance = balance + p_amount WHERE id = p_to_user_id;

  INSERT INTO payment_transactions
    (request_id, from_user_id, to_user_id, amount, transaction_type, status, paid_at)
    VALUES (p_request_id, p_from_user_id, p_to_user_id, p_amount, 'manual_pay', 'success', NOW());

  UPDATE payment_requests
    SET status = 2, failure_reason = NULL, updated_at = NOW()
    WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- H5: execute_scheduled_payments with SKIP LOCKED
-- ============================================================
CREATE OR REPLACE FUNCTION execute_scheduled_payments()
RETURNS void AS $$
DECLARE
  v_request      payment_requests%ROWTYPE;
  v_payer_balance INTEGER;
BEGIN
  FOR v_request IN
    SELECT * FROM payment_requests
      WHERE status = 5 AND scheduled_payment_date <= NOW()
      FOR UPDATE SKIP LOCKED
  LOOP
    SELECT balance INTO v_payer_balance
      FROM users WHERE id = v_request.recipient_id FOR UPDATE;

    IF v_payer_balance >= v_request.amount THEN
      UPDATE users SET balance = balance - v_request.amount WHERE id = v_request.recipient_id;
      UPDATE users SET balance = balance + v_request.amount WHERE id = v_request.sender_id;

      INSERT INTO payment_transactions
        (request_id, from_user_id, to_user_id, amount, transaction_type, status, paid_at)
        VALUES (v_request.id, v_request.recipient_id, v_request.sender_id,
                v_request.amount, 'scheduled_execution', 'success', NOW());

      UPDATE payment_requests
        SET status = 2, failure_reason = NULL, updated_at = NOW()
        WHERE id = v_request.id;
    ELSE
      UPDATE payment_requests
        SET status = 7, failure_reason = 'INSUFFICIENT_BALANCE', updated_at = NOW()
        WHERE id = v_request.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- H3: expire_single_request — safe single-row expiry
-- ============================================================
CREATE OR REPLACE FUNCTION expire_single_request(p_request_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE payment_requests
    SET status = 4, expired = 1, updated_at = NOW()
    WHERE id = p_request_id
      AND status IN (1, 5)
      AND expired = 0
      AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Fix repeat_payment_request to allow failed (status=7)
-- DROP first to avoid "cannot change return type" error
-- ============================================================
DROP FUNCTION IF EXISTS repeat_payment_request(UUID);
CREATE FUNCTION repeat_payment_request(p_request_id UUID)
RETURNS UUID AS $$
DECLARE
  v_req payment_requests%ROWTYPE;
  v_new_id UUID;
BEGIN
  SELECT * INTO v_req FROM payment_requests WHERE id = p_request_id FOR UPDATE;

  IF v_req.status NOT IN (3, 7) THEN
    RAISE EXCEPTION 'INVALID_STATUS: can only repeat declined (3) or failed (7) requests, got %', v_req.status;
  END IF;

  IF v_req.repeated = 1 THEN
    RAISE EXCEPTION 'ALREADY_REPEATED: this request has already been repeated once';
  END IF;

  INSERT INTO payment_requests
    (sender_id, recipient_id, recipient_email, amount, status, expires_at, note)
    VALUES (v_req.sender_id, v_req.recipient_id, v_req.recipient_email,
            v_req.amount, 1, NOW() + INTERVAL '7 days', v_req.note)
    RETURNING id INTO v_new_id;

  UPDATE payment_requests SET repeated = 1, updated_at = NOW() WHERE id = p_request_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- C5: RLS UPDATE policies for payment_requests (idempotent)
-- ============================================================
DROP POLICY IF EXISTS "Recipients can decline" ON payment_requests;
DROP POLICY IF EXISTS "Recipients can schedule" ON payment_requests;
DROP POLICY IF EXISTS "Senders can cancel" ON payment_requests;
DROP POLICY IF EXISTS "Participants can expire" ON payment_requests;
DROP POLICY IF EXISTS "No direct delete" ON payment_requests;

CREATE POLICY "Recipients can decline" ON payment_requests
  FOR UPDATE
  USING (auth.uid() = recipient_id OR auth.email() = recipient_email)
  WITH CHECK (
    status = 3 AND (auth.uid() = recipient_id OR auth.email() = recipient_email)
  );

CREATE POLICY "Recipients can schedule" ON payment_requests
  FOR UPDATE
  USING (auth.uid() = recipient_id OR auth.email() = recipient_email)
  WITH CHECK (
    status = 5 AND (auth.uid() = recipient_id OR auth.email() = recipient_email)
  );

CREATE POLICY "Senders can cancel" ON payment_requests
  FOR UPDATE
  USING (auth.uid() = sender_id)
  WITH CHECK (status = 6 AND auth.uid() = sender_id);

CREATE POLICY "Participants can expire" ON payment_requests
  FOR UPDATE
  USING (
    auth.uid() = sender_id OR
    auth.uid() = recipient_id OR
    auth.email() = recipient_email
  )
  WITH CHECK (status = 4 AND expired = 1);

CREATE POLICY "No direct delete" ON payment_requests
  FOR DELETE USING (false);
