-- FR1 screening results. Answers, scores, tier and reasons live in one AES-256-GCM blob.
-- Only timing is plaintext: taken_at (re-screen cadence) and followup_due (next-day crisis check-in).
CREATE TABLE public.screener_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  results_enc text NOT NULL CHECK (results_enc LIKE 'v1:%' AND char_length(results_enc) <= 8000),
  followup_due timestamptz,
  taken_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX screener_results_user_taken_idx ON public.screener_results (user_id, taken_at DESC);

ALTER TABLE public.screener_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.screener_results FROM anon;
REVOKE UPDATE ON public.screener_results FROM authenticated;
GRANT SELECT, INSERT, DELETE ON public.screener_results TO authenticated;
CREATE POLICY screener_results_own ON public.screener_results FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- Content-free rate-limit ledger learns the new kind.
ALTER TABLE public.ai_usage DROP CONSTRAINT ai_usage_kind_check;
ALTER TABLE public.ai_usage ADD CONSTRAINT ai_usage_kind_check CHECK (kind IN ('extract', 'plan', 'replan', 'insight', 'screener'));
