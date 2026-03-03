import { createClient } from "@/lib/supabase/server"
import { AdminRequestsList } from "@/components/admin-requests-list"

export default async function SolicitudesPage() {
  const supabase = await createClient()

  const { data: requests } = await supabase
    .from("admin_requests")
    .select("*")
    .order("created_at", { ascending: false })

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Solicitudes de Admin</h1>
          <p className="text-muted-foreground">Gestiona las solicitudes de acceso de administrador</p>
        </div>
        <AdminRequestsList initialRequests={requests || []} />
      </div>
    </div>
  )
}
