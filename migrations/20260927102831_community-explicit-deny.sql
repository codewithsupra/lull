-- Make the community tables' "server only" intent explicit: a deny-all policy per table, on top of
-- having no grants for anon/authenticated. Reads and writes happen only through the server's admin
-- client (see the header of *_community.sql).
CREATE POLICY forum_communities_server_only ON public.forum_communities FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY forum_posts_server_only ON public.forum_posts FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY forum_comments_server_only ON public.forum_comments FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY forum_votes_server_only ON public.forum_votes FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY forum_reports_server_only ON public.forum_reports FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE INDEX forum_votes_community_idx ON public.forum_votes (community);
