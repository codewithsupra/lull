-- FR10 buddy invites: "do a plan together and both get 14 Pro days".
--
-- Anti-abuse model (email verification is off, so a second account costs nothing):
--   * the reward is earned by the INVITED person actually doing their plan — tasks completed on
--     3 different calendar days, counted by the server-stamped completed_at (complete_task() sets
--     it to now()), never by the task's scheduled day, so ticking off three past days in one
--     sitting doesn't count;
--   * each person can receive at most 3 buddy grants, ever;
--   * one inviter per invitee, no self-invites, no A↔B mutual pairs;
--   * every write goes through two SECURITY DEFINER functions callable only by the server's admin
--     role. Clients can read their own rows and create their own code; nothing else.
-- Constants here mirror lib/buddy.ts; tests/buddy.test.ts asserts they stay in sync.

CREATE TABLE public.buddy_codes (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.buddy_links (
  invitee_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  rewarded_at timestamptz,
  CHECK (inviter_id <> invitee_id)
);
CREATE INDEX buddy_links_inviter_idx ON public.buddy_links (inviter_id, created_at DESC);

CREATE TABLE public.pro_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('buddy')),
  link_invitee uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at AND ends_at <= starts_at + interval '31 days'),
  UNIQUE (user_id, link_invitee)
);
CREATE INDEX pro_grants_user_ends_idx ON public.pro_grants (user_id, ends_at DESC);

ALTER TABLE public.buddy_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buddy_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.buddy_codes, public.buddy_links, public.pro_grants FROM anon, authenticated;
GRANT SELECT ON public.buddy_codes, public.buddy_links, public.pro_grants TO authenticated;
GRANT INSERT (code) ON public.buddy_codes TO authenticated;

CREATE POLICY buddy_codes_own ON public.buddy_codes FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY buddy_codes_create_own ON public.buddy_codes FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
-- Both sides of a link can see it exists (and whether it has paid out) — never each other's activity.
CREATE POLICY buddy_links_either_side ON public.buddy_links FOR SELECT TO authenticated
  USING (invitee_id = (SELECT auth.uid()) OR inviter_id = (SELECT auth.uid()));
CREATE POLICY pro_grants_own ON public.pro_grants FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- ---------- join: an invitee redeems a code ----------
CREATE OR REPLACE FUNCTION public.join_buddy(p_invitee uuid, p_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inviter uuid;
BEGIN
  IF p_invitee IS NULL OR p_code IS NULL OR p_code !~ '^[A-HJ-NP-Z2-9]{8}$' THEN
    RETURN 'invalid';
  END IF;
  SELECT user_id INTO v_inviter FROM public.buddy_codes WHERE code = p_code;
  IF v_inviter IS NULL THEN
    RETURN 'invalid';
  END IF;
  IF v_inviter = p_invitee THEN
    RETURN 'self';
  END IF;
  IF EXISTS (SELECT 1 FROM public.buddy_links WHERE invitee_id = p_invitee) THEN
    RETURN 'already';
  END IF;
  -- No mutual pairs: if the inviter was invited by this person, the pair would reward itself twice.
  IF EXISTS (SELECT 1 FROM public.buddy_links WHERE invitee_id = v_inviter AND inviter_id = p_invitee) THEN
    RETURN 'mutual';
  END IF;
  INSERT INTO public.buddy_links (invitee_id, inviter_id) VALUES (p_invitee, v_inviter)
    ON CONFLICT (invitee_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN 'already';
  END IF;
  RETURN 'joined';
END;
$$;
REVOKE ALL ON FUNCTION public.join_buddy(uuid, text) FROM PUBLIC, anon, authenticated;

-- ---------- settle: pay out any link involving this user that has now been earned ----------
CREATE OR REPLACE FUNCTION public.settle_buddy_rewards(p_user uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  l record;
  person uuid;
  v_start timestamptz;
  granted integer := 0;
BEGIN
  FOR l IN
    SELECT bl.invitee_id, bl.inviter_id, bl.created_at
      FROM public.buddy_links bl
     WHERE (bl.invitee_id = p_user OR bl.inviter_id = p_user)
       AND bl.rewarded_at IS NULL
       AND (
         SELECT count(DISTINCT (t.completed_at AT TIME ZONE 'UTC')::date)
           FROM public.plan_tasks t
          WHERE t.user_id = bl.invitee_id
            AND t.completed_at IS NOT NULL
            AND t.completed_at >= bl.created_at
       ) >= 3
  LOOP
    -- Claim the link atomically: a concurrent settle for the other side gets zero rows here.
    UPDATE public.buddy_links SET rewarded_at = now()
     WHERE invitee_id = l.invitee_id AND rewarded_at IS NULL;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;
    FOREACH person IN ARRAY ARRAY[l.invitee_id, l.inviter_id] LOOP
      IF (SELECT count(*) FROM public.pro_grants g WHERE g.user_id = person AND g.source = 'buddy') >= 3 THEN
        CONTINUE;
      END IF;
      -- Stack after whatever free Pro time this person already has, so a reward is never swallowed.
      v_start := greatest(
        now(),
        coalesce((SELECT max(g.ends_at) FROM public.pro_grants g WHERE g.user_id = person), now()),
        coalesce((SELECT pt.ends_at FROM public.pro_trials pt WHERE pt.user_id = person), now())
      );
      INSERT INTO public.pro_grants (user_id, source, link_invitee, starts_at, ends_at)
      VALUES (person, 'buddy', l.invitee_id, v_start, v_start + interval '14 days')
      ON CONFLICT (user_id, link_invitee) DO NOTHING;
      IF FOUND AND person = p_user THEN
        granted := granted + 1;
      END IF;
    END LOOP;
  END LOOP;
  RETURN granted;
END;
$$;
REVOKE ALL ON FUNCTION public.settle_buddy_rewards(uuid) FROM PUBLIC, anon, authenticated;

-- ---------- my_plan(): buddy days count as Pro ----------
CREATE OR REPLACE FUNCTION public.my_plan()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH e AS (SELECT * FROM public.billing_entitlements WHERE user_id = (SELECT auth.uid())),
       t AS (SELECT * FROM public.pro_trials WHERE user_id = (SELECT auth.uid())),
       g AS (SELECT * FROM public.pro_grants WHERE user_id = (SELECT auth.uid()) AND ends_at > now()),
       paid AS (
         SELECT EXISTS (
           SELECT 1 FROM e
            WHERE e.status IN ('active', 'trialing')
               OR (e.status = 'past_due' AND now() < coalesce(e.current_period_end, now()) + interval '3 days')
         ) AS ok
       ),
       trial AS (SELECT EXISTS (SELECT 1 FROM t WHERE t.ends_at > now()) AS ok),
       gift AS (SELECT EXISTS (SELECT 1 FROM g WHERE g.starts_at <= now()) AS ok)
  SELECT jsonb_build_object(
    'pro', (SELECT ok FROM paid) OR (SELECT ok FROM trial) OR (SELECT ok FROM gift),
    'source', CASE WHEN (SELECT ok FROM paid) THEN 'subscription'
                   WHEN (SELECT ok FROM trial) THEN 'trial'
                   WHEN (SELECT ok FROM gift) THEN 'buddy'
                   ELSE 'free' END,
    'status', (SELECT status FROM e),
    'interval', (SELECT plan_interval FROM e),
    'current_period_end', (SELECT current_period_end FROM e),
    'cancel_at', (SELECT cancel_at FROM e),
    'trial_ends_at', (SELECT ends_at FROM t),
    'trial_available', NOT EXISTS (SELECT 1 FROM t) AND NOT EXISTS (SELECT 1 FROM e),
    -- End of all stacked buddy time still to come (grants chain back to back).
    'grant_ends_at', (SELECT max(ends_at) FROM g)
  );
$$;
REVOKE ALL ON FUNCTION public.my_plan() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_plan() TO authenticated;
