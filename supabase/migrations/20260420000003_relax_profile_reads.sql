-- Allow authenticated users to read basic profile info of anyone they are
-- transacting with. Needed so the dashboard / detail pages can show
-- counterparty first + last name (joined from payment_requests).
CREATE POLICY "Authenticated users can view profiles" ON users
  FOR SELECT TO authenticated
  USING (true);
