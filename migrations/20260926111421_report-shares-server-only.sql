-- Tighten FR10: the doctor's door is opened by the server, never by the anon role directly.
-- `anon` and `authenticated` now have no route at all to report_shares' sealed blobs; the public
-- /r/[token] page validates the token, hashes it server-side and calls this with the admin key
-- (same arrangement as claim_due_reminders). The function stays the single atomic
-- "is this link live? count the view, return the sealed blob" step.
REVOKE ALL ON FUNCTION public.open_report_share(text) FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.open_report_share(text) SET search_path = '';
CREATE OR REPLACE FUNCTION public.open_report_share(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
REVOKE ALL ON FUNCTION public.open_report_share(text) FROM PUBLIC, anon, authenticated;
