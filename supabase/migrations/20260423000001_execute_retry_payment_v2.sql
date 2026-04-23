-- H1: Atomic retry payment RPC.
--
-- Mirrors execute_payment_v2 but accepts status=7 (failed) instead of 1
-- (pending). Retries come from a scheduled payment that already failed
-- INSUFFICIENT_BALANCE — the recipient tops up and hits "Pay now" on the
-- failed request. The prior implementation did a 4-step admin-client
-- sequence (select balance, update payer, update sender, insert txn,
-- flip status) with no FOR UPDATE lock and no transactional boundary —
-- partial-failure states were possible. This RPC eliminates that window.

CREATE OR REPLACE FUNCTION public.execute_retry_payment_v2(
  p_request_id uuid,
  p_payer_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req payment_requests%ROWTYPE;
  v_payer_balance integer;
BEGIN
  SELECT * INTO v_req FROM payment_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_req.status <> 7 THEN
    RAISE EXCEPTION 'INVALID_STATUS: %', v_req.status USING ERRCODE = 'P0001';
  END IF;

  IF v_req.expired = 1 OR v_req.expires_at < NOW() THEN
    RAISE EXCEPTION 'REQUEST_EXPIRED' USING ERRCODE = 'P0001';
  END IF;

  IF v_req.recipient_id <> p_payer_id
     AND NOT EXISTS (SELECT 1 FROM users WHERE id = p_payer_id AND email = v_req.recipient_email) THEN
    RAISE EXCEPTION 'FORBIDDEN_NOT_RECIPIENT' USING ERRCODE = 'P0001';
  END IF;

  SELECT balance INTO v_payer_balance FROM users WHERE id = p_payer_id FOR UPDATE;
  IF v_payer_balance IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_payer_balance < v_req.amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE' USING ERRCODE = 'P0001';
  END IF;

  UPDATE users SET balance = balance - v_req.amount, updated_at = NOW() WHERE id = p_payer_id;
  UPDATE users SET balance = balance + v_req.amount, updated_at = NOW() WHERE id = v_req.sender_id;

  INSERT INTO payment_transactions (request_id, from_user_id, to_user_id, amount, transaction_type, status, paid_at)
  VALUES (p_request_id, p_payer_id, v_req.sender_id, v_req.amount, 'retry_pay', 'success', NOW());

  UPDATE payment_requests SET status = 2, failure_reason = NULL, updated_at = NOW() WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'request_id', p_request_id,
    'status', 2,
    'amount', v_req.amount,
    'sender_id', v_req.sender_id,
    'payer_id', p_payer_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_retry_payment_v2(uuid, uuid) TO service_role, authenticated;
