# PRD: Landing Page and Top-of-Funnel Flows

**Version:** 1.1
**Date:** 2026-05-18
**Status:** Approved — ready for implementation planning

> Scope: this PRD covers the landing page, the three top-of-funnel flows (login, register, Instant Score), and the anonymous post-match summary view (R27). The authenticated `/home` redesign was originally included in v1.1 but has been split out into `PRD-authenticated-home-redesign.md`.

---

## 1. Context and Goal

The landing page at `/` is the single entry point for unauthenticated visitors. It must (a) communicate the value proposition, (b) move existing users into their club, (c) acquire new users via a low-friction "try first, sign up later" hook (Instant Score), and (d) let new users register intentionally.

This PRD covers the landing page and the three top-of-funnel flows it launches: **Login**, **Register**, and **Instant Score (anonymous match + save)**. It does **not** cover club discovery / join-existing-club flows (deferred), instrumentation (handled in a separate session), or ToS/Privacy acceptance (backlogged for post-private-beta).

---

## 2. Glossary

| Term | Definition |
|---|---|
| **Anonymous user** | A visitor who has not authenticated in this session. |
| **Existing user** | An account whose email is already in the database. |
| **New user** | A visitor whose email is not yet in the database. |
| **Anonymous match** | A live-scoring match created by an anonymous user, stored server-side without a club. |
| **Instant Score** | The product surface that lets an anonymous user start an anonymous match directly from the landing page. |
| **Save flow** | The conversion flow that attaches an anonymous match to a club owned by an authenticated user. |

---

## 3. User Roles in Scope

- **Anonymous visitor** — interacts with landing page, can start one anonymous match, can share its public live-score link.
- **Existing user** — uses Login from landing page; reaches own club home.
- **New user** — uses Register from landing page; reaches new-user onboarding to create a club.

Authenticated users are out of scope for this PRD except for the auto-redirect rule in R1.

---

## 4. Landing Page Layout and CTAs

### R1 — Authenticated visitor auto-redirect

A visitor with a valid session who navigates to `/` is auto-redirected to their club home. If the user belongs to multiple clubs, redirect to the **last selected club** (existing active-club mechanism). The landing page is never rendered for an authenticated user.

### R2 — CTA hierarchy

The landing page exposes three CTAs with the following hierarchy:

| CTA | Placement | Visual weight | Copy (Spanish) |
|---|---|---|---|
| Login | Top navigation bar | Tertiary (link/button in header) | "Iniciar sesión" |
| Register | Core hero area | Primary, paired with Instant Score | "Crear cuenta" |
| Instant Score | Core hero area | Primary, paired with Register | "Crear marcador instantáneo" |

Final Spanish copy for all flows is consolidated in §11.

Register and Instant Score are visually equivalent (same level of prominence) and appear together in the hero area. Login remains as a single CTA in the top navigation.

### R3 — Existing value-proposition content remains

The current hero claim and the benefit tiles at the bottom of the page are kept as-is. Only the CTA structure changes per R2.

### R4 — Language

All copy is Spanish. No English fallback in this iteration.

---

## 5. Login Flow

### R5 — Entry point

User clicks "Iniciar sesión" in the top nav. Flow opens on a single email-entry screen.

### R6 — Email-existence pre-check

Before any OTP is sent, the system checks whether the entered email exists in the database.

- **If the email exists:** proceed to OTP request (existing implementation).
- **If the email does not exist:** divert the user to the registration flow (R10) with the email **pre-filled**. Display a clear, friendly message informing the user that the email is not yet registered and that they are being moved to the registration flow. The user must be able to go back and correct the email if desired (see R7).

### R7 — Mistyped-email recovery

On the OTP-entry screen, a visible link "¿Email incorrecto?" (or equivalent) returns the user to the email-entry screen with the previous email pre-filled and editable. The OTP already sent is invalidated implicitly by sending a new one.

### R8 — OTP mechanics

The existing OTP implementation is reused without changes. Code length, expiry, resend cooldown, and attempt limits all remain as currently implemented.

### R9 — Session

The existing session mechanism is reused without changes.

---

## 6. Register Flow

### R10 — Entry points

Three entry points lead to the register flow:

1. Direct: user clicks "Crear cuenta" on landing page hero.
2. Diverted from login: existing-user check (R6) found no account; the email is pre-filled.
3. Diverted from save-the-match (R20): the email entered during save does not exist.

### R10.1 — Email-existence pre-check on Register (mirror of R6)

When the user submits their email in the register flow (whether from a direct Register entry or from save-the-match Step 1), the system pre-checks whether the email already exists **before** sending an OTP.

- **If the email does not exist:** proceed with registration as specified in R11–R15.
- **If the email exists:** divert the user to the **login flow** with the email pre-filled. Show a friendly message informing the user that the email already has an account and that they are being moved to login. The user can correct the email via the same mistyped-email-recovery affordance defined in R7.

### R11 — Profile data

- **Email** (mandatory).
- **Name / display name** (optional). If omitted, the user's email is used as the display name in match records ("anotado por X"). The user can update the name later from the authenticated app (out of scope for this PRD).

### R12 — Authentication

The user authenticates via the same email + OTP mechanism used for login (R8). No password.

### R13 — Step 2: Club selection / creation

After successful OTP verification, the user is redirected to the existing new-user onboarding screen. That screen presents two options:

- **Create a new club** — active. Uses the existing create-a-club flow from the authenticated `/home` (no changes; see R14).
- **Join an existing club** — visible but disabled, labeled **"Próximamente"**. Covered in a separate PRD.

### R14 — Club creation behavior

When the user creates a club through the onboarding screen, the existing create-a-club flow applies without changes. This includes:

- The user becomes the first Admin of the newly created club (per `PRD-multi-user-multi-club.md` R4 conventions).
- Club-name collision rules from the existing create-a-club flow apply (collisions are not allowed; same handling as from `/home`).

### R15 — Completion

After the club is created, the user lands on the club home for that newly created club.

---

## 7. Instant Score — Anonymous Match

### R16 — Starting an anonymous match

When an anonymous user clicks "Crear marcador instantáneo" on the landing page, the system creates a new anonymous match on the server and routes the user into the scoring UI for that match.

- The anonymous match is owned by an anonymous session identifier (cookie/device ID) rather than a user account.
- Only **one in-progress** anonymous match is allowed per device/session at a time. If an *in-progress* anonymous match already exists for the session, starting a new one is not allowed; the user is routed to the existing match instead.
- A **finished** anonymous match (the match has been ended by the user, regardless of whether it was saved) does **not** block starting a new one. Clicking "Crear marcador instantáneo" while only finished anonymous matches exist creates a brand-new anonymous match and makes it the device's current active match.
- Match status is therefore the gating signal for the redirect-vs-create decision in R18, not mere existence of an anonymous match record.

### R17 — Feature parity with authenticated matches

The anonymous match supports the same in-match scoring features as an authenticated match: add/subtract points, finish set, finish match, share via public live-score link.

Out of scope for anonymous matches: match history, any non-score feature (media uploads, statistics, etc.).

### R18 — Persistence across tabs / sessions

Anonymous matches are stored server-side so that they are accessible across devices via the shareable link (R19).

Device-level resumption: if an anonymous user returns to the landing page on the same device while their anonymous match is **in progress** (not finished, not yet saved, not yet expired per R23), clicking "Crear marcador instantáneo" routes them back into the existing match rather than creating a new one. If the device's most recent anonymous match is **finished**, clicking the CTA creates a new anonymous match instead — the finished match is not reopened. The match-to-device association is maintained via a long-lived cookie or equivalent client-stored identifier; if that identifier is missing (cleared cookies, different browser), the user starts fresh and the previous anonymous match is reachable only through its share link until it expires.

The implementation must remain simple. If achieving device-level resumption introduces meaningful complexity (e.g., bespoke server-side session tracking beyond a standard cookie + match-lookup), the fallback is to discard device-level resumption and require the user to start a new anonymous match — server-side storage and share-link access (R19) still hold either way. This fallback is acceptable without a new PRD revision.

### R19 — Shareable live-score link

The anonymous match exposes a public live-score URL identical to the one used for authenticated matches (`/live/[matchId]` per existing convention). Anyone with the link can watch the live score. This is the primary growth-loop mechanism for the Instant Score feature.

### R20 — Save-the-match flow

A persistent **"Guardar partido"** button is available throughout the anonymous-match scoring UI. It is rendered as a sticky banner pinned to the top of the viewport, sitting just above the match content and using the same visual language as the existing sticky `authenticated-header` (background blur, bottom border). The button is right-aligned within the banner; the banner also makes it explicit that the match is currently unsaved (e.g., a short label such as "Partido sin guardar" on the left). The banner is always visible regardless of scroll position.

Additionally, the user is prompted to save at the following natural moments:

- End of each set.
- End of the match.
- On return from the share sheet / share screen.

Prompts at natural moments must be dismissable; the persistent CTA remains available regardless.

When the user invokes save, the following step sequence runs:

1. **Step 1 — Email entry.** The user enters their email. The system performs an existence check (same as R6):
   - Email exists → user is moved into the **login flow** (OTP authentication using the entered email).
   - Email does not exist → user is moved into the **registration flow** (OTP authentication + name capture per R11).
2. **Step 2 — OTP authentication.** Standard OTP per R8.
3. **Step 3 — Club selection.**
   - **Existing user (came from login flow), multiple clubs:** the user is shown the list of clubs they belong to and picks one. A secondary option to create a new club is offered alongside the list, using the existing create-a-club flow.
   - **Existing user (came from login flow), exactly one club:** that club is auto-selected and the user proceeds directly to Step 4 without an explicit picker. A secondary affordance to "guardar en otro club" (create a new club) is still presented inline so the user can override the default — consistent with the multi-club case.
   - **New user (came from registration flow):** the user is taken through the existing new-user onboarding to create a club, exactly as in R13–R14. The "join existing club" option remains disabled ("Próximamente").
4. **Step 4 — Attach and persist.** The anonymous match is converted to a regular match under the chosen club and added to the club's match history. The anonymous ownership identifier is removed; the match becomes owned by the user/club.
5. **Step 5 — Redirect.** The user is redirected to the club's match-history view, where the newly saved match is visible.

### R20.1 — Escalated banner after the match ends (save-before-leaving)

When an anonymous match transitions from in-progress to **finished** (the user has ended the match), the sticky save banner introduced in R20 changes state to a more prominent "escalated" variant. This is the only "save before leaving" nudge in this iteration; no blocking modal and no browser `beforeunload` dialog are used.

The escalated banner:

- Visually escalates relative to the in-progress banner (stronger emphasis color from the existing design system — exact token chosen at design time).
- Replaces the in-progress label `"Partido sin guardar"` with `"Guarda este partido"` and adds a sub-line: `"Si no lo guardas, se eliminará en 7 días y no aparecerá en el historial de ningún club."`
- Keeps the same primary button `"Guardar partido"` triggering R20.
- Remains pinned to the top of the viewport on the anonymous post-match summary screen (see R25) and stays visible until the match is either saved or expired per R23.
- Is **not** dismissable. Dismissing the natural-moment save prompts in R20 does not dismiss this banner; the two are independent surfaces.

### R21 — Save failure handling

If save fails partway through (OTP entry, network error, etc.), the user can retry as long as the in-progress scoring session is still active in the same tab/device. The underlying anonymous match is not deleted until either (a) it is successfully saved, or (b) it expires per R23.

### R22 — Anonymous match unaffected by Login or Register from landing

If an anonymous user has an in-progress anonymous match and then uses the **Login** or **Register** CTA from the landing page (instead of the save flow), the anonymous match is **not** automatically linked to the resulting account. The anonymous match continues to exist server-side under its anonymous session identifier and remains reachable on the same device (subject to R18) until it expires per R23.

> Note: this means the only path to attach an anonymous match to an account is the save-the-match flow (R20).

### R23 — Anonymous match expiry

Anonymous matches that have not been saved are deleted **7 days** after their last update. The shareable live-score link returns a not-found state after expiry.

### R27 — Anonymous post-match summary view

When an anonymous user ends an anonymous match, the live-scoring controls collapse and the user is presented with an **anonymous post-match summary view** on the same route (no redirect to the landing page). This view is the anonymous-user counterpart of the most-recent-match card surfaced on the authenticated `/home` (see `PRD-authenticated-home-redesign.md` R2).

Contents:

- Home team vs away team names.
- Final set score in large type.
- Set-by-set breakdown.
- Match date.
- The escalated sticky banner from R20.1 pinned at the top.
- Action row containing:
  - `"Compartir resultado"` — opens the existing share affordance for the public live-score URL.
  - `"Crear marcador instantáneo nuevo"` — starts a fresh anonymous match per R16. This finishes/abandons the current match's claim on the device's "active match" pointer; the just-finished match remains reachable via its share link until R23 expiry.
- The primary save action (`"Guardar partido"`) is intentionally **not** duplicated in the action row; it lives in the R20.1 escalated banner at the top so it remains visible during scroll and across re-entries to the page.

Reload behavior: reloading the summary URL re-renders this same summary screen. The user is not redirected to the landing page.

Authentication CTAs (`"Iniciar sesión"`, `"Crear cuenta"`) are **not** shown on this screen. The Save flow (R20) already routes users into login or register as needed; surfacing them here separately would create competing paths.

---

## 8. Out of Scope

- Join-existing-club flow (the "Próximamente" option in R13).
- Analytics / event instrumentation.
- ToS and Privacy Policy acceptance UI and storage (backlogged).
- Authenticated user's ability to edit profile name post-registration.
- Multi-language support.
- Password-based authentication (OTP only, as today).
- Authenticated `/home` redesign — covered in `PRD-authenticated-home-redesign.md`.

---

## 9. Success Metrics

The following metrics define success for this iteration. Instrumentation is delivered in a separate session.

- **Instant Score start rate**: % of landing-page visitors who click "Crear marcador instantáneo".
- **Save-rate**: % of anonymous matches that complete the save-the-match flow (R20).
- **Login completion rate**: % of users who click "Iniciar sesión" and reach their club home.
- **Registration completion rate**: % of users who click "Registrarse" and reach a club home (own newly created club).
- **Login → Register diversion rate**: % of login attempts that get diverted to register (R6). High values suggest copy or CTA-hierarchy confusion.

---

## 10. Edge Cases

| # | Case | Resolution |
|---|---|---|
| E1 | Authenticated user navigates to `/` | Auto-redirect to last-selected club home (R1). |
| E2 | Anonymous user clicks Login, no account exists for the email | Divert to Register with pre-filled email (R6). |
| E3 | Anonymous user clicks Register, email already exists | Pre-check + divert to Login with pre-filled email (R10.1). |
| E4 | Anonymous user has in-progress match → clicks Login or Register | Anonymous match is **not** attached to the resulting account (R22). |
| E5 | Same email used in save-the-match flow on Device A and an open Login OTP session on Device B | **Open** — to be revisited after observing real usage. Tracked, not solved in this iteration. |
| E6 | User tries to create a club with a colliding name during register or save flows | Not allowed; reuse existing create-a-club collision handling (R14). |
| E7 | Save fails mid-OTP | User can retry until anonymous session is lost or match expires (R21). |
| E8 | Anonymous match abandoned for >7 days | Deleted; share link 404s (R23). |
| E9 | Anonymous user tries to start a second anonymous match on the same device while an **in-progress** one already exists | Not allowed; routed to the existing in-progress match (R16). |
| E10 | Anonymous user has a **finished** (but unsaved) anonymous match and clicks "Crear marcador instantáneo" again | A new anonymous match is created and becomes the device's current active match. The finished match remains reachable via its share link until it expires per R23, but is not re-opened (R16, R18). |
| E11 | User finishes an anonymous match, navigates to landing, clicks `Iniciar sesión` or `Crear cuenta` | Per R22, the finished anonymous match is not auto-linked. The login/register flow proceeds normally. The summary screen remains reachable on the device until the user navigates away; share link remains valid until R23 expiry. |

---

## 11. Final Spanish Copy

All user-visible copy for landing-page, top-of-funnel, and anonymous post-match flows is consolidated below. This is a v1.1 proposal pending final validation; small wording tweaks at implementation time do not require a PRD revision.

### 11.1 — Landing page CTAs

| Element | Copy |
|---|---|
| Top-nav login link | "Iniciar sesión" |
| Hero primary CTA — Register | "Crear cuenta" |
| Hero primary CTA — Instant Score | "Crear marcador instantáneo" |
| Hero supporting line under Instant Score (optional) | "Empieza ya, sin registrarte." |
| Hero supporting line under Crear cuenta (optional) | "Crea tu club y guarda el historial de tus partidos." |

### 11.2 — Login flow

| Element | Copy |
|---|---|
| Email-entry screen title | "Iniciar sesión" |
| Email field label | "Correo electrónico" |
| Submit button | "Continuar" |
| OTP-entry screen title | "Introduce el código" |
| OTP helper text | "Te hemos enviado un código a {email}." |
| Mistyped-email link | "¿Email incorrecto?" |
| Email-not-found divert message (R6) | "Este correo aún no está registrado. Te llevamos al registro para que crees tu cuenta." |

### 11.3 — Register flow

| Element | Copy |
|---|---|
| Email-entry screen title | "Crear cuenta" |
| Email field label | "Correo electrónico" |
| Name field label (optional) | "Tu nombre (opcional)" |
| Name field helper | "Aparecerá como autor de los partidos que anotes. Si lo dejas en blanco, usaremos tu correo." |
| Submit button | "Continuar" |
| Email-already-exists divert message (R10.1) | "Este correo ya tiene una cuenta. Te llevamos al inicio de sesión." |
| Onboarding screen title | "Empieza con tu club" |
| Create-club option | "Crear un club nuevo" |
| Join-club option (disabled) | "Unirme a un club existente" + badge "Próximamente" |

### 11.4 — Instant Score (anonymous match)

| Element | Copy |
|---|---|
| Sticky top banner (in-progress) — status label | "Partido sin guardar" |
| Sticky top banner (in-progress) — save button | "Guardar partido" |
| Sticky top banner (escalated, post-match per R20.1) — status label | "Guarda este partido" |
| Sticky top banner (escalated) — sub-line | "Si no lo guardas, se eliminará en 7 días y no aparecerá en el historial de ningún club." |
| Sticky top banner (escalated) — save button | "Guardar partido" |
| End-of-set save prompt — title | "¿Quieres guardar este partido?" |
| End-of-set save prompt — body | "Si lo guardas, podrás consultarlo más tarde en el historial de tu club." |
| End-of-set save prompt — primary button | "Guardar partido" |
| End-of-set save prompt — secondary button | "Ahora no" |
| End-of-match save prompt — title | "Guarda este partido en tu historial" |
| End-of-match save prompt — body | "Crea tu cuenta y consérvalo en el historial de tu club." |
| Return-from-share save prompt — title | "¿Listo para guardarlo?" |

### 11.5 — Save-the-match flow

| Element | Copy |
|---|---|
| Step 1 — title | "Guarda este partido" |
| Step 1 — body | "Introduce tu correo para guardar el partido en el historial de tu club." |
| Step 1 — email field | "Correo electrónico" |
| Step 1 — submit | "Continuar" |
| Step 2 — title | "Introduce el código" |
| Step 2 — body | "Te hemos enviado un código a {email}." |
| Step 3 (multi-club picker) — title | "¿En qué club guardamos el partido?" |
| Step 3 (multi-club picker) — secondary action | "Crear un club nuevo" |
| Step 3 (single-club auto-select) — confirmation | "Guardaremos el partido en {Club}." |
| Step 3 (single-club auto-select) — override link | "Guardar en otro club" |
| Step 3 (new user) — reuses existing onboarding copy | — |
| Step 5 — history-view toast on landing | "Partido guardado en {Club}." |

### 11.6 — Anonymous post-match summary view

| Element | Copy |
|---|---|
| Summary screen — implicit title (no header chrome beyond the banner) | — |
| Action — share | "Compartir resultado" |
| Action — new anonymous match | "Crear nuevo marcador" |

---

## 12. Open Items

None. All v1.1 open items were resolved as recommended; see §13.

---

## 13. Resolutions Log

Decisions taken to move this PRD from draft (v0.1) to v1.0:

| Item | Resolution |
|---|---|
| Anonymous-match device resumption | Adopt Option A (resume into existing match on same device) **as long as** implementation stays simple — see R18 fallback clause. |
| Register-flow email-already-exists | Pre-check + divert to Login with pre-filled email (R10.1). |
| Save CTA placement | Sticky top banner with "Partido sin guardar" label + "Guardar partido" button, matching the visual language of the existing sticky authenticated header (R20). |
| Step 3 picker when existing user has one club | Auto-select with a visible "guardar en otro club" override (R20 Step 3). |
| Spanish copy | Proposed in §11; pending final validation but not blocking implementation. |

Decisions taken in v1.1:

| Item | Resolution |
|---|---|
| Save-before-leaving mechanism | Option C — escalated sticky banner post-match end. No blocking modal, no `beforeunload` dialog (R20.1). |
| Anonymous user post-match destination | New "anonymous post-match summary" screen on the same route; no redirect to landing (R27). |
| Authenticated `/home` redesign | Split into its own PRD (`PRD-authenticated-home-redesign.md`). Out of scope here. |
| Anonymous summary action set (12.1) | Action row contains only `Compartir resultado` and `Crear marcador instantáneo nuevo`. No `Iniciar sesión` / `Crear cuenta` duplication (R27). |
| Anonymous summary reload behavior (12.2) | Reloading the URL re-renders the same summary screen; no redirect to landing (R27). |
| New-anonymous-match from summary (12.3) | Starting a new anonymous match abandons the device's pointer to the just-finished one; the finished match remains reachable via its share link until R23 expiry (R27, R18). |
| Escalated banner styling (12.4) | Resolved at design time using the existing design-system emphasis tokens; not blocking PRD (R20.1). |
| Instant Score waitlist placeholder (launch-prep affordance) | Phases 1–3 ship the hero `"Crear marcador instantáneo"` CTA visually identical to its final form but wired to a `"Próximamente"` modal that captures an optional email (`instant_score_waitlist` table). The modal and write path retire in Phase 4 when the real Instant Score flow goes live; the captured emails remain for a launch announcement. Not a product requirement — implementation-plan detail. |

---

## 14. Dependencies

- Existing OTP authentication (R8).
- Existing session mechanism (R9).
- Existing create-a-club flow from `/home` (R14).
- Existing new-user onboarding screen (R13).
- Existing public live-score page `/live/[matchId]` (R19).
- Existing active-club / last-selected-club persistence (R1).
- Existing match-history view (R20 step 5).

No new external dependencies introduced.
