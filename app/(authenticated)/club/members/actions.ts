"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface MemberActionResult {
  ok: boolean
  error?: string
}

export async function promoteMember(clubId: string, userId: string): Promise<MemberActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("club_members")
    .update({ role: "admin" })
    .eq("club_id", clubId)
    .eq("user_id", userId)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/club/members")
  return { ok: true }
}

export async function demoteMember(clubId: string, userId: string): Promise<MemberActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("club_members")
    .update({ role: "member" })
    .eq("club_id", clubId)
    .eq("user_id", userId)

  if (error) {
    // Surface last-admin guard violations gracefully
    if (error.message.includes("last admin") || error.code === "P0001") {
      return { ok: false, error: "No puedes degradar al último administrador del club." }
    }
    return { ok: false, error: error.message }
  }
  revalidatePath("/club/members")
  return { ok: true }
}

export async function removeMember(clubId: string, userId: string): Promise<MemberActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("club_members")
    .delete()
    .eq("club_id", clubId)
    .eq("user_id", userId)

  if (error) {
    if (error.message.includes("last admin") || error.code === "P0001") {
      return { ok: false, error: "No puedes eliminar al último administrador del club." }
    }
    return { ok: false, error: error.message }
  }
  revalidatePath("/club/members")
  return { ok: true }
}
