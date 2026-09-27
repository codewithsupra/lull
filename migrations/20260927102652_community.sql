-- Community: anonymous, moderated discussion of medicines and related topics under /slug.
--
-- Anonymity model: these tables hold NO user id. An author or voter is `*_key` =
-- HMAC-SHA256(server secret, user id), computed in lib/community-server.ts. A database dump alone
-- can't link a post to an account. Readers see per-thread aliases derived from the key + post id,
-- so a thread is followable but a person can't be tracked across threads.
--
-- Access model: no client role can touch these tables or functions. Every read and write goes
-- through the server (admin client) after authentication, moderation, PII scrubbing and rate
-- limits — the server is the only door, so there is nothing for RLS to scope per row.

CREATE TABLE public.forum_communities (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,29}$'),
  seeded boolean NOT NULL DEFAULT false,
  created_by_key text CHECK (created_by_key ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community text NOT NULL REFERENCES public.forum_communities(slug) ON DELETE CASCADE,
  author_key text NOT NULL CHECK (author_key ~ '^[0-9a-f]{64}$'),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 160),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 5000),
  flair text NOT NULL CHECK (flair IN ('experience', 'question', 'side_effects', 'tip')),
  score integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  report_count integer NOT NULL DEFAULT 0,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX forum_posts_community_created_idx ON public.forum_posts (community, created_at DESC) WHERE NOT hidden;
CREATE INDEX forum_posts_created_idx ON public.forum_posts (created_at DESC) WHERE NOT hidden;
CREATE INDEX forum_posts_author_idx ON public.forum_posts (author_key, created_at DESC);

CREATE TABLE public.forum_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.forum_comments(id) ON DELETE CASCADE,
  author_key text NOT NULL CHECK (author_key ~ '^[0-9a-f]{64}$'),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2500),
  score integer NOT NULL DEFAULT 0,
  report_count integer NOT NULL DEFAULT 0,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX forum_comments_post_idx ON public.forum_comments (post_id, created_at);
CREATE INDEX forum_comments_author_idx ON public.forum_comments (author_key, created_at DESC);
CREATE INDEX forum_comments_parent_idx ON public.forum_comments (parent_id);

-- Upvotes only: downvotes invite pile-ons against people who are struggling.
CREATE TABLE public.forum_votes (
  target_type text NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id uuid NOT NULL,
  voter_key text NOT NULL CHECK (voter_key ~ '^[0-9a-f]{64}$'),
  community text NOT NULL REFERENCES public.forum_communities(slug) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (target_type, target_id, voter_key)
);
CREATE INDEX forum_votes_created_idx ON public.forum_votes (created_at DESC, community);
CREATE INDEX forum_votes_voter_idx ON public.forum_votes (voter_key, created_at DESC);

CREATE TABLE public.forum_reports (
  target_type text NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id uuid NOT NULL,
  reporter_key text NOT NULL CHECK (reporter_key ~ '^[0-9a-f]{64}$'),
  reason text NOT NULL CHECK (reason IN ('harmful_advice', 'selling', 'harassment', 'spam', 'personal_info', 'crisis', 'other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (target_type, target_id, reporter_key)
);
CREATE INDEX forum_reports_reporter_idx ON public.forum_reports (reporter_key, created_at DESC);

ALTER TABLE public.forum_communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.forum_communities, public.forum_posts, public.forum_comments, public.forum_votes, public.forum_reports FROM anon, authenticated;

-- ---------- counters kept by triggers (never by the app) ----------
CREATE OR REPLACE FUNCTION public.forum_vote_count()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  r record;
  d integer;
BEGIN
  IF TG_OP = 'INSERT' THEN r := NEW; d := 1; ELSE r := OLD; d := -1; END IF;
  IF r.target_type = 'post' THEN
    UPDATE public.forum_posts SET score = score + d WHERE id = r.target_id;
  ELSE
    UPDATE public.forum_comments SET score = score + d WHERE id = r.target_id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER forum_votes_count AFTER INSERT OR DELETE ON public.forum_votes
  FOR EACH ROW EXECUTE FUNCTION public.forum_vote_count();

CREATE OR REPLACE FUNCTION public.forum_comment_count()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.forum_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSE
    UPDATE public.forum_posts SET comment_count = greatest(comment_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER forum_comments_count AFTER INSERT OR DELETE ON public.forum_comments
  FOR EACH ROW EXECUTE FUNCTION public.forum_comment_count();

-- Three independent reports hide a post or comment. There is no reviewer queue yet, so hiding is
-- the safe default: a false positive costs one post, a false negative can hurt a reader.
CREATE OR REPLACE FUNCTION public.forum_report_count()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.target_type = 'post' THEN
    UPDATE public.forum_posts SET report_count = report_count + 1, hidden = hidden OR report_count + 1 >= 3 WHERE id = NEW.target_id;
  ELSE
    UPDATE public.forum_comments SET report_count = report_count + 1, hidden = hidden OR report_count + 1 >= 3 WHERE id = NEW.target_id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER forum_reports_count AFTER INSERT ON public.forum_reports
  FOR EACH ROW EXECUTE FUNCTION public.forum_report_count();

REVOKE ALL ON FUNCTION public.forum_vote_count(), public.forum_comment_count(), public.forum_report_count() FROM PUBLIC, anon, authenticated;

-- ---------- server-only operations ----------
-- Toggle an upvote. Refuses hidden targets and self-votes. Returns {score, voted} or NULL.
CREATE OR REPLACE FUNCTION public.forum_toggle_vote(p_type text, p_id uuid, p_voter text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_author text;
  v_community text;
  v_score integer;
  v_voted boolean;
BEGIN
  IF p_type = 'post' THEN
    SELECT author_key, community INTO v_author, v_community FROM public.forum_posts WHERE id = p_id AND NOT hidden;
  ELSIF p_type = 'comment' THEN
    SELECT c.author_key, p.community INTO v_author, v_community
      FROM public.forum_comments c JOIN public.forum_posts p ON p.id = c.post_id
     WHERE c.id = p_id AND NOT c.hidden AND NOT p.hidden;
  ELSE
    RETURN NULL;
  END IF;
  IF v_author IS NULL OR v_author = p_voter THEN
    RETURN NULL;
  END IF;
  DELETE FROM public.forum_votes WHERE target_type = p_type AND target_id = p_id AND voter_key = p_voter;
  IF FOUND THEN
    v_voted := false;
  ELSE
    INSERT INTO public.forum_votes (target_type, target_id, voter_key, community) VALUES (p_type, p_id, p_voter, v_community);
    v_voted := true;
  END IF;
  IF p_type = 'post' THEN
    SELECT score INTO v_score FROM public.forum_posts WHERE id = p_id;
  ELSE
    SELECT score INTO v_score FROM public.forum_comments WHERE id = p_id;
  END IF;
  RETURN jsonb_build_object('score', v_score, 'voted', v_voted);
END;
$$;

-- Communities ranked by upvotes received in the window ("most upvoted tags of the week").
CREATE OR REPLACE FUNCTION public.forum_trending(p_since timestamptz, p_limit integer DEFAULT 12)
RETURNS TABLE (slug text, votes bigint, posts bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT v.community AS slug,
         count(*) AS votes,
         (SELECT count(*) FROM public.forum_posts p WHERE p.community = v.community AND NOT p.hidden AND p.created_at >= p_since) AS posts
    FROM public.forum_votes v
   WHERE v.created_at >= p_since
   GROUP BY v.community
   ORDER BY votes DESC, v.community
   LIMIT least(greatest(p_limit, 1), 50);
$$;

-- Post counts for a set of communities (for recommended tags).
CREATE OR REPLACE FUNCTION public.forum_community_stats(p_slugs text[])
RETURNS TABLE (slug text, posts bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT c.slug, (SELECT count(*) FROM public.forum_posts p WHERE p.community = c.slug AND NOT p.hidden) AS posts
    FROM public.forum_communities c
   WHERE c.slug = ANY (p_slugs);
$$;

REVOKE ALL ON FUNCTION public.forum_toggle_vote(text, uuid, text), public.forum_trending(timestamptz, integer), public.forum_community_stats(text[])
  FROM PUBLIC, anon, authenticated;

-- ---------- seed communities ----------
INSERT INTO public.forum_communities (slug, seeded) VALUES
  ('anxiety', true), ('depression', true), ('adhd', true), ('insomnia', true), ('stress', true),
  ('ocd', true), ('bipolar', true), ('panic', true), ('side-effects', true), ('therapy', true),
  ('sertraline', true), ('escitalopram', true), ('fluoxetine', true), ('paroxetine', true),
  ('venlafaxine', true), ('duloxetine', true), ('bupropion', true), ('mirtazapine', true),
  ('trazodone', true), ('clonazepam', true), ('alprazolam', true), ('propranolol', true),
  ('methylphenidate', true), ('concerta', true), ('atomoxetine', true), ('quetiapine', true),
  ('olanzapine', true), ('aripiprazole', true), ('lithium', true), ('lamotrigine', true),
  ('melatonin', true), ('zolpidem', true)
ON CONFLICT (slug) DO NOTHING;
