# PRD: Authenticated Home Redesign

**Version:** 1.0
**Date:** 2026-05-18
**Status:** Approved — ready for implementation planning

> Split from `PRD-landing-page-and-top-of-funnel.md` v1.1. That PRD's scope is the landing page, the three top-of-funnel flows (login, register, Instant Score), and the anonymous post-match summary. This PRD owns the authenticated `/home` view only.

---

## 1. Context and Goal

Today, when an authenticated match ends, the live scoring view collapses and the user lands on the current `/home`, which does not surface the just-finished match or guide the user toward a next action. The redesign turns `/home` into the post-match destination *and* the standing logged-in entry point: it must surface the most-recent finished match and offer clear primary actions for the active club.

This PRD covers the authenticated `/home` view only. It does **not** cover the anonymous post-match summary (see `PRD-landing-page-and-top-of-funnel.md` R27), the landing page, or any of the auth flows.

---

## 2. Glossary

Inherits the glossary from `PRD-multi-user-multi-club.md`. The terms used in this document are: **Club**, **Member**, **Club Admin**, **Active Club**.

---

## 3. User Roles in Scope

Authenticated users only — Members and Club Admins of at least one club. Users with zero club memberships continue to see the existing new-user onboarding screen (per `PRD-multi-user-multi-club.md` R1 and the register flow in the landing PRD); they do not see `/home` until they have at least one approved club.

Anonymous users are out of scope.

---

## 4. Requirements

### R1 — `/home` layout

`/home` is organized into two sections, in this vertical order:

1. **Últimas actualizaciones** (Last updates) — top section, contextual recent activity for the active club.
2. **Acciones principales** (Main actions) — below, primary calls to action.

The redesign **replaces** (does not augment) the current `/home` content. The existing club switcher and header chrome remain unchanged.

### R2 — Last updates section

The Last updates section is scoped to the **active club** only, consistent with the active-club model defined in `PRD-multi-user-multi-club.md` R5. It never surfaces matches from other clubs the user belongs to.

Contents:

- A single **most-recent-finished-match card** showing:
  - Home team name vs away team name (playing-team strings).
  - Final set score in large type (e.g. `3 – 1`).
  - Set-by-set breakdown as a sub-line (e.g. `25–21 · 22–25 · 25–18 · 25–23`).
  - Match date.
  - Tapping the card opens the existing match detail view.
- A `"Ver historial completo"` link directly below the card, routing to the existing match-history view for the active club.

#### Empty state

When the active club has no finished matches yet:

- The section renders a single empty-state card.
- Title: `"Aún no has anotado ningún partido"`.
- Body: `"Cuando termines el primero, lo verás aquí."`
- Primary button: `"Crear partido"` — opens the existing new-match flow under the active club.

### R3 — Main actions section

The Main actions section presents three primary action cards. All three are always visible regardless of the user's club count, in this order:

1. `"Crear partido nuevo"` — opens the existing new-match flow under the active club.
2. `"Ver historial"` — opens the active club's match-history view. Coexists with the link in R2 (the link is contextual to the most-recent match; this card is a stable entry point for users with no recent activity or for users who finished using the recent-match card).
3. `"Crear o unirme a un club"` — opens the existing create-a-club flow with the "join existing" option visible but disabled per the landing PRD R13. Always visible; for users with zero clubs this card is effectively the same entry point as the existing new-user onboarding (but those users do not reach `/home` in this iteration).

All three cards use equivalent visual treatment (equal weight). Layout follows the existing responsive grid conventions used elsewhere in the app.

### R4 — In-progress match on `/home`

**Out of scope for v0.1.** If the user has a match in progress in the active club, behavior on `/home` is unchanged from today. A dedicated "Reanudar partido" surface above Last updates may be added in a follow-up iteration. See open item §10.2.

### R5 — Navigation entry points to `/home`

Existing entry points to `/home` are preserved without change. Additionally, when an authenticated match ends, the user is routed to `/home` (this is the current behavior; no change). The redesigned `/home` therefore doubles as the post-match destination.

---

## 5. Out of Scope

- Surfacing activity from non-active clubs (Last updates remains active-club scoped per R2).
- Activity-feed style entries beyond the most-recent finished match (e.g., new member joined, match comments). Future iteration.
- In-progress match resume surface (see R4).
- Personalization, sorting, or filtering controls within Last updates.

---

## 6. Success Metrics

- **`/home` next-step rate**: % of `/home` visits that result in clicking either the Last updates card, the `"Ver historial completo"` link, or one of the Main action cards.
- **Recent-match card engagement**: % of `/home` visits with at least one finished match where the user taps the recent-match card to view detail.
- **Empty-state conversion**: % of empty-state `/home` visits that click `"Crear partido"`.
- **User Activation**: % of users with no finished matches across any of their clubs at registration time who reach at least one finished match (in any club they belong to) within **15 days** of registering.
- **User Retention**: % of users with at least one finished match who create another match within **30 days** of their previous finished match.

Instrumentation is delivered in a separate session.

---

## 7. Edge Cases

| # | Case | Resolution |
|---|---|---|
| E1 | Active club has no finished matches yet | Render the empty-state card with `"Crear partido"` CTA (R2). |
| E2 | Active club has finished matches but the most recent one was deleted between page loads | Re-query on each `/home` render; if no finished matches remain, fall back to the empty state. |
| E3 | User belongs to multiple clubs and switches active club from `/home` | Last updates re-renders for the newly active club (existing active-club switching behavior; no special case for the redesign). |
| E4 | User taps "Crear o unirme a un club" while already belonging to a club | Opens the existing create-a-club flow with "join existing" disabled. No special case; matches landing PRD R13. |
| E5 | The just-finished match is the most recent finished match | It appears as the Last updates card immediately on landing on `/home` (R5). |

---

## 8. Spanish Copy

| Element | Copy |
|---|---|
| Section heading — Last updates | "Últimas actualizaciones" |
| Section heading — Main actions | "Acciones principales" |
| Last updates — link below recent match card | "Ver historial completo" |
| Last updates — empty-state title | "Aún no has anotado ningún partido" |
| Last updates — empty-state body | "Cuando termines el primero, lo verás aquí." |
| Last updates — empty-state CTA | "Crear partido" |
| Main action card — new match | "Crear partido nuevo" |
| Main action card — history | "Ver historial" |
| Main action card — club | "Crear o unirme a un club" |

Final wording is a proposal pending validation; minor tweaks at implementation time do not require a PRD revision.

---

## 9. Dependencies

- Active-club model (`PRD-multi-user-multi-club.md` R5).
- Existing new-match flow.
- Existing match-history view.
- Existing match-detail view.
- Existing create-a-club flow.
- Existing club-switcher / header chrome on `/home`.

No new external dependencies.

---

## 10. Open Items

None.

---

## 11. Resolutions Log

Decisions taken to move this PRD from draft (v0.1) to v1.0:

| Item | Resolution |
|---|---|
| Recent-match card fields | Adopted as written: home team vs away team names, final set score, set-by-set breakdown, match date, tap-to-detail (R2). |
| In-progress match handling on `/home` | Out of scope for this iteration; behavior unchanged from today. Revisited in a follow-up (R4). |
| Cardinality of Last updates | One most-recent-finished-match card + `"Ver historial completo"` link, not a list of N (R2). |
| Scope of Last updates | Active club only (R2). |
| Main action `"Crear o unirme a un club"` visibility | Always shown, regardless of how many clubs the user already belongs to (R3). |
| Section order on `/home` | Last updates above Main actions (R1). |
