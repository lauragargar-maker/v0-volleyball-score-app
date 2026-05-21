"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface JoinRequestResult {
  ok: boolean
  error?: string
}

export async function submitJoinRequest(clubId: string): Promise<JoinRequestResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "No autenticado." }

  // Check user is not already a member
  const { count: memberCount } = await supabase
    .from("club_members")
    .select("*", { count: "exact", head: true })
    .eq("club_id", clubId)
    .eq("user_id", user.id)

  if ((memberCount ?? 0) > 0) {
    return { ok: false, error: "Ya eres miembro de este club." }
  }

  // Check for an existing pending request
  const { count: pendingCount } = await supabase
    .from("club_join_requests")
    .select("*", { count: "exact", head: true })
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .eq("status", "pending")

  if ((pendingCount ?? 0) > 0) {
    return { ok: false, error: "Ya tienes una solicitud pendiente para este club." }
  }

  const { error } = await supabase.from("club_join_requests").insert({
    club_id: clubId,
    user_id: user.id,
    status: "pending",
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath("/onboarding/pending")
  return { ok: true }
}

export async function withdrawJoinRequest(requestId: string): Promise<JoinRequestResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "No autenticado." }

  const { error } = await supabase
    .from("club_join_requests")
    .delete()
    .eq("id", requestId)
    .eq("user_id", user.id)
    .eq("status", "pending")

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath("/onboarding/pending")
  return { ok: true }
}
