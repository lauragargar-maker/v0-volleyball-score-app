# Finalized PRD: VolleyScore — Multi-User, Multi-Club

**Version:** 1.3
**Date:** 2026-05-07
**Status:** Approved — moving to planning

---

## Glossary

| Term | Definition |
|---|---|
| **Club** | A volleyball organization/entity that owns matches and has members. Previously called "Team" in the codebase. |
| **Playing team** | The two sides within a match (home/away). Remains as plain strings in match records. Not the same as Club. |
| **Member** | A logged-in user who belongs to a club with standard (non-admin) privileges. |
| **Club Admin** | A member of a club with elevated privileges: can approve/reject join requests, manage members, and promote/demote other members. |
| **Active Club** | The club selected by a user for their current session. |
| **Active Scorer** | The single member who currently holds edit rights for an in-progress match. |

---

## User Roles

Three user types exist in the system. A single user can have different roles across different clubs (e.g., Admin of Club A and Member of Club B).

### Anonymous User (not logged in)
- Access to: landing page, public live score pages.
- No access to: any authenticated content.

### Member (logged in, standard)
**Global capabilities (not club-scoped):**
- Register and log in via email OTP.
- Create a new club (becomes its first Admin).
- Request to join an existing club.
- View their pending join request status.

**Per-club capabilities (when a club is selected):**
- View match history for that club.
- Create a new live score match under that club.
- Score and manage an in-progress match under that club (subject to Active Scorer rules in R11).
- Upload, view, and delete their own media for that club's matches.

### Club Admin (logged in, elevated within a specific club)
All Member capabilities for that club, plus:
- Approve or reject pending join requests for that club.
- Remove any member from the club (including other Admins), subject to the last-admin constraint in R4.
- Promote a Member to Admin within the club.
- Demote another Admin to Member within the club.

**Note on super-admin:** No application-level super-admin role is included in this iteration. Edge cases that a super-admin would solve (e.g., global user management, cross-club oversight) are out of scope. The last-admin constraint (see R4) prevents orphaned clubs.

---

## Requirements

### R1 — Club-Scoped Historical Data Access

A logged-in user shall only see matches, sets, and media belonging to clubs they are an approved member of.

- A user with approved membership in at least one club sees only the active club's data.
- A user with no approved memberships (new user, or all requests pending/rejected) sees an onboarding screen prompting them to create or join a club.
- A user with a pending join request sees a status message confirming: *"Your request to join [Club Name] has been received and is pending approval."* No club data is visible until approved.
- A user who is removed from a club loses access to that club's data immediately upon their next request. No grace period.

---

### R2 — Data Isolation Between Clubs

A user must not be able to access, view, or infer any data (matches, sets, media, scores) belonging to clubs they are not an approved member of.

- Isolation is enforced at the database level via Supabase Row-Level Security (RLS) policies, not only at the UI level. UI restrictions are secondary.
- Direct URL navigation to a match record belonging to a different club returns a 404 or generic access-denied response — not a redirect to login, which would confirm the resource exists.
- The public live score page (`/live/[matchId]`) is the **sole exception**: it remains fully public and accessible to anonymous users. No RLS restriction applies to the data exposed through the public live score endpoint. This is intentional to maximize shareability and awareness.

---

### R3 — Club Discovery and Join Request

Any authenticated user can request to join an existing club. The user can search for a club in two ways:

1. **By name:** A searchable autocomplete input listing all existing club names.
2. **By numeric code:** A fallback input for a short numeric code generated at club creation and shareable by club admins. This handles cases where the club name search yields no result or is ambiguous.

**Membership and request constraints:**
- A user can be a member of 0, 1, or many clubs simultaneously.
- A user can have multiple pending join requests open at the same time (one per different club).
- A user cannot have more than one pending request for the **same club** at a time. Duplicate requests to the same club while a pending request exists are blocked with a clear message.
- The join request flow is designed to handle **one club at a time**: the user searches, selects one club, and submits. There is no bulk or multi-select flow. If a user wants to request joining a second club, they repeat the flow. The UX is optimized for the most common case (joining a single club).
- A user may re-apply to the same club after rejection up to **2 times** (3 total attempts for that club). After the third rejection, only a Club Admin of that club can manually re-open the request. The rejection counter is per user per club; rejection by Club A does not affect requests to Club B.
- If no clubs exist, the search returns an empty state with a prompt to create one.
- Users can request to join clubs both during the registration flow and post-registration from within the app.

---

### R4 — Join Request Approval and Member Management

Only Club Admins can approve or reject join requests for their club.

**Join request flow:**
- All admins of a club receive an email notification when a new join request is submitted for that club.
- Any admin of the club can approve or reject any pending request for that club.
- When a request is approved or rejected, the requesting user receives an email notification.
- Approved users are immediately added as Members of the club.

**Member management:**
- An Admin can remove any member from the club, including other Admins.
- **Last-admin constraint:** The last remaining Admin of a club cannot be removed or demoted. The system must block this action with an explanatory message, ensuring every club always has at least one Admin. This guard applies at both the UI and database/API levels.
- An Admin can promote any Member to Admin within the club.
- An Admin can demote any other Admin to Member within the club, subject to the last-admin constraint.

**Club creation:**
- Any authenticated user can create a new club. The creator is automatically added as the first Admin of that club.
- At creation, the system generates a unique short numeric code for the club, which admins can share to facilitate join requests.
- Clubs cannot be deleted in this iteration.

---

### R5 — Club Selector and Session Context

**Single-club users:** If a user belongs to exactly one club, that club is automatically selected. No selector is shown.

**Multi-club users:** A club selector is presented when the user logs in (or when no active club is set). The user picks which club to work with for the session.

**Switching clubs:**
- The active club is always visible in the navigation header for all logged-in users with at least one membership. If the user belongs to more than one club, this appears as an interactive selector they can click to switch clubs. If the user belongs to exactly one club, this appears as a non-interactive label (tag/text) showing the club name — no selector is rendered.
- If a user switches clubs while a match is in progress (being scored), a warning is shown: *"You have an unfinished match in [Current Club Name]. You can return to it later."* The user can proceed or cancel.
- Switching clubs does not discard the in-progress match. The match remains in its current state under its club and can be resumed when the user selects that club again.
- If the user switching clubs is the active scorer of the in-progress match, they do not immediately lose active scorer status. The 10-minute inactivity timeout (R11) applies as normal. If they return to that club before the timeout elapses and no one has reclaimed, they remain the active scorer.
- The last-used club is remembered across sessions (persisted in localStorage or equivalent).

**Per-club feature scope when a club is selected:**
- View history for that club.
- Add and view multimedia for that club's matches.
- Create a new live score match for that club.
- Manage (view, edit, score) an in-progress match for that club, subject to Active Scorer rules (R11).
- Admin-only features (approve/reject requests, manage members, promote/demote) are visible only when the active club is one where the user is an Admin.

---

### R6 — Club Creation

- Any authenticated user can create a new club via the app UI.
- Clubs can also be pre-created directly in the database (manual DB insertion), for migration and operational purposes.
- Required fields for a club:
  - **Name:** must be unique across all clubs (user-provided).
  - **Numeric code:** short, unique, auto-generated at creation — not entered by the user.
  - **Created at:** timestamp, auto-populated at creation — not entered by the user.
- Optional field: description.
- Clubs cannot be deleted in this iteration.

---

### R7 — Role Model Summary

| Capability | Anonymous | Member | Club Admin |
|---|---|---|---|
| View landing page | Yes | Yes | Yes |
| View public live score | Yes | Yes | Yes |
| Log in / register | — | Yes | Yes |
| Create a club | — | Yes | Yes |
| Request to join a club | — | Yes | Yes |
| View own club's match history | — | Yes | Yes |
| Create and score a match | — | Yes | Yes |
| Upload / manage media | — | Yes | Yes |
| Approve / reject join requests | — | — | Yes (own club) |
| Remove members | — | — | Yes (own club) |
| Promote / demote admins | — | — | Yes (own club) |

---

### R8 — Match Ownership

- Every match belongs to exactly one club.
- Only members (including admins) of the owning club can create, score, cancel, or attach media to that match.
- A match can never be co-owned by two clubs.
- When creating a new match, the `home_team` field is pre-filled with the active club's name as the default value. This default is editable by the user during match creation.
- The `home_team` and `away_team` fields remain as plain text strings and are not linked to any Club entity.

---

### R9 — Public Live Score

- The `/live/[matchId]` page remains fully public.
- No authentication or club membership is required to view a live score.
- Any user (anonymous or logged in) with the link can access it.
- This behavior is intentional to enable shareability and audience reach.

---

### R10 — Data Migration Script

A one-time SQL migration script must be produced and run against the Supabase database to migrate existing data to the new schema.

**Migration rules:**
- Create a club named **"BFO CHV 1995"** with an auto-generated numeric code.
- Assign all existing matches, sets, and media to this club.
- Assign the user **lauragargar@hotmail.com** as **Admin** of this club.
- Assign all other existing admin users as **Members** (standard role) of this club.
- The script must be idempotent (safe to re-run without duplicate side effects).

---

### R11 — Active Scorer Concurrency Control

To prevent simultaneous score editing on the same match, each in-progress match has an **Active Scorer**: a single member of the owning club who currently holds edit rights for the score. All other members see the match in read-only ("locked") mode.

**Becoming the active scorer:**
- When a member creates a match, they automatically become the active scorer of that match.
- When a member opens the scoring view of an **unclaimed** in-progress match (no current active scorer, e.g., after a timeout), they become the active scorer immediately with no warning.
- When a member opens an in-progress match that already has an active scorer, they see the score in **read-only mode** with a locked indicator and the identity of the current active scorer (e.g., *"Laura is managing the score"*).

**Reclaiming the active scorer role:**
- A member viewing a locked match can click "Reclaim scoring."
- A confirmation warning is shown: *"[Current Active Scorer Name] is currently managing the score. If you continue, they will lose their ability to edit and will be notified."* The user can cancel or continue.
- If the user continues, they become the new active scorer. The previous active scorer:
  - If currently in the app: receives a real-time pop-up notification: *"[Name] has reclaimed scoring of this match. You can now only view the score."*
  - If not currently in the app: receives an in-app notification on their next visit.
- The same reclaim flow applies to both regular Members and Club Admins. Admins do not bypass the warning.

**Race condition on simultaneous reclaim:**
- If two users click "reclaim" near-simultaneously, the first write wins. The losing reclaimer sees a message: *"[Winner's Name] has just become the active scorer."*

**Inactivity timeout:**
- If the active scorer does not update the score for **10 minutes**, the lock is automatically released and the match becomes unclaimed.
- At 9 minutes of inactivity (1 minute before expiry), the active scorer sees an in-app warning: *"Your scoring session will expire in 1 minute due to inactivity."*
- Inactivity is measured as the absence of score updates (point added, point removed, set confirmation). Other app interactions do not reset the timer.
- Once unclaimed, any club member can become the active scorer.

**Club switch and active scorer:**
- If the active scorer switches their active club, they do not immediately lose active scorer status. The 10-minute inactivity timeout applies as normal.
- If they return to the original club before the timeout elapses and no one has reclaimed, they remain the active scorer.

**End of active scorer role:**
- The active scorer concept ends when the match is finished or cancelled. No lock exists on completed matches.

---

## Open Items to Resolve in Planning

1. **Email notifications:** Supabase does not send custom emails natively beyond OTP. An email service (e.g., Resend, SendGrid) or Supabase Edge Functions will be needed for join request and approval/rejection notifications.

2. **Numeric club code format:** Length and uniqueness strategy to be defined during planning (e.g., 6-digit numeric).

3. **RLS policy for public live score:** The live score endpoint must read match data without a session, while all other match queries remain session-scoped to club membership.

4. **In-progress match resume UX:** When a user returns to a club with an unfinished match, the app should surface it prominently.

5. **Last-admin removal guard:** Must be enforced at both UI level (disabled action + message) and database/API level.

6. **Active scorer real-time delivery:** The active scorer notification (reclaim pop-up, timeout warning) requires a real-time channel per match. Supabase Realtime is the likely mechanism, consistent with the existing live score implementation.
