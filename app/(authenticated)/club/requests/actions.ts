"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface AdminActionResult {
  ok: boolean
  error?: string
}

export async function approveRequest(requestId: string): Promise<AdminActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc("approve_join_request", {
    _request_id: requestId,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath("/club/requests")
  return { ok: true }
}

export async function rejectRequest(requestId: string, reason?: string): Promise<AdminActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc("reject_join_request", {
    _request_id: requestId,
    _reason: reason ?? null,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath("/club/requests")
  return { ok: true }
}
