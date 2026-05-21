-- Script 012: Join request RPCs and withdrawal policy.
-- Run this in the Supabase SQL editor.

-- =====================================================================
-- 1. Allow users to withdraw their own pending requests
-- =====================================================================
DROP POLICY IF EXISTS join_req_delete_self ON club_join_requests;
CREATE POLICY join_req_delete_self ON club_join_requests
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending');

-- =====================================================================
-- 2. get_requester_email(request_id)
--    Returns the email of the user who submitted a join request.
--    Only callable if the caller is an admin of that request's club.
-- =====================================================================
DROP FUNCTION IF EXISTS get_requester_email(UUID);
CREATE FUNCTION get_requester_email(_request_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _club_id  UUID;
  _user_id  UUID;
  _email    TEXT;
BEGIN
  SELECT club_id, user_id
  INTO _club_id, _user_id
  FROM club_join_requests
  WHERE id = _request_id;

  IF _club_id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF NOT is_club_admin(_club_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT email INTO _email FROM auth.users WHERE id = _user_id;
  RETURN _email;
END;
$$;

-- =====================================================================
-- 3. approve_join_request(_request_id)
--    Atomically: marks request approved + inserts club_member.
--    Only club admins can call this.
-- =====================================================================
DROP FUNCTION IF EXISTS approve_join_request(UUID);
CREATE FUNCTION approve_join_request(_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _club_id  UUID;
  _user_id  UUID;
  _status   TEXT;
BEGIN
  SELECT club_id, user_id, status
  INTO _club_id, _user_id, _status
  FROM club_join_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF _club_id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF NOT is_club_admin(_club_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  IF _status NOT IN ('pending', 'reopened') THEN
    RAISE EXCEPTION 'Request is not in a pending state';
  END IF;

  INSERT INTO club_members (club_id, user_id, role)
  VALUES (_club_id, _user_id, 'member')
  ON CONFLICT (club_id, user_id) DO NOTHING;

  UPDATE club_join_requests
  SET
    status     = 'approved',
    decided_at = NOW(),
    decided_by = auth.uid()
  WHERE id = _request_id;
END;
$$;

-- =====================================================================
-- 4. reject_join_request(_request_id, _reason)
--    Marks request as rejected. Only club admins can call this.
-- =====================================================================
DROP FUNCTION IF EXISTS reject_join_request(UUID, TEXT);
CREATE FUNCTION reject_join_request(_request_id UUID, _reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _club_id UUID;
  _status  TEXT;
BEGIN
  SELECT club_id, status
  INTO _club_id, _status
  FROM club_join_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF _club_id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF NOT is_club_admin(_club_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  IF _status NOT IN ('pending', 'reopened') THEN
    RAISE EXCEPTION 'Request is not in a pending state';
  END IF;

  UPDATE club_join_requests
  SET
    status     = 'rejected',
    reason     = _reason,
    decided_at = NOW(),
    decided_by = auth.uid()
  WHERE id = _request_id;
END;
$$;
