-- Trending counts only votes on content that still exists and isn't hidden: a reported-and-hidden
-- post (or a deleted one) must not keep pushing its community up the "this week" list.
CREATE OR REPLACE FUNCTION public.forum_trending(p_since timestamptz, p_limit integer DEFAULT 12)
RETURNS TABLE (slug text, votes bigint, posts bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT v.community AS slug,
         count(*) AS votes,
         (SELECT count(*) FROM public.forum_posts p WHERE p.community = v.community AND NOT p.hidden AND p.created_at >= p_since) AS posts
    FROM public.forum_votes v
   WHERE v.created_at >= p_since
     AND CASE v.target_type
           WHEN 'post' THEN EXISTS (SELECT 1 FROM public.forum_posts p WHERE p.id = v.target_id AND NOT p.hidden)
           ELSE EXISTS (SELECT 1 FROM public.forum_comments c JOIN public.forum_posts p ON p.id = c.post_id
                         WHERE c.id = v.target_id AND NOT c.hidden AND NOT p.hidden)
         END
   GROUP BY v.community
   ORDER BY votes DESC, v.community
   LIMIT least(greatest(p_limit, 1), 50);
$$;
REVOKE ALL ON FUNCTION public.forum_trending(timestamptz, integer) FROM PUBLIC, anon, authenticated;
