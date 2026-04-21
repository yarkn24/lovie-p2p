-- Prevent clients from tampering with immutable columns during UPDATE.
-- RLS WITH CHECK only constrains final-row predicates, not which columns changed.
-- Service role bypasses (for legitimate app operations like pay that mutate balance).

CREATE OR REPLACE FUNCTION public.enforce_payment_request_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.sender_id       IS DISTINCT FROM OLD.sender_id
  OR NEW.recipient_email IS DISTINCT FROM OLD.recipient_email
  OR NEW.amount          IS DISTINCT FROM OLD.amount
  OR NEW.created_at      IS DISTINCT FROM OLD.created_at
  OR NEW.note            IS DISTINCT FROM OLD.note THEN
    RAISE EXCEPTION 'Immutable column changed on payment_requests';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_payment_request_immutable_trg ON public.payment_requests;
CREATE TRIGGER enforce_payment_request_immutable_trg
  BEFORE UPDATE ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_payment_request_immutable();
