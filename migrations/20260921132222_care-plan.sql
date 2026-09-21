-- Care Plan: prescription/diagnosis → 4-week adaptive plan with XP.
-- Privacy model: no PII is stored. Health text (conditions, medications, task copy, doctor flags)
-- is AES-256-GCM encrypted by the app before insert (*_enc columns hold `v1:` ciphertext).

CREATE TABLE public.care_profiles (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_version text NOT NULL CHECK (char_length(consent_version) <= 20),
  consent_at timestamptz NOT NULL DEFAULT now(),
  timezone text NOT NULL DEFAULT 'UTC' CHECK (char_length(timezone) <= 64),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.care_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  condition_category text NOT NULL CHECK (condition_category IN ('anxiety', 'insomnia', 'stress', 'low_mood', 'adhd', 'other')),
  week_index smallint NOT NULL DEFAULT 1 CHECK (week_index BETWEEN 1 AND 4),
  started_at date NOT NULL,
  outline_enc text NOT NULL CHECK (outline_enc LIKE 'v1:%' AND char_length(outline_enc) <= 60000),
  flags_enc text CHECK (flags_enc LIKE 'v1:%' AND char_length(flags_enc) <= 8000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX care_plans_one_active_idx ON public.care_plans (user_id) WHERE status = 'active';

CREATE TABLE public.plan_medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.care_plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name_enc text NOT NULL CHECK (name_enc LIKE 'v1:%' AND char_length(name_enc) <= 1000),
  dose_enc text CHECK (dose_enc LIKE 'v1:%' AND char_length(dose_enc) <= 1000),
  instructions_enc text CHECK (instructions_enc LIKE 'v1:%' AND char_length(instructions_enc) <= 2000),
  times text[] NOT NULL DEFAULT '{}' CHECK (cardinality(times) <= 6),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX plan_medications_plan_idx ON public.plan_medications (plan_id);

CREATE TABLE public.plan_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.care_plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  week smallint NOT NULL CHECK (week BETWEEN 1 AND 4),
  day date NOT NULL,
  slot text NOT NULL CHECK (slot IN ('morning', 'afternoon', 'evening', 'night')),
  remind_at time,
  kind text NOT NULL CHECK (kind IN ('medication', 'habit', 'session', 'learn', 'reflect')),
  title_enc text NOT NULL CHECK (title_enc LIKE 'v1:%' AND char_length(title_enc) <= 1200),
  detail_enc text CHECK (detail_enc LIKE 'v1:%' AND char_length(detail_enc) <= 4000),
  -- Non-sensitive deep link into Lull features, e.g. breathe:478:5, sounds:night-rain, compose
  session_ref text CHECK (session_ref ~ '^(breathe:[a-z0-9]+:[0-9]{1,2}|sounds:[a-z-]+|compose)$'),
  xp smallint NOT NULL CHECK (xp BETWEEN 0 AND 100),
  sort smallint NOT NULL DEFAULT 0,
  completed_at timestamptz,
  reminded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX plan_tasks_user_day_idx ON public.plan_tasks (user_id, day);
CREATE INDEX plan_tasks_plan_week_idx ON public.plan_tasks (plan_id, week);
CREATE INDEX plan_tasks_due_idx ON public.plan_tasks (day, remind_at) WHERE completed_at IS NULL AND reminded_at IS NULL;

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE CHECK (endpoint LIKE 'https://%' AND char_length(endpoint) <= 1000),
  p256dh text NOT NULL CHECK (char_length(p256dh) <= 200),
  auth text NOT NULL CHECK (char_length(auth) <= 100),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions (user_id);

-- ---------- access control ----------
ALTER TABLE public.care_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.care_profiles, public.care_plans, public.plan_medications, public.plan_tasks, public.push_subscriptions FROM anon;
REVOKE UPDATE ON public.care_profiles, public.care_plans, public.plan_medications, public.plan_tasks, public.push_subscriptions FROM authenticated;
GRANT SELECT, INSERT, DELETE ON public.care_profiles, public.care_plans, public.plan_medications, public.plan_tasks, public.push_subscriptions TO authenticated;
-- Narrow column-level updates only where the product needs them.
GRANT UPDATE (consent_version, consent_at, timezone) ON public.care_profiles TO authenticated;
GRANT UPDATE (status, week_index, outline_enc, flags_enc) ON public.care_plans TO authenticated;

CREATE POLICY care_profiles_own ON public.care_profiles FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY care_plans_own ON public.care_plans FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY plan_medications_own ON public.plan_medications FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND plan_id IN (SELECT id FROM public.care_plans WHERE user_id = auth.uid()));
CREATE POLICY plan_tasks_own ON public.plan_tasks FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND plan_id IN (SELECT id FROM public.care_plans WHERE user_id = auth.uid()));
CREATE POLICY push_subscriptions_own ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---------- task completion ----------
-- The only way to change completed_at. Server-stamped time and ownership check stop XP back-dating.
CREATE OR REPLACE FUNCTION public.complete_task(p_task uuid, p_done boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.plan_tasks%ROWTYPE;
  remaining int;
BEGIN
  UPDATE public.plan_tasks
     SET completed_at = CASE WHEN p_done THEN coalesce(completed_at, now()) ELSE NULL END
   WHERE id = p_task
     AND user_id = auth.uid()
     AND day <= (now() AT TIME ZONE 'UTC')::date + 1
  RETURNING * INTO t;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'task not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*) INTO remaining FROM public.plan_tasks
   WHERE plan_id = t.plan_id AND day = t.day AND completed_at IS NULL;

  RETURN jsonb_build_object(
    'id', t.id,
    'done', t.completed_at IS NOT NULL,
    'xp', CASE WHEN p_done THEN t.xp ELSE -t.xp END,
    'day_complete', remaining = 0
  );
END;
$$;
REVOKE ALL ON FUNCTION public.complete_task(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_task(uuid, boolean) TO authenticated;

-- ---------- stats ----------
-- XP = completed task XP + 50 for every fully completed day. Streak = consecutive days (ending
-- today or yesterday in the caller's local calendar) with at least one completed task.
CREATE OR REPLACE FUNCTION public.care_stats(p_today date)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH per_day AS (
    SELECT day, count(*) AS total, count(completed_at) AS done,
           coalesce(sum(xp) FILTER (WHERE completed_at IS NOT NULL), 0) AS xp
    FROM public.plan_tasks
    WHERE user_id = auth.uid()
    GROUP BY day
  ),
  active_days AS (SELECT day FROM per_day WHERE done > 0 AND day <= p_today),
  ranked AS (SELECT day, day + (row_number() OVER (ORDER BY day DESC))::int AS grp FROM active_days),
  head AS (SELECT max(day) AS last_day FROM active_days),
  plan AS (
    SELECT id, week_index, started_at FROM public.care_plans
    WHERE user_id = auth.uid() AND status = 'active' LIMIT 1
  )
  SELECT jsonb_build_object(
    'xp', coalesce((SELECT sum(xp) FROM per_day), 0) + 50 * (SELECT count(*) FROM per_day WHERE done = total AND total > 0),
    'streak', (
      SELECT CASE WHEN h.last_day IS NULL OR h.last_day < p_today - 1 THEN 0
             ELSE (SELECT count(*) FROM ranked r WHERE r.grp = h.last_day + 1) END
      FROM head h
    ),
    'today', (
      SELECT jsonb_build_object('done', coalesce(pd.done, 0), 'total', coalesce(pd.total, 0))
      FROM (SELECT 1) x LEFT JOIN per_day pd ON pd.day = p_today
    ),
    'plan', (SELECT jsonb_build_object('id', id, 'week', week_index, 'started_at', started_at) FROM plan),
    'week_days', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'done', d.done, 'total', d.total) ORDER BY d.day), '[]'::jsonb)
      FROM per_day d, plan p
      WHERE d.day BETWEEN p.started_at + (p.week_index - 1) * 7 AND p.started_at + p.week_index * 7 - 1
    )
  );
$$;
REVOKE ALL ON FUNCTION public.care_stats(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.care_stats(date) TO authenticated;

-- ---------- reminders ----------
-- Claims due, not-yet-reminded tasks and returns one push target per user+slot+device.
-- Server-only: called by the dispatch route with the project admin key; never exposed to clients.
CREATE OR REPLACE FUNCTION public.claim_due_reminders(p_window_minutes int DEFAULT 5)
RETURNS TABLE (user_id uuid, slot text, endpoint text, p256dh text, auth text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH due AS (
    UPDATE public.plan_tasks t
       SET reminded_at = now()
      FROM public.care_profiles cp
     WHERE cp.user_id = t.user_id
       AND t.completed_at IS NULL
       AND t.reminded_at IS NULL
       AND t.remind_at IS NOT NULL
       AND t.day = (now() AT TIME ZONE cp.timezone)::date
       AND (now() AT TIME ZONE cp.timezone)::time >= t.remind_at
       AND (now() AT TIME ZONE cp.timezone)::time < t.remind_at + make_interval(mins => greatest(p_window_minutes, 1) * 3)
    RETURNING t.user_id, t.slot
  ),
  targets AS (SELECT DISTINCT d.user_id, d.slot FROM due d)
  SELECT tg.user_id, tg.slot, ps.endpoint, ps.p256dh, ps.auth
    FROM targets tg
    JOIN public.push_subscriptions ps ON ps.user_id = tg.user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_due_reminders(int) FROM PUBLIC, anon, authenticated;
