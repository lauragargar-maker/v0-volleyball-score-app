# Implementation Plan: User Feedback Widget

**Status:** Awaiting approval — no implementation work has started.

## Resolved decisions (2026-05-20)

These were open items; now settled and reflected throughout the plan:

1. **Sender:** start on Resend's sandbox sender (`onboarding@resend.dev`). The app is on a `*.vercel.app` URL, which cannot be verified for sending, so a real custom-domain sender is deferred until a domain is added (before the beta opens wider).
2. **Recipient:** `lauragargar+feedbackVolleyScore@gmail.com` — the `+` alias lets Laura set inbox rules to triage replies.
3. **Live-score share page (`/live/[matchId]`):** do **not** show the feedback button there.
4. **Copy:** Spanish only.

## Goal

Let any VolleyScore user (authenticated or anonymous) send free-form feedback at any time from anywhere in the app — except the public live-score share page. Feedback is delivered to Laura's inbox via Resend. No admin UI, no DB table — the inbox is the triage queue while the beta is small. Designed so a future migration to a DB-backed store is a single endpoint change.

## Scope

**In scope**
- Persistent floating "Feedback" button visible on every route (public + authenticated).
- Modal with: type selector (Bug / Idea / Other), required free-text message, optional email (prefilled and editable for authenticated users).
- Server endpoint that sends an email via Resend with the message + auto-attached context (route, user id if any, user agent, app version, timestamp).
- Honeypot field + simple per-IP rate limit for spam control.
- Success / error states via existing `sonner` toaster.

**Out of scope (intentionally)**
- In-app surveys, NPS, emoji reactions, contextual post-match prompts — deferred to a future tool.
- Admin dashboard / DB persistence — re-evaluate when volume justifies it (rough trigger: >20 submissions/week or inbox triage becoming painful).
- File / screenshot attachments — Resend supports attachments; we can add later behind the same endpoint.
- Turnstile on the feedback form — honeypot + rate limit is enough at private-beta scale. Easy to add later if abuse appears.
- i18n strings file — copy lives inline in Spanish to match the rest of the app; no new translation infrastructure.

## Current-state findings (grounding for the plan)

1. **No `app/api/` directory exists yet** — this will be the first server route in the app. Auth flows use Supabase client SDK directly from client components.
2. **No Resend dependency** — needs to be added (`resend` npm package). `RESEND_API_KEY` will be a new env var on Vercel.
3. **Two layouts** wrap content: [app/(public)/layout.tsx](app/(public)/layout.tsx) and [app/(authenticated)/layout.tsx](app/(authenticated)/layout.tsx). Mounting the widget once in the root [app/layout.tsx](app/layout.tsx) (alongside the existing `<Toaster />`) covers both groups in one place.
4. **`sonner` toaster is already mounted** in the root layout — reuse it for success/error feedback.
5. **`AuthProvider` is in the root layout** ([app/layout.tsx:33](app/layout.tsx#L33)) — the widget can call `useAuth()` to know if the user is signed in and to prefill email/user id.
6. **shadcn/ui Dialog + Button + Textarea + RadioGroup** are already in `components/ui/` — no new UI primitives needed.
7. **Sticky authenticated header** uses `z-50` ([components/authenticated-header.tsx](components/authenticated-header.tsx)) — the floating button needs `z-40` so it sits below the header dropdown but above page content.
8. **Turnstile is wired** in auth pages but is not needed here (see scope).

## Architecture overview

```
[FeedbackButton] (client, fixed bottom-right, mounted in root layout)
       ↓ opens
[FeedbackDialog] (client, shadcn Dialog)
       ↓ submits JSON
POST /api/feedback (server route, Node runtime)
       ↓ validates + rate-limits
[Resend SDK] → email to lauragargar@gmail.com
       ↓
toast.success / toast.error on client
```

Key design choice: **a single thin server endpoint with the transport (Resend) hidden behind it**. Future swap to DB insert, Slack, GitHub Issues, or a queue is one file's worth of change with no client impact.

## Phases

One PR, four small commits. The whole thing is ~half a day of work; phasing it further would be overkill.

| Commit | Scope | Deployable? |
|---|---|---|
| 1 — Server endpoint + Resend wiring | `app/api/feedback/route.ts`, env var, `resend` dep | Yes (dark; no UI calls it yet) |
| 2 — Feedback dialog component | `components/feedback/feedback-dialog.tsx` | Yes (component unused) |
| 3 — Floating button + root-layout mount | `components/feedback/feedback-button.tsx`, edit `app/layout.tsx` | Yes — feature live |
| 4 — Docs & env example | Update `.env.example` (if present), README note | Yes |

## Detailed design

### 1. Server endpoint — `app/api/feedback/route.ts`

- `POST` handler, Node runtime (Resend SDK needs Node, not Edge).
- Request body (JSON):
  ```ts
  {
    type: "bug" | "idea" | "other",
    message: string,        // required, 1–2000 chars
    email?: string,         // optional; validated if present
    honeypot?: string,      // must be empty/absent
    route: string,          // window.location.pathname at submit time
  }
  ```
- Server-collected fields (not trusted from client): `userAgent` from request headers, `ip` from `x-forwarded-for` (Vercel sets this), `userId` and `userEmail` from the Supabase server client (via `@supabase/ssr`) — falls back to "anonymous" if not signed in.
- **Validation:** trim message, reject if empty or >2000 chars; reject if honeypot non-empty; reject invalid type. Plain inline checks — no need for zod here.
- **Rate limit:** in-memory `Map<ip, { count, windowStart }>` — 5 submissions per IP per hour. Acceptable for single-region Vercel deployments at beta scale; documented as "good enough for now, swap to Upstash if we scale or go multi-region." If the user is authenticated, the limit is keyed by user id instead (more forgiving for shared IPs).
- **Resend call:** plain-text email (no HTML template needed) to `lauragargar+feedbackVolleyScore@gmail.com`, `from: "VolleyScore Feedback <onboarding@resend.dev>"` (sandbox sender for the beta), `reply_to` set to the submitted email when present so Laura can reply directly from her inbox. Subject: `[VolleyScore] <type>: <first 60 chars of message>`.
- **Response:** `{ ok: true }` on success, `{ ok: false, error: "<reason>" }` on failure with appropriate status (400 validation, 429 rate limit, 500 transport).
- **Logging:** `console.error` on Resend failures so Vercel logs capture them; no PII in logs beyond what Resend already sees.

### 2. Feedback dialog — `components/feedback/feedback-dialog.tsx`

- Client component, uncontrolled form (no `react-hook-form` needed for three fields).
- Fields (Spanish copy to match the rest of the app):
  - **Tipo:** RadioGroup, three options — `Error` / `Idea` / `Otro`. Default: `Otro`.
  - **Mensaje:** Textarea, `maxLength={2000}`, required, autofocus.
  - **Email (opcional):** Input, prefilled from `useAuth()` when present, editable. Helper text: "Para que pueda responderte" / "So I can reply to you."
  - **Honeypot:** hidden `<input name="company" tabIndex={-1} autoComplete="off">` rendered with `style={{ position: "absolute", left: "-9999px" }}`.
- Submit button shows loading state; disabled while pending.
- On success: close dialog, `toast.success("¡Gracias! He recibido tu mensaje.")`.
- On error: keep dialog open with the message preserved, `toast.error(...)`.
- Accessible: shadcn `Dialog` already handles focus trap, ESC to close, ARIA labels.

### 3. Floating button — `components/feedback/feedback-button.tsx`

- Client component. Renders a small pill button fixed at `bottom-4 right-4`, `z-40`, with a `MessageCircle` icon (lucide-react, already used elsewhere) and the label "Feedback".
- Visible on all viewport sizes; on mobile, shrinks to icon-only to avoid covering content.
- **Route suppression:** uses `usePathname()` and returns `null` on `/live/...` routes (the public share page) per resolved decision 3. Since it's mounted in the root layout, this client-side check is how we exclude that page.
- Clicking opens `<FeedbackDialog>`. Dialog state owned by the button so the button isn't always rendering the modal tree.
- One subtle behavior: hide the button while the dialog is open (avoids stacking-context weirdness near other fixed elements).

### 4. Root-layout mount — `app/layout.tsx`

Add `<FeedbackButton />` once inside `<AuthProvider>`, after `<main>`. That single mount covers public + authenticated route groups.

### 5. Env vars

- `RESEND_API_KEY` — production + preview on Vercel (use the Resend↔Vercel Marketplace integration to provision it). Local dev: optional; endpoint returns a friendly 503 when missing so dev work isn't blocked.
- `FEEDBACK_FROM_EMAIL` — defaults to `onboarding@resend.dev` (Resend sandbox sender) for the beta. Switch to `feedback@<domain>` once a custom domain is added and verified in Resend.
- `FEEDBACK_TO_EMAIL` — defaults to `lauragargar+feedbackVolleyScore@gmail.com`; kept as an env var so staging vs prod can differ if ever needed.

### 6. Files touched

**New**
- `app/api/feedback/route.ts`
- `components/feedback/feedback-button.tsx`
- `components/feedback/feedback-dialog.tsx`

**Modified**
- `app/layout.tsx` — mount `<FeedbackButton />`
- `package.json` — add `resend` dependency
- `.env.example` (if it exists; otherwise mention in README)

## Testing plan

Manual (no automated test infra in the repo today):
- [ ] Submit as anonymous from `/` — email arrives, `userId` shows "anonymous", `email` in body matches what was typed.
- [ ] Submit as authenticated from `/home` — email arrives with `userId` and prefilled email; editing the email field works.
- [ ] Submit empty message — client blocks submit; server also rejects with 400 if bypassed.
- [ ] Submit 2001-char message — rejected.
- [ ] Submit 6 times from same IP in <1h — 6th gets 429 with a friendly toast.
- [ ] Honeypot filled (via devtools) — server returns 200 silently (don't tell bots they were caught) but no email is sent.
- [ ] `RESEND_API_KEY` unset — endpoint returns 503, toast shows "Feedback no disponible ahora, inténtalo más tarde."
- [ ] Mobile viewport — button doesn't cover key UI, dialog is usable, keyboard doesn't break layout.
- [ ] Button appears on public route and authenticated route.
- [ ] Button is **absent** on `/live/[matchId]` (suppressed per decision 3).

## Open items

All initial open items are resolved (see "Resolved decisions" at the top). One follow-up remains for *after* the beta, not blocking implementation:

- **Custom-domain sender.** Once VolleyScore moves off `*.vercel.app` to a real domain, verify it in Resend and set `FEEDBACK_FROM_EMAIL` to `feedback@<domain>` for better deliverability. No code change — env var only.

## Risks & mitigations

- **Resend deliverability to Gmail without a verified domain** → start on sandbox, verify domain before public-beta launch. Mitigated by `reply_to`.
- **In-memory rate limit resets on each Vercel cold start / doesn't share across regions** → acceptable at beta scale; documented as a known limit; swap to Upstash Redis later if abuse appears.
- **Floating button covers important UI on small screens** → icon-only on mobile, `bottom-4 right-4` is the same corner where most apps place feedback widgets, so users won't be surprised.
- **PII in logs** → only `console.error` on transport failures; no message body or email logged.

## Future migration path (when we outgrow email)

The endpoint is the seam. To move to DB-backed feedback:
1. Add a `feedback` table in Supabase.
2. Replace the Resend call in `route.ts` with an insert.
3. Optionally keep the Resend call as a "notify Laura" side-effect.
4. Build an admin page reading from the table.

Zero client changes required.
