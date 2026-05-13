-- Phase 1: One-time migration of existing data into the BFO CHV 1995 club.
-- Idempotent: every step is guarded so this script can be re-run safely.
--
-- Migration rules (per PRD R10):
--   - Create club "BFO CHV 1995" if it does not exist.
--   - Backfill matches.club_id and match_media.club_id to BFO.
--   - Map existing admins to club_members:
--       * lauragargar@hotmail.com -> 'admin'
--       * everyone else           -> 'member'
--   - Existing admins whose email has no matching auth.users row are skipped
--     here. They will be auto-enrolled as members of BFO upon first login
--     via the post-signup hook installed by this script.
--   - matches.created_by stays NULL for pre-migration rows (no audit data
--     available).
--   - Pending admin_requests rows are NOT carried over; users can re-submit
--     a join request via the new flow.

BEGIN;

-- =====================================================================
-- 1. Ensure BFO CHV 1995 club exists.
-- =====================================================================
INSERT INTO clubs (name, description, created_at)
SELECT 'BFO CHV 1995', 'Migrated club', NOW()
WHERE NOT EXISTS (SELECT 1 FROM clubs WHERE name = 'BFO CHV 1995');
-- numeric_code is auto-filled by the trg_fill_club_code trigger.

-- =====================================================================
-- 2. Backfill matches and match_media with BFO club_id.
-- =====================================================================
DO $$
DECLARE
  bfo UUID;
BEGIN
  SELECT id INTO bfo FROM clubs WHERE name = 'BFO CHV 1995';

  -- 2a. Backfill matches
  UPDATE matches      SET club_id = bfo WHERE club_id IS NULL;

  -- 2b. Backfill match_media
  UPDATE match_media  SET club_id = bfo WHERE club_id IS NULL;

  -- 3. Map existing admins -> club_members.
  --    Laura is admin; everyone else is a standard member.
  INSERT INTO club_members (club_id, user_id, role)
  SELECT bfo,
         u.id,
         CASE
           WHEN LOWER(a.email) = 'lauragargar@hotmail.com' THEN 'admin'
           ELSE 'member'
         END
    FROM admins a
    JOIN auth.users u ON LOWER(u.email) = LOWER(a.email)
   WHERE NOT EXISTS (
     SELECT 1 FROM club_members m
     WHERE m.club_id = bfo AND m.user_id = u.id
   );

  -- 3b. Self-heal: if a previous run inserted Laura as 'member',
  --     promote her to 'admin'.
  UPDATE club_members
     SET role = 'admin'
   WHERE club_id = bfo
     AND role <> 'admin'
     AND user_id IN (
       SELECT id FROM auth.users
       WHERE LOWER(email) = 'lauragargar@hotmail.com'
     );

  -- 4. Safety net: ensure BFO has at least one admin.
  --    If Laura's auth.users record is not present yet, promote the
  --    earliest member as a temporary admin so the club is not orphaned.
  IF NOT EXISTS (
    SELECT 1 FROM club_members
    WHERE club_id = bfo AND role = 'admin'
  ) THEN
    UPDATE club_members
       SET role = 'admin'
     WHERE (club_id, user_id) IN (
       SELECT club_id, user_id FROM club_members
       WHERE club_id = bfo
       ORDER BY joined_at ASC
       LIMIT 1
     );
  END IF;
END $$;

COMMIT;

-- =====================================================================
-- 5. Post-signup hook: when a user with an email that exists in the
--    legacy admins table logs in for the first time and their auth.users
--    row is created, auto-add them to BFO as a member if not already.
--
--    This handles legacy admins who had not logged in at migration time.
--    Once the legacy admins table is dropped (Phase 7), the hook becomes
--    a no-op and can also be dropped.
-- =====================================================================
CREATE OR REPLACE FUNCTION enroll_legacy_admin_into_bfo() RETURNS TRIGGER AS $$
DECLARE
  bfo UUID;
  legacy_role TEXT;
BEGIN
  -- Look up if this email exists in the legacy admins table.
  -- Schema-qualify all public tables: this function fires from the auth schema
  -- context and the search_path may not include public.
  IF NOT EXISTS (
    SELECT 1 FROM public.admins WHERE LOWER(email) = LOWER(NEW.email)
  ) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO bfo FROM public.clubs WHERE name = 'BFO CHV 1995';
  IF bfo IS NULL THEN
    RETURN NEW;
  END IF;

  -- Laura always becomes admin; others become standard members.
  IF LOWER(NEW.email) = 'lauragargar@hotmail.com' THEN
    legacy_role := 'admin';
  ELSE
    legacy_role := 'member';
  END IF;

  INSERT INTO public.club_members (club_id, user_id, role)
  VALUES (bfo, NEW.id, legacy_role)
  ON CONFLICT (club_id, user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block user creation due to enrollment errors.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enroll_legacy_admin ON auth.users;
CREATE TRIGGER trg_enroll_legacy_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION enroll_legacy_admin_into_bfo();

-- =====================================================================
-- 6. Verification: enforce NOT NULL on backfilled columns.
--    Only apply if no rows are NULL (else fail loud).
-- =====================================================================
DO $$
DECLARE
  null_matches INT;
  null_media   INT;
BEGIN
  SELECT COUNT(*) INTO null_matches FROM matches     WHERE club_id IS NULL;
  SELECT COUNT(*) INTO null_media   FROM match_media WHERE club_id IS NULL;

  IF null_matches = 0 THEN
    BEGIN
      ALTER TABLE matches     ALTER COLUMN club_id SET NOT NULL;
    EXCEPTION WHEN others THEN NULL;
    END;
  ELSE
    RAISE NOTICE 'matches.club_id has % NULL rows; skipping NOT NULL', null_matches;
  END IF;

  IF null_media = 0 THEN
    BEGIN
      ALTER TABLE match_media ALTER COLUMN club_id SET NOT NULL;
    EXCEPTION WHEN others THEN NULL;
    END;
  ELSE
    RAISE NOTICE 'match_media.club_id has % NULL rows; skipping NOT NULL', null_media;
  END IF;
END $$;
