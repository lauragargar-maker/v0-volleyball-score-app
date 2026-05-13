# Backlog

Unscheduled improvements captured for future consideration.
Items are not prioritised — order of entry does not imply order of execution.

---

## UX / Navigation

### B1 — Club name not visible in header on mobile
The active club badge in the header is not shown on small screens. Worth
investigating a compact representation (abbreviated name, initials chip, or
logo — see B5) that fits in the mobile nav bar without crowding the hamburger
menu or other controls.

### B2 — No way to create a second club from the home screen
Once a user has created their first club, the home screen only surfaces the
"start a match" call to action. There is no path back to club creation or any
other account-level action. The home screen needs an extensible "quick actions"
area that surfaces contextual actions such as: create another club, invite
members, view club settings.

### B3 — "Solicitudes" nav link leads to a 404
The nav item is shown to club admins but the `/club/requests` page does not
exist yet (Phase 4). Until the page is built, either replace the link with a
"coming soon" placeholder page or hide the nav item behind a feature flag so
it is not shown to users in production.

### B4 — Super-simple unauthenticated match creation flow
New (anonymous) users have no hook to try the product before signing up.
Consider a lightweight "quick match" flow accessible without login — enter
two team names and start scoring. The session could be ephemeral (localStorage)
or optionally saved to an account afterwards. This is the main acquisition
lever for converting visitors into registered users.

### B6 — Authenticated home view does not auto-update when a match ends
The home screen's Realtime subscription currently refreshes the UI when a
score is updated (set scores, sets won) but it is unclear whether it also
triggers a re-render when a match transitions to `finished` or `cancelled`
status without a concurrent score change. Viewers on the authenticated home
screen may need to manually refresh to see a match disappear from the
in-progress section and appear in history. Investigate the Realtime channel
filter and ensure `status`, `winner`, `finished_at`, and `cancellation_reason`
changes all propagate correctly to every connected client.

---

## Club profile

### B5 — Club icon / image
Allow club admins to upload a logo or avatar image for their club.
Supabase Storage already exists in the project (used for match media), so
the upload infrastructure is in place. The image would:
- Replace or complement the club name in the header on all screen sizes
- Directly address B1 on mobile (small logo fits where a name does not)
- Appear in club search results (Phase 3) and member management pages (Phase 4)
