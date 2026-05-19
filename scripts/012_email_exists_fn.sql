-- Phase 1 (landing PRD): email_exists helper for login/register pre-check (R6, R10.1).
-- Idempotent: safe to re-run.

CREATE OR REPLACE FUNCTION public.email_exists(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(email) = lower(p_email)
  );
$$;

REVOKE ALL ON FUNCTION public.email_exists(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_exists(text) TO anon, authenticated;

COMMENT ON FUNCTION public.email_exists(text) IS
  'Returns true if an account with the given email (case-insensitive) exists in auth.users. '
  'Called from public login/register flows to branch into the correct flow before sending an OTP. '
  'Enumeration-mitigation note: relies on Turnstile captcha at the calling form and on private-beta '
  'invite-gating during early launch. Add explicit per-IP rate limiting before public launch.';
