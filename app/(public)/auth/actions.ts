"use server"

import { createClient } from "@/lib/supabase/server"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email) && email.length <= 254
}

export async function emailExists(email: string): Promise<{ exists: boolean }> {
  if (!isValidEmail(email)) {
    return { exists: false }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("email_exists", { p_email: email })

  if (error) {
    console.error("[emailExists] rpc error", error)
    return { exists: false }
  }

  return { exists: Boolean(data) }
}

export async function joinInstantScoreWaitlist(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isValidEmail(email)) {
    return { ok: false, error: "invalid_email" }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("instant_score_waitlist")
    .insert({ email: email.toLowerCase() })

  if (error && error.code !== "23505") {
    console.error("[joinInstantScoreWaitlist] insert error", error)
    return { ok: false, error: "insert_failed" }
  }

  return { ok: true }
}
