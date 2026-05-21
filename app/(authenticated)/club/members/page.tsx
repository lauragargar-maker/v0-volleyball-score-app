import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Users } from "lucide-react"
import { MembersList } from "./members-list"

export default async function ClubMembersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/")

  // Only admins can manage members
  const { data: memberships } = await supabase
    .from("club_members")
    .select("club_id, role, clubs:club_id(id, name)")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .order("joined_at", { ascending: true })
    .limit(1)

  const adminMembership = memberships?.[0] as any
  if (!adminMembership) redirect("/home")

  const clubId: string = adminMembership.club_id
  const clubName: string = adminMembership.clubs?.name ?? "Tu club"

  // Fetch all members
  const { data: rawMembers } = await supabase
    .from("club_members")
    .select("user_id, role, joined_at")
    .eq("club_id", clubId)
    .order("joined_at", { ascending: true })

  // Resolve emails via auth.users — need security-definer or service role.
  // We use get_requester_email only for join requests, so here we fall back
  // to showing user_id for non-self members. A proper fix is a
  // get_member_email RPC in script 013; for now show truncated user id.
  const members = await Promise.all(
    (rawMembers ?? []).map(async (m: any) => {
      // For the current user we can get their email directly
      if (m.user_id === user.id) {
        return {
          userId: m.user_id,
          email: user.email ?? m.user_id,
          role: m.role as "admin" | "member",
          joinedAt: m.joined_at,
        }
      }
      // For others, try the shared helper that already exists
      const { data: email } = await supabase.rpc("get_shared_user_email", {
        _user_id: m.user_id,
      })
      return {
        userId: m.user_id,
        email: email ?? m.user_id,
        role: m.role as "admin" | "member",
        joinedAt: m.joined_at,
      }
    }),
  )

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Miembros</h1>
              <p className="text-sm text-muted-foreground">{clubName}</p>
            </div>
          </div>
          <span className="text-sm text-muted-foreground">{members.length} miembro{members.length !== 1 ? "s" : ""}</span>
        </div>

        <MembersList clubId={clubId} members={members} currentUserId={user.id} />
      </div>
    </div>
  )
}
