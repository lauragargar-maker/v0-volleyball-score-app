import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { Resend } from "resend"
import { createClient } from "@/lib/supabase/server"

// Resend SDK requires the Node.js runtime (not Edge).
export const runtime = "nodejs"

const FROM_EMAIL = process.env.FEEDBACK_FROM_EMAIL ?? "onboarding@resend.dev"
const TO_EMAIL = process.env.FEEDBACK_TO_EMAIL ?? "lauragargar+feedbackVolleyScore@gmail.com"

const VALID_TYPES = ["bug", "idea", "other"] as const
type FeedbackType = (typeof VALID_TYPES)[number]

const MESSAGE_MAX = 2000
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Simple in-memory rate limit. Good enough for a single-region, private-beta
// deployment. Resets on cold start and is not shared across regions — swap to
// Upstash Redis if VolleyScore scales or goes multi-region.
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const rateLimitStore = new Map<string, { count: number; windowStart: number }>()

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(key)
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(key, { count: 1, windowStart: now })
    return false
  }
  if (entry.count >= RATE_LIMIT_MAX) return true
  entry.count += 1
  return false
}

function typeLabel(type: FeedbackType): string {
  switch (type) {
    case "bug":
      return "Error"
    case "idea":
      return "Idea"
    default:
      return "Otro"
  }
}

export async function POST(request: Request) {
  // No API key configured (e.g. local dev) — fail gracefully so dev isn't blocked.
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "Feedback no disponible ahora." },
      { status: 503 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400 })
  }

  const honeypot = typeof body.honeypot === "string" ? body.honeypot.trim() : ""
  // Silently accept and drop bot submissions — don't reveal the trap.
  if (honeypot.length > 0) {
    return NextResponse.json({ ok: true })
  }

  const type = body.type as FeedbackType
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ ok: false, error: "Tipo inválido." }, { status: 400 })
  }

  const message = typeof body.message === "string" ? body.message.trim() : ""
  if (message.length === 0) {
    return NextResponse.json({ ok: false, error: "El mensaje está vacío." }, { status: 400 })
  }
  if (message.length > MESSAGE_MAX) {
    return NextResponse.json({ ok: false, error: "El mensaje es demasiado largo." }, { status: 400 })
  }

  const submittedEmail = typeof body.email === "string" ? body.email.trim() : ""
  if (submittedEmail && !EMAIL_REGEX.test(submittedEmail)) {
    return NextResponse.json({ ok: false, error: "El correo no es válido." }, { status: 400 })
  }

  const route = typeof body.route === "string" ? body.route.slice(0, 300) : "desconocida"

  // Server-collected, untrusted-from-client context.
  const headerList = await headers()
  const userAgent = headerList.get("user-agent") ?? "desconocido"
  const forwardedFor = headerList.get("x-forwarded-for") ?? ""
  const ip = forwardedFor.split(",")[0]?.trim() || "desconocida"

  // Identify the user (if signed in) via the Supabase server client.
  let userId = "anónimo"
  let authEmail = ""
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      userId = user.id
      authEmail = user.email ?? ""
    }
  } catch {
    // Treat as anonymous on any auth lookup failure.
  }

  // Rate-limit by user id when authenticated (forgiving for shared IPs), else by IP.
  const rateLimitKey = userId !== "anónimo" ? `user:${userId}` : `ip:${ip}`
  if (isRateLimited(rateLimitKey)) {
    return NextResponse.json(
      { ok: false, error: "Has enviado demasiados mensajes. Inténtalo más tarde." },
      { status: 429 },
    )
  }

  const replyTo = submittedEmail || authEmail || undefined
  const subject = `[VolleyScore] ${typeLabel(type)}: ${message.slice(0, 60)}`

  const emailBody = [
    `Tipo: ${typeLabel(type)}`,
    `Usuario: ${userId}`,
    `Email (cuenta): ${authEmail || "—"}`,
    `Email (indicado): ${submittedEmail || "—"}`,
    `Ruta: ${route}`,
    `IP: ${ip}`,
    `Navegador: ${userAgent}`,
    `Fecha: ${new Date().toISOString()}`,
    "",
    "--- Mensaje ---",
    message,
  ].join("\n")

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: `VolleyScore Feedback <${FROM_EMAIL}>`,
      to: [TO_EMAIL],
      replyTo,
      subject,
      text: emailBody,
    })
    if (error) {
      console.error("[feedback] Resend error:", error)
      return NextResponse.json({ ok: false, error: "No se pudo enviar." }, { status: 500 })
    }
  } catch (err) {
    console.error("[feedback] Unexpected send error:", err)
    return NextResponse.json({ ok: false, error: "No se pudo enviar." }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
