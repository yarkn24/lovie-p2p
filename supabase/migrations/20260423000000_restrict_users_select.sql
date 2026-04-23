-- H4: Restrict users SELECT to own row.
--
-- Prior policies allowed any authenticated session to read every row in
-- public.users, including the `balance` column — an information-disclosure
-- bug. All cross-user reads in the app go through the service-role admin
-- client, so tightening this policy to own-row only has no app-layer impact
-- (see M4 fix for cron/execute-scheduled which was the last session-client
-- cross-user read).

DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.users;
DROP POLICY IF EXISTS "users_select_authenticated" ON public.users;
DROP POLICY IF EXISTS "users_select_own" ON public.users;

CREATE POLICY "users_select_own" ON public.users
  FOR SELECT
  USING (auth.uid() = id);
