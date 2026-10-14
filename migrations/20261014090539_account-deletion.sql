-- DPDP right to erasure: delete an account and everything that cascades from it.
--
-- Every app table references auth.users ON DELETE CASCADE, so removing the user row removes their
-- plans, screenings, safety plan, companion history, check-ins, reports, buddy links and grants.
-- Community content has no user id by design; the server erases it by anonymous key BEFORE calling
-- this (lib/privacy-server.ts). Leftover one-time sign-in codes are keyed by email, so they go too.
--
-- Retained by law, and disclosed on the privacy page: InsForge's payments.* ledger (financial
-- records). It holds no health data.
--
-- Server-only (admin client after the user re-confirms); no client role can execute it.
CREATE OR REPLACE FUNCTION public.delete_user_account(p_user uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = p_user;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  DELETE FROM auth.email_otps WHERE lower(email) = lower(v_email);
  DELETE FROM auth.users WHERE id = p_user;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_user_account(uuid) FROM PUBLIC, anon, authenticated;
