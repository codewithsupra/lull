-- FR8: remember the user's language server-side.
--
-- The cookie drives rendering, but a background job (a push notification, a weekly digest) has
-- no cookie — so the choice is stored alongside the timezone, which it sits naturally next to.
-- A language preference is not health data and not PII, so it is stored in the clear: it has to
-- be readable by a scheduled job that has no access to the encryption key.

ALTER TABLE public.care_profiles
  ADD COLUMN locale text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'hi'));

-- Users may change their own language, and nothing else on this row beyond what they already could.
GRANT UPDATE (locale) ON public.care_profiles TO authenticated;

COMMENT ON COLUMN public.care_profiles.locale IS
  'UI/notification language (FR8). Not PII; readable by background jobs. Keep the CHECK list in sync with LOCALES in lib/i18n/config.ts.';
