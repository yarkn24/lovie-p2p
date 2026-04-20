-- C5 fix (cont): remove the unrestricted update policy that was added
-- outside of tracked migrations. Its WITH CHECK is NULL which defaults
-- to the USING clause, meaning any sender/recipient could set ANY column
-- (including status=2 "paid") on their own requests — bypassing all the
-- restrictive policies added in migration 0004.
--
-- The 4 specific policies in 0004 (decline/schedule/cancel/expire) are
-- the correct replacements.

DROP POLICY IF EXISTS "requests_update" ON payment_requests;
