-- Lull core schema: mood check-ins, completed practice sessions, AI-composed sessions.

CREATE TABLE public.mood_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  mood smallint NOT NULL CHECK (mood BETWEEN 1 AND 5),
  energy smallint NOT NULL CHECK (energy BETWEEN 1 AND 5),
  tags text[] NOT NULL DEFAULT '{}' CHECK (cardinality(tags) <= 8),
  note text CHECK (char_length(note) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mood_checkins_user_created_idx ON public.mood_checkins (user_id, created_at DESC);

CREATE TABLE public.practice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('breathe', 'soundscape', 'composed', 'sleep')),
  title text NOT NULL CHECK (char_length(title) <= 120),
  duration_sec integer NOT NULL CHECK (duration_sec BETWEEN 1 AND 86400),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX practice_sessions_user_created_idx ON public.practice_sessions (user_id, created_at DESC);

CREATE TABLE public.composed_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt text NOT NULL CHECK (char_length(prompt) <= 600),
  title text NOT NULL CHECK (char_length(title) <= 120),
  plan jsonb NOT NULL CHECK (pg_column_size(plan) <= 16000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX composed_sessions_user_created_idx ON public.composed_sessions (user_id, created_at DESC);

ALTER TABLE public.mood_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.composed_sessions ENABLE ROW LEVEL SECURITY;

-- Rows are append-only history owned by the user: read, insert, delete. No updates.
REVOKE ALL ON public.mood_checkins, public.practice_sessions, public.composed_sessions FROM anon;
REVOKE UPDATE ON public.mood_checkins, public.practice_sessions, public.composed_sessions FROM authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.mood_checkins, public.practice_sessions, public.composed_sessions TO authenticated;

CREATE POLICY mood_select_own ON public.mood_checkins FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY mood_insert_own ON public.mood_checkins FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY mood_delete_own ON public.mood_checkins FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY practice_select_own ON public.practice_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY practice_insert_own ON public.practice_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY practice_delete_own ON public.practice_sessions FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY composed_select_own ON public.composed_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY composed_insert_own ON public.composed_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY composed_delete_own ON public.composed_sessions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Dashboard aggregates in one round trip. SECURITY INVOKER, so RLS still scopes rows to the caller.
-- Streak = run of consecutive UTC days with practice, ending today or yesterday.
CREATE OR REPLACE FUNCTION public.my_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH days AS (
    SELECT DISTINCT (created_at AT TIME ZONE 'UTC')::date AS d
    FROM public.practice_sessions
    WHERE user_id = auth.uid()
  ),
  ranked AS (
    SELECT d, d + (row_number() OVER (ORDER BY d DESC))::int AS grp FROM days
  ),
  head AS (
    SELECT max(d) AS last_day, max(d) + 1 AS grp FROM days
  )
  SELECT jsonb_build_object(
    'total_minutes', coalesce((SELECT sum(duration_sec) FROM public.practice_sessions WHERE user_id = auth.uid()), 0) / 60,
    'session_count', (SELECT count(*) FROM public.practice_sessions WHERE user_id = auth.uid()),
    'checkin_count', (SELECT count(*) FROM public.mood_checkins WHERE user_id = auth.uid()),
    'streak', (
      SELECT CASE
        WHEN h.last_day IS NULL OR h.last_day < (now() AT TIME ZONE 'UTC')::date - 1 THEN 0
        ELSE (SELECT count(*) FROM ranked r WHERE r.grp = h.grp)
      END
      FROM head h
    )
  );
$$;

REVOKE ALL ON FUNCTION public.my_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_stats() TO authenticated;
