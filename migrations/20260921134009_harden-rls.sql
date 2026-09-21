-- Advisor hardening:
-- 1. complete_task no longer runs as SECURITY DEFINER. Users get a column-level UPDATE on
--    plan_tasks.completed_at only, and a trigger server-stamps the time so XP can't be back-dated.
-- 2. RLS policies use (select auth.uid()) so it is evaluated once per statement, not per row.
-- 3. Missing index on plan_medications.user_id.

CREATE INDEX IF NOT EXISTS plan_medications_user_idx ON public.plan_medications (user_id);

GRANT UPDATE (completed_at) ON public.plan_tasks TO authenticated;

CREATE OR REPLACE FUNCTION public.plan_tasks_guard_completion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL THEN
    IF NEW.day > (now() AT TIME ZONE 'UTC')::date + 1 THEN
      RAISE EXCEPTION 'cannot complete a future task' USING ERRCODE = '22023';
    END IF;
    NEW.completed_at := coalesce(OLD.completed_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plan_tasks_guard_completion ON public.plan_tasks;
CREATE TRIGGER plan_tasks_guard_completion
  BEFORE UPDATE OF completed_at ON public.plan_tasks
  FOR EACH ROW EXECUTE FUNCTION public.plan_tasks_guard_completion();

CREATE OR REPLACE FUNCTION public.complete_task(p_task uuid, p_done boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  t public.plan_tasks%ROWTYPE;
  remaining int;
BEGIN
  UPDATE public.plan_tasks
     SET completed_at = CASE WHEN p_done THEN now() ELSE NULL END
   WHERE id = p_task
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

-- ---------- policies: (select auth.uid()) ----------
DROP POLICY mood_select_own ON public.mood_checkins;
DROP POLICY mood_insert_own ON public.mood_checkins;
DROP POLICY mood_delete_own ON public.mood_checkins;
CREATE POLICY mood_select_own ON public.mood_checkins FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY mood_insert_own ON public.mood_checkins FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY mood_delete_own ON public.mood_checkins FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY practice_select_own ON public.practice_sessions;
DROP POLICY practice_insert_own ON public.practice_sessions;
DROP POLICY practice_delete_own ON public.practice_sessions;
CREATE POLICY practice_select_own ON public.practice_sessions FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY practice_insert_own ON public.practice_sessions FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY practice_delete_own ON public.practice_sessions FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY composed_select_own ON public.composed_sessions;
DROP POLICY composed_insert_own ON public.composed_sessions;
DROP POLICY composed_delete_own ON public.composed_sessions;
CREATE POLICY composed_select_own ON public.composed_sessions FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY composed_insert_own ON public.composed_sessions FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY composed_delete_own ON public.composed_sessions FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY care_profiles_own ON public.care_profiles;
CREATE POLICY care_profiles_own ON public.care_profiles FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY care_plans_own ON public.care_plans;
CREATE POLICY care_plans_own ON public.care_plans FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY plan_medications_own ON public.plan_medications;
CREATE POLICY plan_medications_own ON public.plan_medications FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()) AND plan_id IN (SELECT id FROM public.care_plans WHERE user_id = (SELECT auth.uid())));

DROP POLICY plan_tasks_own ON public.plan_tasks;
CREATE POLICY plan_tasks_own ON public.plan_tasks FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()) AND plan_id IN (SELECT id FROM public.care_plans WHERE user_id = (SELECT auth.uid())));

DROP POLICY push_subscriptions_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY ai_usage_own ON public.ai_usage;
CREATE POLICY ai_usage_own ON public.ai_usage FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
