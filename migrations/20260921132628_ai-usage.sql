-- Content-free AI usage ledger for per-user rate limits (no prompts, no outputs, no PII).
CREATE TABLE public.ai_usage (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('extract', 'plan', 'replan', 'insight')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_usage_user_kind_idx ON public.ai_usage (user_id, kind, created_at DESC);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_usage FROM anon;
REVOKE UPDATE, DELETE ON public.ai_usage FROM authenticated;
GRANT SELECT, INSERT ON public.ai_usage TO authenticated;
CREATE POLICY ai_usage_own ON public.ai_usage FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
