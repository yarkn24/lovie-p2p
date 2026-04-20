-- execute_payment RPC
CREATE OR REPLACE FUNCTION execute_payment(
  p_request_id UUID,
  p_from_user_id UUID,
  p_to_user_id UUID,
  p_amount INTEGER
) RETURNS void AS $$
BEGIN
  -- Deduct from sender
  UPDATE users SET balance = balance - p_amount WHERE id = p_from_user_id;

  -- Add to recipient
  UPDATE users SET balance = balance + p_amount WHERE id = p_to_user_id;

  -- Create transaction record
  INSERT INTO payment_transactions (request_id, from_user_id, to_user_id, amount, transaction_type, status)
  VALUES (p_request_id, p_from_user_id, p_to_user_id, p_amount, 'manual_pay', 'success');

  -- Update request status to paid
  UPDATE payment_requests SET status = 2, updated_at = NOW() WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- repeat_payment_request RPC
CREATE OR REPLACE FUNCTION repeat_payment_request(p_request_id UUID)
RETURNS UUID AS $$
DECLARE
  v_original_request payment_requests%ROWTYPE;
  v_new_request_id UUID;
BEGIN
  SELECT * INTO v_original_request FROM payment_requests WHERE id = p_request_id;

  IF v_original_request.status != 3 THEN
    RAISE EXCEPTION 'Can only repeat declined requests';
  END IF;

  IF v_original_request.repeated = 1 THEN
    RAISE EXCEPTION 'Request already repeated once';
  END IF;

  -- Create new request
  INSERT INTO payment_requests (sender_id, recipient_id, recipient_email, amount, status, expires_at, note)
  VALUES (
    v_original_request.sender_id,
    v_original_request.recipient_id,
    v_original_request.recipient_email,
    v_original_request.amount,
    1,
    NOW() + INTERVAL '7 days',
    v_original_request.note
  )
  RETURNING id INTO v_new_request_id;

  -- Mark original as repeated
  UPDATE payment_requests SET repeated = 1, updated_at = NOW() WHERE id = p_request_id;

  RETURN v_new_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- expire_pending_requests RPC
CREATE OR REPLACE FUNCTION expire_pending_requests()
RETURNS void AS $$
BEGIN
  UPDATE payment_requests
  SET status = 4, expired = 1, updated_at = NOW()
  WHERE status IN (1, 5)
    AND expired = 0
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- execute_scheduled_payments RPC
CREATE OR REPLACE FUNCTION execute_scheduled_payments()
RETURNS void AS $$
DECLARE
  v_request payment_requests%ROWTYPE;
  v_sender_balance INTEGER;
BEGIN
  FOR v_request IN SELECT * FROM payment_requests WHERE status = 5 AND scheduled_payment_date <= NOW()
  LOOP
    -- Get sender balance
    SELECT balance INTO v_sender_balance FROM users WHERE id = v_request.sender_id;

    IF v_sender_balance >= v_request.amount THEN
      -- Execute payment
      UPDATE users SET balance = balance - v_request.amount WHERE id = v_request.sender_id;
      UPDATE users SET balance = balance + v_request.amount WHERE id = v_request.recipient_id;

      INSERT INTO payment_transactions (request_id, from_user_id, to_user_id, amount, transaction_type, status)
      VALUES (v_request.id, v_request.sender_id, v_request.recipient_id, v_request.amount, 'scheduled', 'success');

      UPDATE payment_requests SET status = 2, updated_at = NOW() WHERE id = v_request.id;
    ELSE
      -- Mark as failed
      UPDATE payment_requests SET status = 7, updated_at = NOW() WHERE id = v_request.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
