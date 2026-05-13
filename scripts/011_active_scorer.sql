-- Phase 5: Active Scorer concurrency control.
-- Idempotent: safe to re-run.

-- =====================================================================
-- 1. active_scorers table
-- =====================================================================
CREATE TABLE IF NOT EXISTS active_scorers (
  match_id      UUID PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acquired_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version       BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_active_scorers_last_activity
  ON active_scorers(last_activity);

ALTER TABLE active_scorers ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 2. RLS: read-only for club members. All writes via security-definer RPCs.
-- =====================================================================
DROP POLICY IF EXISTS active_scorers_select_member ON active_scorers;
CREATE POLICY active_scorers_select_member ON active_scorers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = active_scorers.match_id AND is_club_member(m.club_id)
    )
  );

-- No INSERT/UPDATE/DELETE policies — direct writes are denied.
-- The RPCs below are SECURITY DEFINER and bypass RLS.

-- =====================================================================
-- 3. claim_active_scorer
--    - _force = false: returns the row if caller is the current scorer
--      (also refreshing last_activity/version), or raises 'locked_by_other'
--      if someone else holds the lock, or creates a new row if unclaimed.
--    - _force = true: takes over the lock from another user, with
--      compare-and-swap on _expected_version.
-- =====================================================================
CREATE OR REPLACE FUNCTION claim_active_scorer(
  _match_id UUID,
  _force BOOLEAN DEFAULT FALSE,
  _expected_version BIGINT DEFAULT NULL
) RETURNS active_scorers AS $$
DECLARE
  row active_scorers;
BEGIN
  -- Authorize: caller must be a member of the match's club AND match must be in_progress.
  IF NOT EXISTS (
    SELECT 1 FROM matches m
    WHERE m.id = _match_id
      AND is_club_member(m.club_id)
      AND m.status = 'in_progress'
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Lazy cleanup: release any stale (>10 min) lock for this match.
  DELETE FROM active_scorers
   WHERE match_id = _match_id
     AND last_activity < NOW() - INTERVAL '10 minutes';

  SELECT * INTO row FROM active_scorers WHERE match_id = _match_id;

  -- Unclaimed: take it.
  IF row IS NULL THEN
    INSERT INTO active_scorers (match_id, user_id)
    VALUES (_match_id, auth.uid())
    RETURNING * INTO row;
    RETURN row;
  END IF;

  -- Same caller: refresh activity and bump version.
  IF row.user_id = auth.uid() THEN
    UPDATE active_scorers
       SET last_activity = NOW(),
           version = version + 1
     WHERE match_id = _match_id
    RETURNING * INTO row;
    RETURN row;
  END IF;

  -- Different user holds it: must force.
  IF NOT _force THEN
    RAISE EXCEPTION 'locked_by_other' USING DETAIL = row.user_id::text;
  END IF;

  -- Compare-and-swap to prevent simultaneous reclaim races.
  IF _expected_version IS NOT NULL AND row.version <> _expected_version THEN
    RAISE EXCEPTION 'version_conflict';
  END IF;

  UPDATE active_scorers
     SET user_id = auth.uid(),
         acquired_at = NOW(),
         last_activity = NOW(),
         version = version + 1
   WHERE match_id = _match_id
  RETURNING * INTO row;

  RETURN row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- 4. touch_active_scorer
--    Refreshes last_activity. Called from score-mutation paths to keep
--    the lock alive. Raises if caller is not the active scorer.
-- =====================================================================
CREATE OR REPLACE FUNCTION touch_active_scorer(_match_id UUID)
RETURNS active_scorers AS $$
DECLARE
  row active_scorers;
BEGIN
  UPDATE active_scorers
     SET last_activity = NOW()
   WHERE match_id = _match_id
     AND user_id = auth.uid()
  RETURNING * INTO row;

  IF row IS NULL THEN
    RAISE EXCEPTION 'not_active_scorer';
  END IF;

  RETURN row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- 4b. get_shared_user_email
--    Returns the email of _user_id if the caller shares any club with
--    them. Used by the UI to display "X is scoring" labels.
-- =====================================================================
CREATE OR REPLACE FUNCTION get_shared_user_email(_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  email_out TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM club_members me
      JOIN club_members other
        ON other.club_id = me.club_id
     WHERE me.user_id = auth.uid()
       AND other.user_id = _user_id
  ) THEN
    RETURN NULL;
  END IF;

  SELECT email INTO email_out FROM auth.users WHERE id = _user_id;
  RETURN email_out;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =====================================================================
-- 5. release_active_scorer
--    Called when finishing/cancelling a match, or when a user explicitly
--    releases the lock (currently unused by UI but available for future).
-- =====================================================================
CREATE OR REPLACE FUNCTION release_active_scorer(_match_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM active_scorers
   WHERE match_id = _match_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- 6. Active-scorer enforcement on score writes (UPDATE on sets/matches).
--    These additional RLS policies require the writer to currently hold
--    the active scorer lock for the match.
-- =====================================================================
DROP POLICY IF EXISTS sets_update_member ON sets;
CREATE POLICY sets_update_member ON sets
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = sets.match_id AND is_club_member(m.club_id)
    )
    AND EXISTS (
      SELECT 1 FROM active_scorers a
      WHERE a.match_id = sets.match_id AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = sets.match_id AND is_club_member(m.club_id)
    )
    AND EXISTS (
      SELECT 1 FROM active_scorers a
      WHERE a.match_id = sets.match_id AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS sets_insert_member ON sets;
CREATE POLICY sets_insert_member ON sets
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = sets.match_id AND is_club_member(m.club_id)
    )
    AND EXISTS (
      SELECT 1 FROM active_scorers a
      WHERE a.match_id = sets.match_id AND a.user_id = auth.uid()
    )
  );

-- For matches.UPDATE, score-related fields (home_sets_won, away_sets_won,
-- status, winner, finished_at, cancellation_reason) are written by the
-- scorer. We require active-scorer hold OR no scorer row yet (covers
-- cancellation / finalization edge case at the very end).
DROP POLICY IF EXISTS matches_update_member ON matches;
CREATE POLICY matches_update_member ON matches
  FOR UPDATE TO authenticated
  USING (
    is_club_member(club_id)
    AND (
      NOT EXISTS (SELECT 1 FROM active_scorers a WHERE a.match_id = matches.id)
      OR EXISTS (
        SELECT 1 FROM active_scorers a
        WHERE a.match_id = matches.id AND a.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    is_club_member(club_id)
    AND (
      NOT EXISTS (SELECT 1 FROM active_scorers a WHERE a.match_id = matches.id)
      OR EXISTS (
        SELECT 1 FROM active_scorers a
        WHERE a.match_id = matches.id AND a.user_id = auth.uid()
      )
    )
  );

-- =====================================================================
-- 7. Add to Realtime publication for reclaim notifications.
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'active_scorers'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE active_scorers';
  END IF;
END $$;

-- =====================================================================
-- 8. pg_cron job: release stale locks every 2 minutes.
--    Decision: Option 1 (lazy cleanup + cron at 2-min frequency).
--    The DELETE is cheap on an indexed column; firing Realtime DELETE
--    events lets passive viewers see the unlock without polling.
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule any previous version of the job before (re-)scheduling.
DO $$
DECLARE
  job_id BIGINT;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'release-stale-active-scorers';
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'release-stale-active-scorers',
  '*/2 * * * *',
  $$DELETE FROM active_scorers WHERE last_activity < NOW() - INTERVAL '10 minutes'$$
);
