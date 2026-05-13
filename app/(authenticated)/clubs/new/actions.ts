"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { isReservedClubName } from "@/lib/reserved-club-names"

const MAX_CLUBS_PER_USER = 5

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
  if (description.length > 500) {
    return { ok: false, error: "La descripción no puede exceder 500 caracteres." }
  }

  // M4: reserved-name check
  if (isReservedClubName(name)) {
    return { ok: false, error: "Este nombre está reservado y no puede usarse." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "No autenticado." }
  }

  // M3: per-user club cap
  const { count, error: countError } = await supabase
    .from("clubs")
    .select("*", { count: "exact", head: true })
    .eq("created_by", user.id)

  if (countError) {
    return { ok: false, error: "Error al verificar el límite de clubes." }
  }
  if ((count ?? 0) >= MAX_CLUBS_PER_USER) {
    return {
      ok: false,
      error: `No puedes crear más de ${MAX_CLUBS_PER_USER} clubes. Contacta con soporte si necesitas más.`,
    }
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
