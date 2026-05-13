import { createClient } from "@/lib/supabase/server"
import type { Membership } from "@/lib/types"

export async function getMyMemberships(): Promise<Membership[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from("club_members")
    .select("role, joined_at, clubs:club_id(*)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true })

  if (error || !data) return []

  return data
    .filter((row: any) => row.clubs)
    .map((row: any) => ({
      club: row.clubs,
      role: row.role,
    })) as Membership[]
}

export async function hasPendingJoinRequest(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { count } = await supabase
    .from("club_join_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "pending")

  return (count ?? 0) > 0
}
