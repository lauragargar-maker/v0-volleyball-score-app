-- Phase 1: Add club_id and created_by columns to existing tables.
-- Idempotent: safe to re-run.
-- NOTE: NOT NULL constraints are NOT applied here. They are applied after
-- the migration script (009) verifies all rows are backfilled.

-- =====================================================================
-- matches.club_id, matches.created_by
-- =====================================================================
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id);

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_matches_club_status ON matches(club_id, status);
CREATE INDEX IF NOT EXISTS idx_matches_created_by ON matches(created_by);

-- =====================================================================
-- match_media.club_id
-- =====================================================================
ALTER TABLE match_media
  ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id);

CREATE INDEX IF NOT EXISTS idx_match_media_club ON match_media(club_id);
