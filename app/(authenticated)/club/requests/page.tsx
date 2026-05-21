import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Users } from "lucide-react"
import { RequestsList } from "./requests-list"

export default async function ClubRequestsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/")

  // Determine the active club from the first club where the user is admin.
  // We use the same query the ClubProvider uses on the client, but we pick
  // only clubs where role = 'admin'.
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

  // Fetch pending join requests
  const { data: rawRequests } = await supabase
    .from("club_join_requests")
    .select("id, user_id, created_at")
    .eq("club_id", clubId)
    .in("status", ["pending", "reopened"])
    .order("created_at", { ascending: true })

  // Resolve emails via security-definer RPC for each request
  const requests = await Promise.all(
    (rawRequests ?? []).map(async (req: any) => {
      const { data: email } = await supabase.rpc("get_requester_email", {
        _request_id: req.id,
      })
      return {
        id: req.id,
        email: email ?? req.user_id,
        created_at: req.created_at,
      }
    }),
  )

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Solicitudes de acceso</h1>
            <p className="text-sm text-muted-foreground">{clubName}</p>
          </div>
        </div>

        <RequestsList requests={requests} />
      </div>
    </div>
  )
}
