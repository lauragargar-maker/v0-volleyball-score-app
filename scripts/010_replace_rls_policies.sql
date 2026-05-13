-- Phase 1: Replace existing RLS policies with club-scoped ones.
-- Idempotent: every policy is dropped before being re-created.

-- =====================================================================
-- 1. Drop legacy permissive policies
-- =====================================================================
DROP POLICY IF EXISTS "Anyone can check if email is admin" ON admins;
DROP POLICY IF EXISTS "Anyone can view matches" ON matches;
DROP POLICY IF EXISTS "Authenticated users can insert matches" ON matches;
DROP POLICY IF EXISTS "Authenticated users can update matches" ON matches;
DROP POLICY IF EXISTS "Anyone can view sets" ON sets;
DROP POLICY IF EXISTS "Authenticated users can insert sets" ON sets;
DROP POLICY IF EXISTS "Authenticated users can update sets" ON sets;
DROP POLICY IF EXISTS "Anyone can create admin request" ON admin_requests;
DROP POLICY IF EXISTS "Authenticated users can view admin requests" ON admin_requests;
DROP POLICY IF EXISTS "Authenticated users can update admin requests" ON admin_requests;
DROP POLICY IF EXISTS "Anyone can view match media" ON match_media;
DROP POLICY IF EXISTS "Authenticated users can insert match media" ON match_media;
DROP POLICY IF EXISTS "Uploaders can delete their media" ON match_media;

-- =====================================================================
-- 2. clubs
-- =====================================================================
DROP POLICY IF EXISTS clubs_select_authenticated ON clubs;
DROP POLICY IF EXISTS clubs_insert_authenticated ON clubs;
DROP POLICY IF EXISTS clubs_update_admin ON clubs;

-- All authenticated users can read clubs (needed for join search and code lookup).
CREATE POLICY clubs_select_authenticated ON clubs
  FOR SELECT TO authenticated
  USING (true);

-- Any authenticated user can create a club.
CREATE POLICY clubs_insert_authenticated ON clubs
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Only club admins can update their club's metadata.
CREATE POLICY clubs_update_admin ON clubs
  FOR UPDATE TO authenticated
  USING (is_club_admin(id))
  WITH CHECK (is_club_admin(id));

-- =====================================================================
-- 3. club_members
-- =====================================================================
DROP POLICY IF EXISTS club_members_select_member ON club_members;
DROP POLICY IF EXISTS club_members_select_self ON club_members;
DROP POLICY IF EXISTS club_members_insert_admin ON club_members;
DROP POLICY IF EXISTS club_members_update_admin ON club_members;
DROP POLICY IF EXISTS club_members_delete_admin ON club_members;

-- Members of a club can read all memberships of that club.
CREATE POLICY club_members_select_member ON club_members
  FOR SELECT TO authenticated
  USING (is_club_member(club_id));

-- A user can always read their own memberships (needed before any club is selected).
CREATE POLICY club_members_select_self ON club_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Only club admins can add new members directly.
-- Approval flow inserts via security-definer function (bypasses RLS).
CREATE POLICY club_members_insert_admin ON club_members
  FOR INSERT TO authenticated
  WITH CHECK (is_club_admin(club_id));

-- Only club admins can change roles. Last-admin trigger guards the floor.
CREATE POLICY club_members_update_admin ON club_members
  FOR UPDATE TO authenticated
  USING (is_club_admin(club_id))
  WITH CHECK (is_club_admin(club_id));

-- Only club admins can remove members. Last-admin trigger guards the floor.
CREATE POLICY club_members_delete_admin ON club_members
  FOR DELETE TO authenticated
  USING (is_club_admin(club_id));

-- =====================================================================
-- 4. club_join_requests
-- =====================================================================
DROP POLICY IF EXISTS join_req_select_self ON club_join_requests;
DROP POLICY IF EXISTS join_req_select_admin ON club_join_requests;
DROP POLICY IF EXISTS join_req_insert_self ON club_join_requests;
DROP POLICY IF EXISTS join_req_update_admin ON club_join_requests;

-- The requester can read their own requests.
CREATE POLICY join_req_select_self ON club_join_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Club admins can read all requests for their club.
CREATE POLICY join_req_select_admin ON club_join_requests
  FOR SELECT TO authenticated
  USING (is_club_admin(club_id));

-- A user can submit a request only as themselves.
CREATE POLICY join_req_insert_self ON club_join_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Only club admins can decide a request.
CREATE POLICY join_req_update_admin ON club_join_requests
  FOR UPDATE TO authenticated
  USING (is_club_admin(club_id))
  WITH CHECK (is_club_admin(club_id));

-- =====================================================================
-- 5. matches  (R2: club isolation + R9: public live exception)
-- =====================================================================
DROP POLICY IF EXISTS matches_select_member ON matches;
DROP POLICY IF EXISTS matches_select_public_live ON matches;
DROP POLICY IF EXISTS matches_insert_member ON matches;
DROP POLICY IF EXISTS matches_update_member ON matches;

-- Authenticated users see only matches of clubs they belong to.
CREATE POLICY matches_select_member ON matches
  FOR SELECT TO authenticated
  USING (is_club_member(club_id));

-- Anonymous (public live score) can read all matches.
-- Live page MUST instantiate an anon Supabase client (no auth header) to
-- benefit from this policy regardless of whether the visitor is logged in.
CREATE POLICY matches_select_public_live ON matches
  FOR SELECT TO anon
  USING (true);

-- Members can insert matches under their club.
CREATE POLICY matches_insert_member ON matches
  FOR INSERT TO authenticated
  WITH CHECK (is_club_member(club_id) AND created_by = auth.uid());

-- Members can update matches of their club. Active-scorer enforcement
-- is layered on top of this in script 011 (see policy
-- matches_update_active_scorer).
CREATE POLICY matches_update_member ON matches
  FOR UPDATE TO authenticated
  USING (is_club_member(club_id))
  WITH CHECK (is_club_member(club_id));

-- =====================================================================
-- 6. sets
-- =====================================================================
DROP POLICY IF EXISTS sets_select_member ON sets;
DROP POLICY IF EXISTS sets_select_public_live ON sets;
DROP POLICY IF EXISTS sets_insert_member ON sets;
DROP POLICY IF EXISTS sets_update_member ON sets;

CREATE POLICY sets_select_member ON sets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = sets.match_id AND is_club_member(m.club_id)
    )
  );

CREATE POLICY sets_select_public_live ON sets
  FOR SELECT TO anon
  USING (true);

CREATE POLICY sets_insert_member ON sets
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = sets.match_id AND is_club_member(m.club_id)
    )
  );

CREATE POLICY sets_update_member ON sets
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = sets.match_id AND is_club_member(m.club_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = sets.match_id AND is_club_member(m.club_id)
    )
  );

-- =====================================================================
-- 7. match_media
-- =====================================================================
DROP POLICY IF EXISTS match_media_select_member ON match_media;
DROP POLICY IF EXISTS match_media_insert_member ON match_media;
DROP POLICY IF EXISTS match_media_delete_uploader_or_admin ON match_media;

CREATE POLICY match_media_select_member ON match_media
  FOR SELECT TO authenticated
  USING (is_club_member(club_id));

CREATE POLICY match_media_insert_member ON match_media
  FOR INSERT TO authenticated
  WITH CHECK (is_club_member(club_id) AND uploaded_by = auth.uid());

CREATE POLICY match_media_delete_uploader_or_admin ON match_media
  FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR is_club_admin(club_id));

-- =====================================================================
-- 8. Legacy tables (admins, admin_requests) - kept readable during
--    Phase 1 only so the migration script can read admins. Will be
--    dropped in Phase 7.
--
--    Lock down access in the meantime.
-- =====================================================================
DROP POLICY IF EXISTS admins_no_access ON admins;
CREATE POLICY admins_no_access ON admins
  FOR SELECT USING (false);

DROP POLICY IF EXISTS admin_requests_no_access ON admin_requests;
CREATE POLICY admin_requests_no_access ON admin_requests
  FOR SELECT USING (false);
