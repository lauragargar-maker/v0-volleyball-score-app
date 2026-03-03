import { createClient } from "@/lib/supabase/server"
import { MatchHistoryList } from "@/components/match-history-list"

export default async function HistorialPage() {
  const supabase = await createClient()

  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .in("status", ["finished", "cancelled"])
    .order("finished_at", { ascending: false })

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Historial de Partidos</h1>
          <p className="text-muted-foreground">Consulta los resultados de partidos anteriores</p>
        </div>
        <MatchHistoryList initialMatches={matches || []} />
      </div>
    </div>
  )
}
