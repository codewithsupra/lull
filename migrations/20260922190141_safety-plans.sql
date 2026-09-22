-- FR3 safety plan: one encrypted plan per user (Stanley-Brown sections + chosen country).
CREATE TABLE public.safety_plans (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_enc text NOT NULL CHECK (plan_enc LIKE 'v1:%' AND char_length(plan_enc) <= 20000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.safety_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.safety_plans FROM anon;
REVOKE UPDATE ON public.safety_plans FROM authenticated;
GRANT SELECT, INSERT, DELETE ON public.safety_plans TO authenticated;
GRANT UPDATE (plan_enc, updated_at) ON public.safety_plans TO authenticated;
CREATE POLICY safety_plans_own ON public.safety_plans FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
