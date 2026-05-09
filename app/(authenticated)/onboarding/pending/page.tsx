import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/card"
import { Clock } from "lucide-react"

export default async function OnboardingPendingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: requests } = await supabase
    .from("club_join_requests")
    .select("id, created_at, clubs:club_id(name)")
    .eq("user_id", user!.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  return (
    <div className="px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Solicitud pendiente</h1>
          <p className="text-muted-foreground">
            Tu solicitud ha sido recibida y esta pendiente de aprobacion.
          </p>
        </div>

        <Card className="p-6 space-y-3">
          {(requests ?? []).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between border-b border-border/40 pb-3 last:border-0 last:pb-0">
              <div>
                <p className="font-medium">{r.clubs?.name ?? "Club"}</p>
                <p className="text-xs text-muted-foreground">
                  Enviada el {new Date(r.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className="text-xs uppercase tracking-wide text-primary">Pendiente</span>
            </div>
          ))}
          {(!requests || requests.length === 0) && (
            <p className="text-sm text-muted-foreground text-center">
              No tienes solicitudes pendientes en este momento.
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}
