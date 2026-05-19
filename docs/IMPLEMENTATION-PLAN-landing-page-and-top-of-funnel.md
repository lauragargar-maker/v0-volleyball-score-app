# Implementation Plan: Landing Page and Top-of-Funnel Flows

**Source PRD:** [PRD-landing-page-and-top-of-funnel.md](PRD-landing-page-and-top-of-funnel.md) v1.1
**Status:** Awaiting approval — no implementation work has started.

## Strategy

Four phases. Each phase ends with a Vercel-deployable green build. Phases 1 and 4 are user-visible; Phases 2 and 3 are dark (feature-flag gated, no landing CTA, no public route) so the larger Instant Score work can be merged in shippable increments without exposing half-built UX.

| Phase | Scope (PRD reqs) | User-visible? | Behind flag? | Deployable independently? |
|---|---|---|---|---|
| 1 — Auth split, landing CTA hierarchy & Instant Score waitlist | R1, R2, R3, R4, R5–R15, §11.1–§11.3 copy + waitlist modal (new, non-PRD addition) | Yes | No | Yes |
| 2 — Anonymous match infrastructure | R16, R17, R18, R19, R23 (expiry) | No (dark) | Yes (`NEXT_PUBLIC_INSTANT_SCORE`) | Yes |
| 3 — Save flow, post-match summary, escalated banner | R20, R20.1, R21, R22, R27, §11.4–§11.6 copy | No (still dark) | Yes (same flag) | Yes |
| 4 — Instant Score launch | Expose CTA in hero, remove flag | Yes | Flag removed | Yes |

## Current-state findings (grounding for the plan)

These were verified by reading the repo and they shape the work below — flag if any read is wrong.

1. **Login already uses Supabase magic-link OTP with `shouldCreateUser: true`** ([app/(public)/auth/login/page.tsx:44](app/(public)/auth/login/page.tsx#L44)). There is no separation between login and register today; the first OTP for a new email auto-creates the account. Phase 1 must split these by switching login to `shouldCreateUser: false` and introducing a dedicated register flow.
2. **`/solicitar-acceso` exists** ([app/(public)/solicitar-acceso/page.tsx](app/(public)/solicitar-acceso/page.tsx)) but its purpose is the "request access to an existing club" surface from `PRD-multi-user-multi-club.md`, **not** registration. It is unrelated to this PRD and stays as-is.
3. **`matches.club_id` is NOT NULL UUID** referencing `clubs(id)` ([scripts/008_add_club_id_columns.sql:10](scripts/008_add_club_id_columns.sql#L10)). Anonymous matches require either (a) making `club_id` nullable + adding `anonymous_session_id text`, or (b) a separate `anonymous_matches` table. Recommend (a) so the existing scoring UI and live-score page work unchanged with one branch in queries. Decision needed before Phase 2 — flagged as open item 1 in §"Open items" below.
4. **RLS is in force** on matches per multi-club PRD R2. Phase 2 needs a new policy for anonymous matches keyed off `anonymous_session_id` matching the request's cookie value.
5. **Onboarding screen exists** at [app/(authenticated)/onboarding/page.tsx](app/(authenticated)/onboarding/page.tsx) — Phase 1 register flow redirects there after OTP verification (R13).
6. **Turnstile captcha is wired** into login email step. Same captcha must guard the new register email step.
7. **Live score share link `/live/[matchId]`** is already public ([app/(public)/live/[matchId]/page.tsx](app/(public)/live/[matchId]/page.tsx)). Anonymous matches will reuse it; the page already reads from the matches table and does not require auth (R19).
8. **`authenticated-header.tsx`** sticky header (`sticky top-0 z-50 ... backdrop-blur`) is the visual reference for the R20 banner.

---

## Phase 1 — Auth split and landing CTA hierarchy

**Goal:** clean Login vs Register separation with pre-check divert in both directions; landing exposes Login (nav) and Register (hero). Instant Score is not introduced yet.

### Deliverables

- **New `email-exists` server action** (lives in `app/(public)/auth/_actions.ts` or `lib/auth.ts`). Inputs: email. Output: boolean. Implementation: use Supabase admin RPC or a SECURITY DEFINER function `public.email_exists(email text) returns boolean` that queries `auth.users`. Migration script `012_email_exists_fn.sql`.
- **Login flow change** ([app/(public)/auth/login/page.tsx](app/(public)/auth/login/page.tsx)):
  - Submitting email runs `email-exists` first.
  - If false → redirect to `/auth/register?email=<urlencoded>` with the divert message in a query param or session-stored flash.
  - If true → call `signInWithOtp` with `shouldCreateUser: false`.
  - Add a "¿Email incorrecto?" link on the OTP step (R7) — replaces / augments the existing "Cambiar email" button (already present, just rename per §11.2).
- **New `/auth/register` route** ([app/(public)/auth/register/page.tsx](app/(public)/auth/register/page.tsx)):
  - Two-step form: email + optional name, then OTP.
  - Email submission runs `email-exists`. If true → redirect to `/auth/login?email=...` (R10.1 divert).
  - On submit: `signInWithOtp` with `shouldCreateUser: true`, plus `data: { display_name }` so the optional name is stored in `auth.users.user_metadata` (R11).
  - On OTP verify: redirect to `/onboarding`.
  - Reuses Turnstile captcha.
- **Landing page CTA update** ([app/(public)/page.tsx](app/(public)/page.tsx)):
  - Keep top-nav "Iniciar sesión" button (rename if needed for casing — current is "Iniciar Sesion").
  - Hero exposes **two** primary CTAs paired with equal weight:
    - `"Crear cuenta"` — links to `/auth/register`.
    - `"Crear marcador instantáneo"` — **placeholder for the real Phase 4 launch**: opens an "interest capture" modal (see "Instant Score waitlist modal" below). The CTA is visually identical to the final Phase 4 version so the hero looks complete from day one.
  - The existing "Iniciar Sesión" hero CTAs (lines ~70 and ~167) are removed; Login lives only in the top nav.
  - Replace mixed-case "Iniciar Sesion" with "Iniciar sesión" per §11.1.

- **Instant Score waitlist modal** (new component `components/landing/instant-score-waitlist-modal.tsx`):
  - Triggered by the hero "Crear marcador instantáneo" CTA in Phase 1–3 (replaced by the real flow in Phase 4).
  - Title: `"Próximamente"`.
  - Body: `"Estamos terminando esta funcionalidad. Déjanos tu correo y te avisamos en cuanto esté lista."`
  - Single optional email input (`type=email`, not required by the form).
  - Primary button: `"Avísame"` — submits the email to a server action `joinInstantScoreWaitlist({ email })` and closes the modal with a success toast `"¡Gracias! Te avisaremos."`. Disabled until the input is a syntactically valid email; toggling to "Cerrar" if the input is empty (see below).
  - Secondary button / close affordance: `"Cerrar"` (or the standard modal X) — closes without submitting. Always available.
  - The button states: empty input → only "Cerrar" visible; valid email entered → "Avísame" appears as the primary action with "Cerrar" still available as secondary.
  - Reuses Turnstile captcha to prevent abuse (same site key as login/register).
- **Waitlist storage** (migration `012b_instant_score_waitlist.sql`, applied alongside Phase 1):
  - Table `instant_score_waitlist (id uuid pk default gen_random_uuid(), email citext not null, created_at timestamptz not null default now(), notified_at timestamptz)`.
  - Unique index on `lower(email)` so the same email can't enqueue twice (idempotent submit returns success regardless).
  - RLS: anon can `INSERT` only; no `SELECT` policy for anon/auth users. Admin / service-role reads via Supabase studio.
- **Server action** `joinInstantScoreWaitlist`:
  - Validates email format server-side, validates Turnstile token, upserts on email conflict (so retries succeed silently).
  - Returns `{ ok: true }` whether the email was new or already enqueued — never reveal pre-existing entries.
- **Authenticated visitor auto-redirect (R1)**: verify [middleware.ts](middleware.ts) already redirects logged-in users hitting `/` to `/home` / last-club. If not, add it. (One-paragraph audit during Phase 1; expected to be small.)
- **Spanish copy**: apply §11.1, §11.2, §11.3 strings throughout.

### Risks

- **Supabase `email-exists` semantics**: querying `auth.users` requires a SECURITY DEFINER function or admin client; the function must be carefully scoped (return boolean only, no leak). Add a per-IP rate limit to prevent email-enumeration abuse — captcha already mitigates UI abuse but the action endpoint should be rate-limited too.
- **Existing users mid-flow**: anyone who hits the OTP screen during deploy could see a different flow on retry. Acceptable: OTPs are short-lived; impact minimal.
- **Magic-link `shouldCreateUser: false`** returns a generic error if the user does not exist. We pre-check first so the user never hits that error path in normal use, but the catch-all error UI must still handle it gracefully.

### Testing

- Unit: `email-exists` returns true / false / handles malformed input.
- Unit: `joinInstantScoreWaitlist` — new email enqueues; duplicate email returns ok without error; invalid Turnstile rejects; invalid email format rejected.
- E2E (Playwright if present; otherwise manual): login with existing email → reaches OTP; login with new email → diverts to register with email pre-filled; register with existing email → diverts to login with email pre-filled; register with new email → OTP → onboarding; authenticated visitor at `/` → `/home`; waitlist modal opens from hero CTA, submits successfully, closes without submission also works.
- Manual: copy review against §11; visual check that the placeholder CTA is indistinguishable from the eventual Phase 4 CTA.

### Deploy criteria

- Build + tests green.
- Manual smoke on preview deploy: all four divert directions work; Turnstile renders; auto-redirect works.
- Rollback plan: revert PR. No schema breaking changes (migration is additive — a new function).

---

## Phase 2 — Anonymous match infrastructure (dark)

**Goal:** anonymous users can create, score, and share an anonymous match end-to-end. **Not yet exposed on the landing page**; gated behind `NEXT_PUBLIC_INSTANT_SCORE=false` in prod.

### Deliverables

- **Schema migration** (`scripts/013_anonymous_matches.sql`):
  - `ALTER TABLE matches ALTER COLUMN club_id DROP NOT NULL;`
  - `ALTER TABLE matches ADD COLUMN anonymous_session_id text;`
  - Partial unique constraint: at most one `in_progress` match per `anonymous_session_id`. (`CREATE UNIQUE INDEX ... WHERE status = 'in_progress' AND anonymous_session_id IS NOT NULL`.)
  - `CHECK ((club_id IS NOT NULL) OR (anonymous_session_id IS NOT NULL))` — every match is either club-owned or anon-owned, never neither.
  - Index on `anonymous_session_id`.
- **New RLS policies on `matches`** (and `sets`, `match_media` if they need an analogous rule — likely just matches and sets; match_media is auth-only):
  - Allow SELECT / INSERT / UPDATE when `anonymous_session_id` equals the request's cookie value (read from a header or session var the server action sets).
  - Public live-score read continues to work unchanged (R19); the existing `/live/[matchId]` policy already permits anon reads.
- **Cookie-based anon session**: server action that issues a long-lived `anon_session_id` cookie (HttpOnly, SameSite=Lax) on first visit to the Instant Score entry point. Cookie name e.g. `vs_anon_session`.
- **Instant Score entry route** (gated by env flag): `app/(public)/instant/page.tsx` — POSTs to a server action `createAnonymousMatch`. The action:
  - Reads/creates the anon cookie.
  - Looks up an existing in-progress anonymous match for this session id. If found → redirect to it (R18 device resumption — Option A path).
  - If the most recent anon match is finished → create a new one (E10).
  - Otherwise → create a new one.
- **Anonymous match scoring page**: `app/(public)/instant/[matchId]/page.tsx`. Reuses the existing scoring components from authenticated matches with a thin wrapper. No "scorer lock" complexity — anonymous matches have implicit single-scorer ownership via the cookie.
- **Sticky save banner R20 (in-progress variant only)**: new component `components/scoring/anonymous-save-banner.tsx`. In Phase 2 the "Guardar partido" button opens a placeholder dialog saying `"Próximamente"` — the real save flow ships in Phase 3. *(Alternative: omit the banner entirely until Phase 3. Recommend: include the banner visually but stub the button — that way Phase 3 is a single behavioral swap, no layout change.)*
- **Share link reuse**: confirm `/live/[matchId]` works for anonymous matches without modification (it should, since the page only reads match data and RLS now permits anon reads).
- **Expiry job (R23)**: pg_cron schedule `daily` that runs `DELETE FROM matches WHERE anonymous_session_id IS NOT NULL AND updated_at < now() - interval '7 days'`. Migration `014_anonymous_match_expiry.sql`. If pg_cron is not available in the project's Supabase tier, fallback: a Vercel cron route invoking a service-role action.
- **Flag plumbing**: read `NEXT_PUBLIC_INSTANT_SCORE` in the landing page and in any place that links to `/instant`. In Phase 2 the flag is `false` in prod and `true` in preview/local so the team can dogfood.

### Risks

- **Schema migration on a live `matches` table**: dropping NOT NULL is safe (no row rewrite). Adding the column is safe. Partial unique index could fail to build if duplicate in-progress anonymous matches existed — but no anonymous matches exist yet, so the index builds clean.
- **RLS coverage**: must verify no anon user can SELECT a match they don't own beyond the public live-score path. Add explicit tests.
- **Cookie strategy**: ensure the cookie is set server-side (Next.js Route Handler or Server Action), not client-side, so it's HttpOnly. Verify it survives across the share-link → return flow.
- **Reuse of scoring components**: today the scoring UI assumes an authenticated user and a `club_id`. Audit `components/live-score.tsx` and related for assumptions; refactor minimally.

### Testing

- Migration applied on a staging DB; check the partial unique index, check constraint, and RLS via the SQL editor with the service role and an anon role.
- E2E with flag enabled in preview: create anon match → score it → share link works → returning to landing redirects back into the match → ending the match transitions status → starting a new instant score after end creates a brand-new match.
- RLS regression: confirm authenticated users with no club membership still see exactly what multi-club PRD R1/R2 says they should.

### Deploy criteria

- Build + tests green. Flag is `false` in prod. Preview deploy verifies end-to-end with flag `true`.
- Rollback: turn the flag off (instant), then revert the PR. Schema changes are additive and do not require rollback.

---

## Phase 3 — Save flow, post-match summary, escalated banner (dark)

**Goal:** anonymous users can save their match to a club via the full R20 flow; finished matches get the R27 summary view with the R20.1 escalated banner. Still dark — `NEXT_PUBLIC_INSTANT_SCORE` remains `false` in prod, but Phase 3's PR makes the feature complete.

### Deliverables

- **Save flow UI** (`app/(public)/instant/[matchId]/save/page.tsx` or a modal within the scoring page — recommend modal to keep the match accessible during retries per R21):
  - Step 1 — Email entry with `email-exists` pre-check (reuses Phase 1 action).
  - Step 2 — OTP entry. Pre-check result determines `shouldCreateUser` setting (login path if exists, register path if new).
  - Step 3 — Club selection:
    - Existing user, multi-club: picker (reuse a list component from `/home` if available).
    - Existing user, single club: auto-select with `"Guardar en otro club"` override link.
    - New user: redirect through the existing `/onboarding` create-club flow with a "save the pending match after creating the club" continuation token.
  - Step 4 — Server action `saveAnonymousMatch({ matchId, clubId, userId })` that flips `club_id` from NULL to the chosen club, sets `created_by` to the authenticated user, and clears `anonymous_session_id`. Wrapped in a transaction.
  - Step 5 — Redirect to `/historial` (match history).
- **Replace the Phase 2 "próximamente" stub**: the banner's `"Guardar partido"` button now opens the save flow.
- **Natural-moment save prompts** (R20): hook into the scoring component's "end of set" and "end of match" lifecycle to surface dismissable dialogs with copy from §11.4. "Return from share" prompt fires when the user navigates back from the share screen (or when the share dialog closes if it's in-app).
- **Post-match summary view (R27)**: when an anonymous match transitions to `status = 'finished'`, the scoring page renders a new component `components/scoring/anonymous-post-match-summary.tsx` instead of the scoring controls. Layout per R27: team names, final set score, set-by-set, date, `"Compartir resultado"`, `"Crear marcador instantáneo nuevo"`. Save action remains in the (now escalated) sticky banner.
- **Escalated banner state (R20.1)**: the `anonymous-save-banner` component switches to its escalated variant when the match status is `finished`. Stronger visual emphasis (token TBD with design — `bg-destructive/10` is a reasonable starting point), copy per §11.4 escalated rows, non-dismissable.
- **"Iniciar sesión" / "Crear cuenta" on landing redirects after Phase 3**: per R22, the anonymous match is **not** auto-linked. No code change needed beyond confirming that the auth flows from Phase 1 do not introspect the anon cookie.

### Risks

- **OTP-during-save state preservation**: if the user closes the modal mid-OTP, R21 requires retry to work as long as the scoring session is alive. The match ID is in the URL; the modal can restore from URL + email param. Test carefully.
- **Edge case: user enters an email that's signed-in on another tab** (E5). Per the PRD, this is observe-then-decide; we ship without special-case handling but log the occurrence.
- **Atomic save**: `saveAnonymousMatch` must be transactional; partial state (club_id set but anonymous_session_id still set) would create double-ownership. Use a single UPDATE statement with both column changes.
- **Onboarding continuation**: routing a user through onboarding-create-club and then back into the save-and-redirect requires either a session-stored "pending save" intent or a query-param token. Recommend a short-lived signed token in the URL.

### Testing

- E2E with flag enabled: every branch of Step 3 (multi-club, single-club, new-user-creates-club). Save failure retry. Natural-moment prompts at end-of-set, end-of-match, return-from-share.
- Regression: ensure authenticated users' match save / scoring is unaffected.

### Deploy criteria

- Build + tests green. Flag still `false` in prod; preview deploy verifies end-to-end.
- Rollback: flag off, revert PR. Schema changes (column flip behavior) are reversible by re-NULLing `club_id` and re-setting `anonymous_session_id` — but we should not need to.

---

## Phase 4 — Instant Score launch

**Goal:** flip the feature on. Hero now exposes the second primary CTA, and Instant Score is generally available.

### Deliverables

- **Landing page hero updated** ([app/(public)/page.tsx](app/(public)/page.tsx)): hero already shows two primary CTAs from Phase 1; the only change here is that `"Crear marcador instantáneo"` now routes to the real Instant Score entry point (server action `createAnonymousMatch` / `/instant`) instead of opening the waitlist modal. Hero supporting lines from §11.1 added under each CTA if not already present.
- **Retire the waitlist modal**: remove the modal component, its trigger wiring on the landing CTA, and the `joinInstantScoreWaitlist` server action. The `instant_score_waitlist` table is **kept** so the captured emails remain available for outreach; only the write path is removed.
- **Notify waitlisted users** (operational, not a code task): one-shot manual export of `instant_score_waitlist` and outbound email "ya está disponible." Mark `notified_at` after the send. Tracked outside this plan.
- **Remove the env flag**: delete the `NEXT_PUBLIC_INSTANT_SCORE` guards from the landing and `/instant` route. Keep them in code briefly behind a config constant if you want a fast off-switch — recommended for the first week after launch.
- **Final copy pass and visual polish**: design review of the escalated banner emphasis token (open item 12.4 from the PRD), supporting lines, and post-match summary styling. Captured in a single design-QA pass.
- **Empty-handed test**: open a fresh incognito session, click Instant Score, score a match, share, end, save with a new email, end up in match history.

### Risks

- **First-week traffic surprises**: monitor for anonymous-match volume, save conversion, RLS errors. Have the kill-switch (flag) reachable for 1 week post-launch.

### Deploy criteria

- Build + tests green.
- Pre-flight smoke on production deploy (open the landing in private window, walk the full anonymous → save funnel).
- Rollback: flip flag off (or revert hero CTA commit).

---

## Decisions for Phase 2 and beyond (locked)

1. **Anonymous match storage shape** — Nullable `club_id` + new `anonymous_session_id` column on the existing `matches` table.
2. **Expiry mechanism** — Use Supabase `pg_cron`. Already in use on this project for other automations. To verify at Phase 2 kickoff: free-tier `pg_cron` runs jobs as the `postgres` role, supports standard cron syntax with a minimum granularity of one minute (daily is well within limits), and has no per-job cost on the free tier. Action item at Phase 2 kickoff: re-read the Supabase pg_cron docs and confirm no recent changes to free-tier limits before scheduling.
3. **Route slugs** — `/instant` for entry / resume, `/instant/[matchId]` for the active scoring page.
4. **Anonymous cookie lifespan** — **8 days** for `vs_anon_session`. One day longer than the 7-day match expiry (R23) so the cookie outlives the data by a single day; after that, the user is naturally routed back to the landing page and nudged toward authenticating. Aligns with the product goal of converting anonymous users.

## Cross-cutting non-goals (out of scope for this plan)

- Analytics / event instrumentation (handled separately per PRD §1).
- ToS / Privacy Policy acceptance (backlogged).
- Join-existing-club flow (separate PRD).
- Authenticated `/home` redesign — see `PRD-authenticated-home-redesign.md` and its own implementation plan.
