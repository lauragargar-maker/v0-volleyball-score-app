import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, CheckCircle, XCircle, RefreshCw, Plus } from "lucide-react"
import Link from "next/link"

const statusConfig = {
  pending: { label: "Pendiente", icon: Clock, color: "text-primary" },
  approved: { label: "Aprobada", icon: CheckCircle, color: "text-green-600" },
  rejected: { label: "Rechazada", icon: XCircle, color: "text-destructive" },
  reopened: { label: "Pendiente", icon: Clock, color: "text-primary" },
} as const

async function withdrawRequest(formData: FormData) {
  "use server"
  const requestId = formData.get("requestId") as string
  if (!requestId) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from("club_join_requests")
    .delete()
    .eq("id", requestId)
    .eq("user_id", user.id)
    .eq("status", "pending")

  revalidatePath("/onboarding/pending")
}

async function resubmitRequest(formData: FormData) {
  "use server"
  const clubId = formData.get("clubId") as string
  if (!clubId) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { count } = await supabase
    .from("club_join_requests")
    .select("*", { count: "exact", head: true })
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .eq("status", "pending")

  if ((count ?? 0) === 0) {
    await supabase.from("club_join_requests").insert({
      club_id: clubId,
      user_id: user.id,
      status: "pending",
    })
  }

  revalidatePath("/onboarding/pending")
}

export default async function OnboardingPendingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const { data: requests } = await supabase
    .from("club_join_requests")
    .select("id, status, created_at, decided_at, clubs:club_id(id, name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20)

  const hasPending = (requests ?? []).some(
    (r: any) => r.status === "pending" || r.status === "reopened",
  )

  return (
    <div className="px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Mis solicitudes</h1>
          {hasPending ? (
            <p className="text-muted-foreground">
              Tienes solicitudes pendientes de aprobación.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Aún no eres miembro de ningún club. Busca uno o crea el tuyo.
            </p>
          )}
        </div>

        {requests && requests.length > 0 ? (
          <Card className="divide-y divide-border/40">
            {requests.map((r: any) => {
              const cfg = statusConfig[r.status as keyof typeof statusConfig] ?? statusConfig.pending
              const Icon = cfg.icon
              const isPending = r.status === "pending" || r.status === "reopened"
              const isRejected = r.status === "rejected"

              return (
                <div key={r.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.clubs?.name ?? "Club"}</p>
                    <p className="text-xs text-muted-foreground">
                      Enviada el {new Date(r.created_at).toLocaleDateString("es-ES")}
                      {r.decided_at && (
                        <>
                          {" · "}
                          {cfg.label} el {new Date(r.decided_at).toLocaleDateString("es-ES")}
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                      {cfg.label}
                    </span>

                    {isPending && (
                      <form action={withdrawRequest}>
                        <input type="hidden" name="requestId" value={r.id} />
                        <Button
                          variant="ghost"
                          size="sm"
                          type="submit"
                          className="text-muted-foreground hover:text-destructive text-xs h-7"
                        >
                          Retirar
                        </Button>
                      </form>
                    )}

                    {isRejected && r.clubs?.id && (
                      <form action={resubmitRequest}>
                        <input type="hidden" name="clubId" value={r.clubs.id} />
                        <Button variant="outline" size="sm" type="submit" className="text-xs h-7 gap-1">
                          <RefreshCw className="w-3 h-3" />
                          Volver a pedir
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              )
            })}
          </Card>
        ) : (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No has enviado ninguna solicitud todavía.
          </Card>
        )}

        <div className="flex gap-3">
          <Button asChild variant="outline" className="flex-1">
            <Link href="/clubs/join">
              <Plus className="w-4 h-4 mr-2" />
              Buscar club
            </Link>
          </Button>
          <Button asChild className="flex-1">
            <Link href="/clubs/new">Crear club</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
