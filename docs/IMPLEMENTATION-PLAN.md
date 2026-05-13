# Implementation Plan: VolleyScore Multi-User, Multi-Club

**Companion to:** `docs/PRD-multi-user-multi-club.md` (v1.3)

---

## 0. Guiding Principles

- **DB-first enforcement.** Every authorization rule must be expressed as RLS. UI is convenience.
- **Idempotent migrations.** All SQL scripts use `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, and predicate-guarded inserts.
- **Incremental rollout.** Each phase ends in a deployable state. Old paths are not removed until the new path replaces them.
- **No regression to public live score.** `/live/[matchId]` must keep working anonymously throughout the migration.
- **Auth identity = `auth.users.id`.** The current `admins(email)` table is replaced by `club_members(user_id, club_id, role)` keyed on Supabase auth user.

---

## 1. Phased Breakdown

### Phase 1 — Schema, RLS skeleton, and data migration
Create the new tables and migrate existing data. The app keeps running on the old code path because we add `club_id` columns as nullable initially, then backfill, then enforce `NOT NULL`.

- **Build:** new SQL scripts (`007_*` through `010_*`); seed BFO CHV 1995; backfill `matches.club_id`, `match_media.club_id`; new RLS policies replacing old ones.
- **Files added:** `scripts/007_create_clubs.sql`, `scripts/008_add_club_id_columns.sql`, `scripts/009_migrate_to_bfo_club.sql`, `scripts/010_replace_rls_policies.sql`, `scripts/011_active_scorer.sql`.
- **Files changed:** `lib/types.ts` (new types).
- **Dependencies:** none.
- **Testable deliverable:** a Supabase project where the existing app still functions (RLS policies still permit any authenticated user, so behavior is unchanged), but every match/media row has `club_id` set, and there is a `clubs` row for BFO with members loaded.

### Phase 2 — Auth/membership context, onboarding, club creation
Replace the admin model with the membership model in app code. Add an onboarding screen for users with zero memberships.

- **Build:** new `ClubProvider` with active-club state and per-club role; rewrite `auth-provider.tsx` to drop `isAdmin`; new pages: `/onboarding` (create or join), `/clubs/new`; updated middleware to redirect users with no memberships to `/onboarding`.
- **Files added:** `components/club-provider.tsx`, `app/(authenticated)/onboarding/page.tsx`, `app/(authenticated)/clubs/new/page.tsx`, `lib/clubs.ts` (server helpers: `getMyMemberships`, `getActiveClubFromCookie`, `requireClubMembership`).
- **Files changed:** `components/auth-provider.tsx`, `middleware.ts`, `lib/supabase/middleware.ts`, `app/(authenticated)/layout.tsx`, `components/authenticated-header.tsx`.
- **Dependencies:** Phase 1.
- **Testable deliverable:** existing BFO members log in and see the BFO club selected automatically. A brand-new user is sent to `/onboarding` and can create a new club. The middleware blocks navigation to `/home` until membership exists.

### Phase 3 — Club search, join requests (user side)
Replace `solicitar-acceso` (admin-request) flow with the member-side join-request flow.

- **Build:** `/clubs/join` page with two tabs (search by name, by code); pending-request status screen; insertion into `club_join_requests` with the 3-attempt cap.
- **Files added:** `app/(authenticated)/clubs/join/page.tsx`, `components/club-search.tsx`, `components/join-by-code.tsx`, `components/pending-request-card.tsx`.
- **Files changed:** `app/(public)/solicitar-acceso/page.tsx` removed or redirected to `/auth/login`.
- **Dependencies:** Phase 2.
- **Testable deliverable:** a logged-in non-member can find a club, submit a join request, and see the pending status. A second submission to the same club is blocked.

### Phase 4 — Member management (admin side)
Repurpose the existing `solicitudes` page to be club-scoped, plus add a members management page.

- **Build:** `/club/requests` (rename of solicitudes) showing pending join requests for the active club; `/club/members` listing members with promote/demote/remove actions; last-admin guard via DB trigger and UI disable.
- **Files added:** `app/(authenticated)/club/requests/page.tsx`, `app/(authenticated)/club/members/page.tsx`, `components/club-join-requests-list.tsx` (replaces `admin-requests-list.tsx`), `components/club-members-list.tsx`.
- **Files changed/removed:** `app/(authenticated)/solicitudes/page.tsx` redirects to `/club/requests`; `components/admin-requests-list.tsx` deleted (or kept as ghost during transition).
- **Dependencies:** Phase 3.
- **Testable deliverable:** a club admin can approve a request (creates `club_members` row), reject it, demote/promote, and is blocked from removing the last admin both via UI and (if bypassed) via DB.

### Phase 5 — Active Scorer concurrency control
Apply the lock model to the scoring page.

- **Build:** active-scorer table + DB function `claim_or_reclaim_scorer(match_id, user_id, force boolean)` with compare-and-swap; client hook `useActiveScorer(matchId)` subscribed via Supabase Realtime; 9-min warning + 10-min release; reclaim modal; locked read-only view.
- **Files added:** `lib/hooks/use-active-scorer.ts`, `components/scoring/locked-banner.tsx`, `components/scoring/reclaim-dialog.tsx`, `components/scoring/timeout-warning.tsx`, `scripts/012_active_scorer_functions.sql`.
- **Files changed:** `app/(authenticated)/home/page.tsx` (gate score-write actions on `isActiveScorer`).
- **Dependencies:** Phase 2.
- **Testable deliverable:** two browser sessions of the same club: one creates the match and is the scorer; the other sees a locked view; reclaim works; if scorer is idle 10 minutes, the lock auto-releases.

### Phase 6 — Email notifications (Resend)
Wire transactional emails for join request submission, approval, and rejection.

- **Build:** Next.js server actions/route handlers that call Resend after the relevant DB writes; alternatively a single Supabase Edge Function `notify-join-request` triggered by `pg_net` from a row-level trigger. Recommended approach: **Next.js route handler invoked from the server action** (simpler dev loop, fewer moving parts).
- **Files added:** `lib/email/resend.ts`, `lib/email/templates.tsx`, `app/api/notifications/join-request/route.ts`.
- **Files changed:** approve/reject actions in Phase 4 to enqueue email after DB write.
- **Dependencies:** Phase 4.
- **Testable deliverable:** real emails received in test inboxes for the three events.

### Phase 7 — Cleanup
Drop legacy artifacts once new flows are stable.

- **Build:** drop `admins`, `admin_requests`; remove `solicitar-acceso` and `solicitudes` routes; delete unused components.
- **Dependencies:** Phases 1–6 in production for at least one validation cycle.

---

## 2. Database Schema Changes

### 2.1 New tables

```sql
-- clubs
CREATE TABLE clubs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,
  numeric_code    TEXT NOT NULL UNIQUE,           -- 6-digit, generated in trigger
  description     TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_clubs_name_lower ON clubs (LOWER(name));

-- numeric_code generation: 6-digit, retry on collision
CREATE OR REPLACE FUNCTION gen_club_code() RETURNS TEXT AS $$
DECLARE c TEXT;
BEGIN
  LOOP
    c := LPAD((floor(random()*1000000))::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM clubs WHERE numeric_code = c);
  END LOOP;
  RETURN c;
END;$$ LANGUAGE plpgsql;

-- club_members
CREATE TABLE club_members (
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('admin','member')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (club_id, user_id)
);
CREATE INDEX idx_club_members_user ON club_members(user_id);

-- club_join_requests
CREATE TABLE club_join_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected','reopened')),
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at    TIMESTAMPTZ,
  decided_by    UUID REFERENCES auth.users(id)
);
CREATE UNIQUE INDEX uniq_one_pending_per_user_club
  ON club_join_requests(club_id, user_id) WHERE status = 'pending';
CREATE INDEX idx_join_req_club_status ON club_join_requests(club_id, status);
CREATE INDEX idx_join_req_user_status ON club_join_requests(user_id, status);

-- active scorer (one row per active match)
CREATE TABLE active_scorers (
  match_id        UUID PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acquired_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version         BIGINT NOT NULL DEFAULT 1       -- compare-and-swap token
);
CREATE INDEX idx_active_scorers_last_activity ON active_scorers(last_activity);
```

### 2.2 Columns added to existing tables

```sql
ALTER TABLE matches      ADD COLUMN club_id UUID REFERENCES clubs(id);
ALTER TABLE match_media  ADD COLUMN club_id UUID REFERENCES clubs(id);
-- backfill (Phase 1 migration), then:
ALTER TABLE matches      ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE match_media  ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE matches      ADD COLUMN created_by UUID REFERENCES auth.users(id);

CREATE INDEX idx_matches_club_status ON matches(club_id, status);
CREATE INDEX idx_match_media_club ON match_media(club_id);
```
`sets` does not need `club_id` directly — its access derives from `matches.club_id` via a join in RLS.

### 2.3 Last-admin guard (trigger)

```sql
CREATE OR REPLACE FUNCTION enforce_last_admin() RETURNS TRIGGER AS $$
DECLARE remaining INT;
BEGIN
  IF (TG_OP = 'DELETE' AND OLD.role = 'admin')
     OR (TG_OP = 'UPDATE' AND OLD.role = 'admin' AND NEW.role <> 'admin') THEN
    SELECT COUNT(*) INTO remaining
      FROM club_members
     WHERE club_id = OLD.club_id AND role = 'admin'
       AND NOT (user_id = OLD.user_id);
    IF remaining = 0 THEN
      RAISE EXCEPTION 'Cannot remove or demote the last admin of club %', OLD.club_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_last_admin
BEFORE UPDATE OR DELETE ON club_members
FOR EACH ROW EXECUTE FUNCTION enforce_last_admin();
```

### 2.4 Disposition of legacy tables

| Table | Disposition |
|---|---|
| `admins` | **Drop in Phase 7.** Phase 1 migration reads it to populate `club_members` for BFO, then it becomes unused. |
| `admin_requests` | **Drop in Phase 7.** Existing approved entries are already represented in `admins` (and thus migrated). Pending entries are surfaced in the Open Decisions section. |

---

## 3. RLS Policy Strategy

### 3.1 Helper functions (security definer)
```sql
CREATE OR REPLACE FUNCTION is_club_member(_club UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM club_members
                 WHERE club_id = _club AND user_id = auth.uid());
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_club_admin(_club UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM club_members
                 WHERE club_id = _club AND user_id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```
These avoid recursive RLS evaluations on `club_members` from other policies.

### 3.2 Per-table policies

**clubs**
- SELECT: authenticated users — yes (needed for join search and code lookup). Anonymous: no.
- INSERT: authenticated, with `created_by = auth.uid()`.
- UPDATE/DELETE: only club admins of that club. Delete is currently disallowed at app level but RLS still permits admin-only.

**club_members**
- SELECT: any member of the same club (`is_club_member(club_id)`).
- INSERT: only club admins (`is_club_admin(NEW.club_id)`), OR via the security-definer function `approve_join_request` (preferred).
- UPDATE: only club admins (for promote/demote). Last-admin trigger enforces guard.
- DELETE: only club admins; trigger enforces last-admin.

**club_join_requests**
- SELECT: requesting user (`user_id = auth.uid()`) OR admin of the club.
- INSERT: authenticated, with `user_id = auth.uid()`. App enforces 3-attempt cap (or DB function).
- UPDATE: only club admins of that `club_id` (to set status/decided_*).

**matches**
- **SELECT (the dual policy):**
  ```sql
  CREATE POLICY matches_select_member ON matches FOR SELECT
    TO authenticated
    USING (is_club_member(club_id));
  CREATE POLICY matches_select_public_live ON matches FOR SELECT
    TO anon
    USING (true);
  ```
  Anonymous users (the `anon` role) can SELECT any match (this serves `/live/[matchId]`). Authenticated users only see their clubs' matches.

- INSERT: authenticated AND `is_club_member(NEW.club_id)` AND `created_by = auth.uid()`.
- UPDATE: authenticated AND `is_club_member(club_id)` AND active-scorer check (see §5).
- DELETE: not allowed.

**sets**
- SELECT (authenticated): mirrors matches via subquery on `is_club_member(matches.club_id)`.
- SELECT (anon): permissive — required for public live page.
- INSERT/UPDATE: club member of parent match's club.

**match_media**
- SELECT/INSERT/UPDATE/DELETE: club member of `club_id`. DELETE additionally restricted to `uploaded_by = auth.uid()` OR club admin.
- No anonymous policy. Public live page does not show media.

**active_scorers**
- SELECT: club members of parent match's club (so locked viewers can show "X is scoring").
- INSERT/UPDATE/DELETE: only via security-definer RPC `claim_active_scorer` — direct policies deny all writes.

### 3.3 Why the `anon`-scoped public-live policy is safe
- It exposes only columns of `matches` and `sets`. It does not expose `match_media` or any identity. The `home_team`/`away_team` fields are already plain text the user typed, intended to be public.
- **Critical:** The public live page must use an **anonymous** Supabase client (no Authorization header) regardless of whether the visitor is logged in. Otherwise, the authenticated user's membership-scoped policy applies and a logged-in non-member of the owning club would not see the match.

---

## 4. Migration Script Design (`scripts/009_migrate_to_bfo_club.sql`)

Idempotent transformation: every step uses guards.

```sql
BEGIN;

-- 1. BFO club (idempotent by unique name)
INSERT INTO clubs (name, numeric_code, description, created_at)
SELECT 'BFO CHV 1995', gen_club_code(), 'Migrated club', NOW()
WHERE NOT EXISTS (SELECT 1 FROM clubs WHERE name = 'BFO CHV 1995');

DO $$
DECLARE bfo UUID;
BEGIN
  SELECT id INTO bfo FROM clubs WHERE name = 'BFO CHV 1995';

  -- Backfill matches.club_id
  UPDATE matches SET club_id = bfo WHERE club_id IS NULL;
  -- Backfill match_media.club_id
  UPDATE match_media SET club_id = bfo WHERE club_id IS NULL;

  -- Map admins -> club_members. Laura is admin; everyone else is member.
  INSERT INTO club_members (club_id, user_id, role)
  SELECT bfo,
         u.id,
         CASE WHEN LOWER(a.email) = 'lauragargar@hotmail.com'
              THEN 'admin' ELSE 'member' END
    FROM admins a
    JOIN auth.users u ON LOWER(u.email) = LOWER(a.email)
   WHERE NOT EXISTS (
     SELECT 1 FROM club_members m
     WHERE m.club_id = bfo AND m.user_id = u.id);

  -- Self-heal: if a previous run inserted Laura as 'member', upgrade.
  UPDATE club_members SET role = 'admin'
   WHERE club_id = bfo
     AND user_id = (SELECT id FROM auth.users
                    WHERE LOWER(email) = 'lauragargar@hotmail.com')
     AND role <> 'admin';

  -- Safety: ensure at least one admin exists.
  IF NOT EXISTS (SELECT 1 FROM club_members WHERE club_id = bfo AND role = 'admin') THEN
    UPDATE club_members SET role = 'admin'
    WHERE (club_id, user_id) IN (
      SELECT club_id, user_id FROM club_members
      WHERE club_id = bfo ORDER BY joined_at ASC LIMIT 1
    );
  END IF;
END $$;

COMMIT;
```

**Ordering / idempotency notes:**
- Uses `NOT EXISTS` and self-heal `UPDATE` to be safely re-runnable.
- Backfill `UPDATE`s touch only `NULL` rows, so reruns are no-ops.
- `ALTER COLUMN club_id SET NOT NULL` runs as a separate `010_*` script after the migration is verified zero-NULL.

---

## 5. Active Scorer Mechanism

### 5.1 Data model
Single `active_scorers` row per match with `last_activity` and a `version` integer. The presence of the row = the lock.

### 5.2 Acquire / reclaim — security definer RPC

```sql
CREATE OR REPLACE FUNCTION claim_active_scorer(
  _match_id UUID,
  _force BOOLEAN,
  _expected_version BIGINT
) RETURNS active_scorers AS $$
DECLARE row active_scorers;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM matches m
                 WHERE m.id = _match_id
                   AND is_club_member(m.club_id)
                   AND m.status = 'in_progress') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Auto-release stale (>10 min)
  DELETE FROM active_scorers
   WHERE match_id = _match_id
     AND last_activity < NOW() - INTERVAL '10 minutes';

  SELECT * INTO row FROM active_scorers WHERE match_id = _match_id;

  IF row IS NULL THEN
    INSERT INTO active_scorers(match_id, user_id)
    VALUES (_match_id, auth.uid())
    RETURNING * INTO row;
    RETURN row;
  END IF;

  IF row.user_id = auth.uid() THEN
    UPDATE active_scorers SET last_activity = NOW(),
                              version = version + 1
     WHERE match_id = _match_id RETURNING * INTO row;
    RETURN row;
  END IF;

  IF NOT _force THEN
    RAISE EXCEPTION 'locked_by_other' USING DETAIL = row.user_id::text;
  END IF;

  IF _expected_version IS NOT NULL AND row.version <> _expected_version THEN
    RAISE EXCEPTION 'version_conflict';
  END IF;

  UPDATE active_scorers
     SET user_id = auth.uid(),
         acquired_at = NOW(),
         last_activity = NOW(),
         version = version + 1
   WHERE match_id = _match_id RETURNING * INTO row;
  RETURN row;
END;$$ LANGUAGE plpgsql SECURITY DEFINER;
```

A second RPC `touch_active_scorer(match_id)` is called from score-mutation paths to refresh `last_activity`; it errors if the caller is not the current scorer.

### 5.3 Score-write enforcement
Add an `UPDATE` RLS policy on `sets`/`matches` that additionally requires:
```sql
EXISTS (SELECT 1 FROM active_scorers a
        WHERE a.match_id = sets.match_id AND a.user_id = auth.uid())
```
Writes from non-scorers fail at the DB level; the UI's "locked" mode is just visual.

### 5.4 Real-time channel
- Add `active_scorers` to the `supabase_realtime` publication.
- Client uses `supabase.channel('match:'+matchId).on('postgres_changes', { table: 'active_scorers', filter: `match_id=eq.${matchId}` }, ...)`.
- On UPDATE event with a different `user_id`: previous scorer's UI shows the "you have been reclaimed" pop-up. Other viewers update the "X is scoring" label.

### 5.5 Inactivity timeout
1. **Lazy cleanup:** every `claim_active_scorer` call deletes stale rows first.
2. **Scheduled job (recommended):** a `pg_cron` job every minute deletes stale rows. This causes a Realtime DELETE event so locked-view clients immediately become claimable.
3. **Client warning at 9 min:** a `setTimeout` keyed on `last_activity` fires the in-app warning. Reset on every `touch_active_scorer` success.

### 5.6 Race conditions
- Two clients reading version=N then both calling `claim_active_scorer(force=true, expected_version=N)`: PostgreSQL serializes the UPDATEs; the second one sees `version <> N` and raises `version_conflict`. UI shows "X has just become the active scorer."
- Two unclaimed claimants race: PK on `match_id` makes the second `INSERT` fail with unique violation; the second claim re-reads and returns the existing row.

---

## 6. Email Notifications

### 6.1 Service choice
**Recommendation: Resend.** Best-in-class Next.js DX, simple API, free tier covers low volume.

### 6.2 Trigger location
**Recommendation: Next.js server actions.** Tacking on `await sendEmail(...)` after each DB write keeps logic in one place.

### 6.3 Templates needed
1. **`new-join-request`** (to all admins of the target club) — "Nueva solicitud para unirse a {club}".
2. **`join-approved`** (to requester) — "Tu solicitud para unirte a {club} ha sido aprobada".
3. **`join-rejected`** (to requester) — "Tu solicitud para unirte a {club} no ha sido aprobada".

### 6.4 Env vars / config
```
RESEND_API_KEY=...
EMAIL_FROM=VolleyScore <noreply@volleyscore.app>
APP_URL=https://...
```
Add Resend SDK as a dep. Templates as React components rendered by `@react-email/render`.

### 6.5 Failure handling
Email send must not block the DB action. Wrap in try/catch and log; surface a non-blocking warning on failure.

---

## 7. Auth and Routing Changes

### 7.1 `auth-provider.tsx`
- Drop `isAdmin` and `volleyball-admin-{email}` localStorage cache.
- Keep `user`, `isLoading`, `signOut`.

### 7.2 New `club-provider.tsx`
- Loads `club_members` for `auth.uid()` on mount.
- Exposes: `memberships: {club, role}[]`, `activeClub`, `setActiveClub(clubId)`, `roleInActive`, `isAdminOfActive`, `isLoading`.
- Persists `volleyball-active-club` in localStorage; on load, validates the ID is still in `memberships` (handles "kicked from club" by falling back to first available or null).
- Auto-selects single club; otherwise leaves `activeClub = null` to trigger selector UI.
- Subscribes to Realtime on `club_members` filtered by `user_id = auth.uid()` to react to removals/role changes immediately.

### 7.3 Middleware (`lib/supabase/middleware.ts`)
- New protected list: `/home`, `/historial`, `/club/*`, `/clubs/*`, `/onboarding`.
- Membership gate (server-side):
  - Authenticated user with zero memberships and zero pending requests → redirect to `/onboarding`.
  - Authenticated user with zero memberships but a pending request → redirect to `/onboarding/pending`.
- `/live/*` exemption preserved.
- Old paths `/solicitudes`, `/solicitar-acceso` → 308 redirect to new equivalents.

### 7.4 Header (`authenticated-header.tsx`)
- Add `<ActiveClubBadge />`: if multi-club → interactive `<Select>`; if single-club → non-interactive label.
- `Solicitudes` nav item → `Solicitudes del club`, visible only when `roleInActive === 'admin'`. Add `Miembros` nav item, also admin-only.

---

## 8. UI Component Changes

### New pages
- `/onboarding/page.tsx` — choose: create or search.
- `/onboarding/pending/page.tsx` — list of pending requests.
- `/clubs/new/page.tsx` — club creation form.
- `/clubs/join/page.tsx` — search by name; fallback "Use code" tab.
- `/club/requests/page.tsx` — admin-only.
- `/club/members/page.tsx` — admin-only.

### New components
- `components/club-provider.tsx`
- `components/active-club-badge.tsx`
- `components/club-search.tsx`
- `components/join-by-code.tsx`
- `components/club-create-form.tsx`
- `components/club-members-list.tsx`
- `components/club-join-requests-list.tsx`
- `components/scoring/locked-banner.tsx`
- `components/scoring/reclaim-dialog.tsx`
- `components/scoring/timeout-warning.tsx`
- `lib/hooks/use-active-scorer.ts`
- `lib/hooks/use-memberships.ts`

### Repurposed
- `components/admin-requests-list.tsx` → `components/club-join-requests-list.tsx`.
- `app/(authenticated)/solicitudes/page.tsx` → `app/(authenticated)/club/requests/page.tsx`.
- `app/(public)/solicitar-acceso/page.tsx` → removed; flow moves inside the authenticated app at `/clubs/join`.

### Modified
- `app/(authenticated)/home/page.tsx` — read active club from context, write `club_id` and `created_by` on match insert, default `home_team` to active club's name (R8), gate score writes on `useActiveScorer`, render `<LockedBanner/>` and reclaim flow when not the scorer.
- `app/(authenticated)/historial/page.tsx` — filter by active club.
- `components/match-history-list.tsx`, `components/match-media-gallery.tsx` — pass `club_id` filter through.
- `components/public-live-score.tsx` — must use anon-only Supabase client.

---

## 9. Risks and Edge Cases to Test

1. **Last-admin guard.** Demote-self when only admin → DB raises, UI surfaces clean error. Try via API directly.
2. **RLS leaking via authenticated session on public live.** Logged-in user not a member of club X navigates to `/live/{matchId-of-X}`. Resolution: the public live page must use the anonymous Supabase client (no Authorization header).
3. **Stale localStorage active club.** User removed from club but localStorage still names it. `ClubProvider` validates and clears.
4. **Race on simultaneous reclaim.** Two tabs `claim_active_scorer(force=true, expected_version=N)` → second errors `version_conflict`.
5. **10-minute timeout boundary.** Verify with two browsers.
6. **Club switch while scoring.** Verify scorer remains on switch, returns within 10 min, still holds lock.
7. **Pending request to a club where the user has been rejected 3 times.** Insert rejected by app + DB.
8. **Match creation under a club where membership was just revoked.** RLS on `matches.INSERT` blocks.
9. **Backfill non-NULL constraint.** Migration script must verify zero NULLs before `SET NOT NULL`.
10. **Realtime publication.** `ALTER PUBLICATION supabase_realtime ADD TABLE active_scorers, club_members, club_join_requests;`.
11. **Email send fails silently.** Yank API key — DB writes still succeed; admin sees soft warning.
12. **Public live anon query for sets.** Verify with curl using only `apikey: <anon>`.
13. **Onboarding loop.** A user with one rejected request and zero memberships should land on `/onboarding`, not in a redirect loop.
14. **Header rendering before ClubProvider has resolved.** Render skeleton.
15. **Unique club name collision under concurrency.** UI shows "Name taken".
16. **Numeric code collision.** `gen_club_code` retries.

---

## 10. Open Decisions

1. **Numeric club code format.** Proposed: 6-digit zero-padded. **Needs confirmation.**
2. **Email provider.** Resend recommended. **Needs confirmation + API key.**
3. **Pending `admin_requests` rows at migration time.** Recommendation: drop, plus email impacted users a one-line "please re-submit via the new flow". **Needs confirmation.**
4. **Existing approved-but-not-yet-logged-in admins.** Recommendation: skip in initial migration; add an `auth.users → club_members` post-signup hook that auto-adds them as a BFO member if their email was in the legacy `admins` table. **Needs confirmation.**
5. **Active scorer cron vs lazy-only.** pg_cron requires enabling the extension. Lazy cleanup is sufficient functionally; cron just provides instant unlock via realtime DELETE event. **Needs decision.**
6. **Match `created_by` backfill.** Existing rows backfilled to NULL (allowed) or to the BFO admin? **Needs confirmation.**
7. **Re-application limit (3 attempts).** Reset after a configurable window? Plan assumes never resets unless an admin reopens. **Needs confirmation.**
