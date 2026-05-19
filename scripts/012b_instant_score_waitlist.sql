-- Phase 1 (landing PRD): instant_score_waitlist table for the launch-prep placeholder modal.
-- The hero "Crear marcador instantáneo" CTA opens a "Próximamente" modal that captures
-- optional emails into this table. The write path is retired in Phase 4 once Instant
-- Score launches; the rows are kept for the launch announcement.
-- Idempotent: safe to re-run.

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS public.instant_score_waitlist (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        CITEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS instant_score_waitlist_email_key
  ON public.instant_score_waitlist (email);

ALTER TABLE public.instant_score_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon can join waitlist" ON public.instant_score_waitlist;
CREATE POLICY "anon can join waitlist"
  ON public.instant_score_waitlist
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Intentionally no SELECT/UPDATE/DELETE policy for anon/authenticated:
-- only the service role (Supabase dashboard / admin scripts) can read the list.
