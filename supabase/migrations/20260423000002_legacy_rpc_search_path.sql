-- D4: Add SET search_path = public, pg_temp to legacy SECURITY DEFINER
-- functions in migration 0004 that were missing it. The v2 RPCs
-- (execute_payment_v2, execute_retry_payment_v2) already have this guard;
-- these five functions did not. Prevents a search_path hijack where a
-- privileged function resolves an attacker-controlled schema's object
-- instead of the intended public one.

CREATE OR REPLACE FUNCTION public.adjust_balance(p_user_id UUID, p_delta INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.execute_scheduled_payments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.expire_single_request(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE payment_requests
    SET status = 4, expired = 1, updated_at = NOW()
    WHERE id = p_request_id
      AND status IN (1, 5)
      AND expired = 0
      AND expires_at < NOW();
END;
$$;

DROP FUNCTION IF EXISTS public.repeat_payment_request(UUID);
CREATE FUNCTION public.repeat_payment_request(p_request_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.adjust_balance(uuid, integer) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_scheduled_payments() TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_single_request(uuid) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.repeat_payment_request(uuid) TO service_role, authenticated;
