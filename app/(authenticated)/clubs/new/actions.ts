"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

export interface CreateClubResult {
  ok: boolean
  error?: string
  clubId?: string
}

export async function createClub(formData: FormData): Promise<CreateClubResult> {
  const name = String(formData.get("name") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()

  if (!name) {
    return { ok: false, error: "El nombre del club es obligatorio." }
  }
  if (name.length > 80) {
    return { ok: false, error: "El nombre no puede exceder 80 caracteres." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "No autenticado." }
  }

  // The trigger trg_enroll_creator on clubs auto-inserts the creator
  // as admin in club_members.
  const { data: club, error: insertError } = await supabase
    .from("clubs")
    .insert({
      name,
      description: description || null,
      created_by: user.id,
    })
    .select("id")
    .single()

  if (insertError) {
    if (insertError.code === "23505") {
      return { ok: false, error: "Ya existe un club con ese nombre." }
    }
    return { ok: false, error: insertError.message }
  }

  revalidatePath("/", "layout")
  return { ok: true, clubId: club.id }
}
