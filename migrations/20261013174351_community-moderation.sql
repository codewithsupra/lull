-- Community moderation: a human review loop for what the automatic layer can't decide.
--
-- Still anonymous: a ban targets an author KEY (HMAC), never an account, and the moderation log
-- records actions and targets — never content and never who anyone is. A moderator acts on
-- "the author of this post", not on a person they can name.

-- Reports get a resolution, so the queue only shows what still needs a decision.
ALTER TABLE public.forum_reports
  ADD COLUMN resolved_at timestamptz,
  ADD COLUMN resolution text CHECK (resolution IN ('restored', 'removed', 'dismissed'));
CREATE INDEX forum_reports_open_idx ON public.forum_reports (created_at DESC) WHERE resolved_at IS NULL;

CREATE TABLE public.forum_bans (
  author_key text PRIMARY KEY CHECK (author_key ~ '^[0-9a-f]{64}$'),
  -- NULL = permanent.
  until timestamptz,
  reason text NOT NULL CHECK (reason IN ('harmful_advice', 'selling', 'harassment', 'spam', 'personal_info', 'other')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.forum_mod_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action text NOT NULL CHECK (action IN ('restore', 'remove', 'dismiss', 'ban', 'unban', 'resources')),
  target_type text CHECK (target_type IN ('post', 'comment', 'author')),
  target_id text CHECK (char_length(target_id) <= 80),
  note text CHECK (char_length(note) <= 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX forum_mod_log_created_idx ON public.forum_mod_log (created_at DESC);

ALTER TABLE public.forum_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_mod_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.forum_bans, public.forum_mod_log FROM anon, authenticated;
CREATE POLICY forum_bans_server_only ON public.forum_bans FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY forum_mod_log_server_only ON public.forum_mod_log FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Restoring resets report_count to 0 (in the app's restore action) and resolves the reports, so a
-- restored post can only be hidden again by NEW reports from people who haven't reported it yet.

-- Open reports grouped by target, crisis first, then by how many people reported it.
CREATE OR REPLACE FUNCTION public.forum_mod_queue(p_limit integer DEFAULT 50)
RETURNS TABLE (target_type text, target_id uuid, reports bigint, crisis boolean, reasons text[], first_reported timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.target_type, r.target_id, count(*) AS reports,
         bool_or(r.reason = 'crisis') AS crisis,
         array_agg(DISTINCT r.reason) AS reasons,
         min(r.created_at) AS first_reported
    FROM public.forum_reports r
   WHERE r.resolved_at IS NULL
   GROUP BY r.target_type, r.target_id
   ORDER BY bool_or(r.reason = 'crisis') DESC, count(*) DESC, min(r.created_at)
   LIMIT least(greatest(p_limit, 1), 200);
$$;
REVOKE ALL ON FUNCTION public.forum_mod_queue(integer) FROM PUBLIC, anon, authenticated;
