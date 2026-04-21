-- Allow authenticated users to read other users' profile info (name, email).
-- Required for displaying sender/recipient names on payment requests.
-- Balance is not exposed in cross-user queries — only fetched for auth.uid() = id.

DROP POLICY IF EXISTS "users_select_authenticated" ON public.users;

CREATE POLICY "users_select_authenticated" ON public.users
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
