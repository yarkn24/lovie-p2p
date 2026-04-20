-- Add failure_reason column for status=7 (failed) transfers.
-- Pattern from Dwolla (failure object with code + description on failed ACH transfers).
-- Our only failure mode is INSUFFICIENT_BALANCE during scheduled execution.
ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- Update execute_scheduled_payments to record the failure reason
-- and clear it on successful retry.
CREATE OR REPLACE FUNCTION execute_scheduled_payments()
RETURNS void AS $$
DECLARE
  v_request payment_requests%ROWTYPE;
  v_payer_balance INTEGER;
BEGIN
  FOR v_request IN
    SELECT * FROM payment_requests
    WHERE status = 5 AND scheduled_payment_date <= NOW()
  LOOP
    -- In this model the recipient pays the sender (who requested the money).
    SELECT balance INTO v_payer_balance FROM users WHERE id = v_request.recipient_id;

    IF v_payer_balance >= v_request.amount THEN
      UPDATE users SET balance = balance - v_request.amount WHERE id = v_request.recipient_id;
      UPDATE users SET balance = balance + v_request.amount WHERE id = v_request.sender_id;

      INSERT INTO payment_transactions
        (request_id, from_user_id, to_user_id, amount, transaction_type, status, paid_at)
      VALUES
        (v_request.id, v_request.recipient_id, v_request.sender_id, v_request.amount,
         'scheduled_execution', 'success', NOW());

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

-- Update execute_payment to clear failure_reason on success
-- (relevant for retry: status=7 -> status=2)
CREATE OR REPLACE FUNCTION execute_payment(
  p_request_id UUID,
  p_from_user_id UUID,
  p_to_user_id UUID,
  p_amount INTEGER
) RETURNS void AS $$
BEGIN
  UPDATE users SET balance = balance - p_amount WHERE id = p_from_user_id;
  UPDATE users SET balance = balance + p_amount WHERE id = p_to_user_id;

  INSERT INTO payment_transactions
    (request_id, from_user_id, to_user_id, amount, transaction_type, status, paid_at)
  VALUES
    (p_request_id, p_from_user_id, p_to_user_id, p_amount, 'manual_pay', 'success', NOW());

  UPDATE payment_requests
    SET status = 2, failure_reason = NULL, updated_at = NOW()
    WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
