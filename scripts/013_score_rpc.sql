-- 013: single-round-trip atomic scoring (optimistic-UI support).
-- Idempotent: safe to re-run.

-- =====================================================================
-- 1. sets.score_version: monotonically increasing per-row version,
--    bumped by trigger on ANY score change (RPC or direct UPDATE, e.g.
--    the set-end-cancel revert). Clients use it to order/reconcile
--    concurrent updates (realtime events vs RPC responses vs refetches).
-- =====================================================================
ALTER TABLE sets ADD COLUMN IF NOT EXISTS score_version BIGINT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION bump_set_score_version() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.home_score IS DISTINCT FROM OLD.home_score
     OR NEW.away_score IS DISTINCT FROM OLD.away_score THEN
    NEW.score_version := OLD.score_version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sets_score_version ON sets;
CREATE TRIGGER trg_sets_score_version
  BEFORE UPDATE ON sets
  FOR EACH ROW EXECUTE FUNCTION bump_set_score_version();

-- =====================================================================
-- 2. increment_set_score
--    Applies a +/-1 delta to one team's score atomically, with
--    server-side clamping, and refreshes the caller's active-scorer
--    lock in the same transaction. Replaces the previous two-round-trip
--    flow (touch_active_scorer RPC + direct sets UPDATE) with one call.
--    FOR UPDATE serializes concurrent taps so no increment is lost.
-- =====================================================================
CREATE OR REPLACE FUNCTION increment_set_score(
  _set_id UUID,
  _team TEXT,
  _delta INTEGER
) RETURNS sets AS $$
DECLARE
  s sets;
  m matches;
  score_limit INTEGER;
BEGIN
  IF _team NOT IN ('home', 'away') OR _delta NOT IN (-1, 1) THEN
    RAISE EXCEPTION 'invalid_args';
  END IF;

  SELECT * INTO s FROM sets WHERE id = _set_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'set_not_found';
  END IF;

  SELECT * INTO m FROM matches WHERE id = s.match_id;

  -- Authorize explicitly: SECURITY DEFINER bypasses RLS. Same semantics
  -- as the sets_update_member policy plus in_progress guards.
  IF m IS NULL
     OR NOT is_club_member(m.club_id)
     OR m.status <> 'in_progress'
     OR s.status <> 'in_progress' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Caller must hold the active-scorer lock; refresh it so the timeout
  -- doesn't fire mid-rally (replaces the separate touch_active_scorer call).
  UPDATE active_scorers
     SET last_activity = NOW()
   WHERE match_id = s.match_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_active_scorer';
  END IF;

  score_limit := CASE WHEN s.set_number = 3 THEN 15 ELSE 25 END;

  IF _team = 'home' THEN
    UPDATE sets
       SET home_score = GREATEST(0, LEAST(score_limit, home_score + _delta))
     WHERE id = _set_id
    RETURNING * INTO s;
  ELSE
    UPDATE sets
       SET away_score = GREATEST(0, LEAST(score_limit, away_score + _delta))
     WHERE id = _set_id
    RETURNING * INTO s;
  END IF;

  RETURN s;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
