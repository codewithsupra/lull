-- FR10 patient-held doctor report: expiring, revocable share links.
--
-- The link token never reaches the database: only SHA-256(token) is stored, and the snapshot is
-- sealed (AES-256-GCM, `r1:` prefix) under a key derived from the token itself. See lib/report-crypto.ts.
-- A doctor has no account, so the only way in for `anon` is open_report_share(), which returns the
-- sealed blob solely for a live (unexpired, unrevoked) link and records the view.
CREATE TABLE public.report_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  report_enc text NOT NULL CHECK (report_enc LIKE 'r1:%' AND char_length(report_enc) <= 60000),
  sections text[] NOT NULL CHECK (cardinality(sections) BETWEEN 1 AND 6
    AND sections <@ ARRAY['screeners', 'adherence', 'mood', 'medications', 'questions', 'flags']),
  locale text NOT NULL CHECK (locale IN ('en', 'hi')),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Links are short-lived by design: at most 30 days (plus clock slack), never open-ended.
  expires_at timestamptz NOT NULL CHECK (expires_at > created_at AND expires_at <= created_at + interval '31 days'),
  revoked_at timestamptz,
  view_count integer NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  last_viewed_at timestamptz
);
CREATE INDEX report_shares_user_created_idx ON public.report_shares (user_id, created_at DESC);

ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.report_shares FROM anon;
REVOKE ALL ON public.report_shares FROM authenticated;
GRANT SELECT, DELETE ON public.report_shares TO authenticated;
-- Column-level: the owner can't choose created_at, view_count or revoked_at on insert, so the
-- 31-day expiry cap can't be dodged by back-dating, and a link can't be born "already viewed".
GRANT INSERT (token_hash, report_enc, sections, locale, expires_at) ON public.report_shares TO authenticated;
GRANT UPDATE (revoked_at) ON public.report_shares TO authenticated;
CREATE POLICY report_shares_own ON public.report_shares FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- Revocation is one-way: a turned-off link can never be turned back on, even by its owner.
CREATE OR REPLACE FUNCTION public.report_shares_revoke_once()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF OLD.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'share already revoked' USING ERRCODE = '22023';
  END IF;
  IF NEW.revoked_at IS NULL THEN
    RAISE EXCEPTION 'revoked_at must be set' USING ERRCODE = '22023';
  END IF;
  NEW.revoked_at := now(); -- server time, not whatever the client sent
  RETURN NEW;
END;
$$;
CREATE TRIGGER report_shares_revoke_once BEFORE UPDATE OF revoked_at ON public.report_shares
  FOR EACH ROW EXECUTE FUNCTION public.report_shares_revoke_once();
REVOKE ALL ON FUNCTION public.report_shares_revoke_once() FROM PUBLIC, anon, authenticated;

-- The doctor's door. SECURITY DEFINER because `anon` has no table access at all; it can only
-- present a token hash, and only ever gets back the sealed blob (useless without the token).
CREATE OR REPLACE FUNCTION public.open_report_share(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.report_shares%ROWTYPE;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN NULL;
  END IF;
  UPDATE public.report_shares
     SET view_count = view_count + 1, last_viewed_at = now()
   WHERE token_hash = p_token_hash
     AND revoked_at IS NULL
     AND expires_at > now()
  RETURNING * INTO r;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object('report_enc', r.report_enc, 'locale', r.locale, 'expires_at', r.expires_at);
END;
$$;
REVOKE ALL ON FUNCTION public.open_report_share(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_report_share(text) TO anon, authenticated;
