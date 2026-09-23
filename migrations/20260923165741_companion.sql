-- FR2 "Talk to Lull": encrypted chat history, append-only, deletable by the user (memory control).
CREATE TABLE public.companion_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content_enc text NOT NULL CHECK (content_enc LIKE 'v1:%' AND char_length(content_enc) <= 12000),
  -- true when the safety layer classified this turn as a crisis handoff
  risk boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX companion_messages_user_created_idx ON public.companion_messages (user_id, created_at DESC);

ALTER TABLE public.companion_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.companion_messages FROM anon;
REVOKE UPDATE ON public.companion_messages FROM authenticated;
GRANT SELECT, INSERT, DELETE ON public.companion_messages TO authenticated;
CREATE POLICY companion_messages_own ON public.companion_messages FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

ALTER TABLE public.ai_usage DROP CONSTRAINT ai_usage_kind_check;
ALTER TABLE public.ai_usage ADD CONSTRAINT ai_usage_kind_check
  CHECK (kind IN ('extract', 'plan', 'replan', 'insight', 'screener', 'companion'));
