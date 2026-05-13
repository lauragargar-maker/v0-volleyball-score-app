-- Phase 1: Multi-club schema
-- Creates clubs, club_members, club_join_requests tables and helper functions.
-- Idempotent: safe to re-run.

-- =====================================================================
-- 1. Helper: numeric club code generator (6-digit zero-padded)
-- =====================================================================
CREATE OR REPLACE FUNCTION gen_club_code() RETURNS TEXT AS $$
DECLARE
  c TEXT;
BEGIN
  LOOP
    c := LPAD((floor(random() * 1000000))::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM clubs WHERE numeric_code = c);
  END LOOP;
  RETURN c;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 2. clubs
-- =====================================================================
CREATE TABLE IF NOT EXISTS clubs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  numeric_code  TEXT NOT NULL UNIQUE,
  description   TEXT,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clubs_name_lower ON clubs (LOWER(name));

-- =====================================================================
-- 3. club_members
-- =====================================================================
CREATE TABLE IF NOT EXISTS club_members (
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (club_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_club_members_user ON club_members(user_id);
CREATE INDEX IF NOT EXISTS idx_club_members_club_role ON club_members(club_id, role);

-- =====================================================================
-- 4. club_join_requests
-- =====================================================================
CREATE TABLE IF NOT EXISTS club_join_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected', 'reopened')),
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at  TIMESTAMPTZ,
  decided_by  UUID REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_one_pending_per_user_club
  ON club_join_requests (club_id, user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_join_req_club_status ON club_join_requests(club_id, status);
CREATE INDEX IF NOT EXISTS idx_join_req_user_status ON club_join_requests(user_id, status);

-- =====================================================================
-- 5. Helper functions for RLS (security definer to avoid RLS recursion)
-- =====================================================================
CREATE OR REPLACE FUNCTION is_club_member(_club UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM club_members
    WHERE club_id = _club AND user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_club_admin(_club UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM club_members
    WHERE club_id = _club AND user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =====================================================================
-- 6. Last-admin guard trigger
-- =====================================================================
CREATE OR REPLACE FUNCTION enforce_last_admin() RETURNS TRIGGER AS $$
DECLARE
  remaining INT;
BEGIN
  IF (TG_OP = 'DELETE' AND OLD.role = 'admin')
     OR (TG_OP = 'UPDATE' AND OLD.role = 'admin' AND NEW.role <> 'admin')
  THEN
    SELECT COUNT(*) INTO remaining
      FROM club_members
     WHERE club_id = OLD.club_id
       AND role = 'admin'
       AND user_id <> OLD.user_id;

    IF remaining = 0 THEN
      RAISE EXCEPTION
        'Cannot remove or demote the last admin of club %', OLD.club_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_last_admin ON club_members;
CREATE TRIGGER trg_last_admin
  BEFORE UPDATE OR DELETE ON club_members
  FOR EACH ROW EXECUTE FUNCTION enforce_last_admin();

-- =====================================================================
-- 7. Auto-fill numeric_code on club creation when not provided
-- =====================================================================
CREATE OR REPLACE FUNCTION fill_club_numeric_code() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numeric_code IS NULL OR NEW.numeric_code = '' THEN
    NEW.numeric_code := gen_club_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fill_club_code ON clubs;
CREATE TRIGGER trg_fill_club_code
  BEFORE INSERT ON clubs
  FOR EACH ROW EXECUTE FUNCTION fill_club_numeric_code();

-- =====================================================================
-- 7b. Auto-enroll the club creator as the first admin.
--     This solves the RLS chicken-and-egg: the user is not an admin
--     of a club they are about to create.
-- =====================================================================
CREATE OR REPLACE FUNCTION enroll_club_creator_as_admin() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO club_members (club_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'admin')
    ON CONFLICT (club_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enroll_creator ON clubs;
CREATE TRIGGER trg_enroll_creator
  AFTER INSERT ON clubs
  FOR EACH ROW EXECUTE FUNCTION enroll_club_creator_as_admin();

-- =====================================================================
-- 8. Enable RLS on new tables (policies defined in script 010)
-- =====================================================================
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_join_requests ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 9. Add new tables to Realtime publication
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'club_members'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE club_members';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'club_join_requests'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE club_join_requests';
  END IF;
END $$;
