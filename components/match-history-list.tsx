"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/components/auth-provider"
import type { Match, Set } from "@/lib/types"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calendar, Trophy, XCircle, ChevronRight, Loader2, Camera } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { MatchMediaGallery } from "@/components/match-media-gallery"

interface MatchHistoryListProps {
  initialMatches: Match[]
}

export function MatchHistoryList({ initialMatches }: MatchHistoryListProps) {
  const { isAdmin } = useAuth()
  const [matches] = useState<Match[]>(initialMatches)
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [matchSets, setMatchSets] = useState<Set[]>([])
  const [isLoadingSets, setIsLoadingSets] = useState(false)
  const [mediaMatch, setMediaMatch] = useState<Match | null>(null)

  const loadMatchDetails = async (match: Match) => {
    setSelectedMatch(match)
    setIsLoadingSets(true)

    const supabase = createClient()
    const { data: sets } = await supabase
      .from("sets")
      .select("*")
      .eq("match_id", match.id)
      .order("set_number", { ascending: true })

    setMatchSets(sets || [])
    setIsLoadingSets(false)
  }

  if (matches.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Calendar className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="mb-2 text-xl font-semibold">Sin partidos registrados</h2>
        <p className="text-muted-foreground">Cuando se completen partidos, aparecerán aquí.</p>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {matches.map((match) => (
          <Card
            key={match.id}
            className="cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() => loadMatchDetails(match)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {match.status === "finished" ? (
                    <Badge variant="secondary" className="gap-1">
                      <Trophy className="h-3 w-3" />
                      Finalizado
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <XCircle className="h-3 w-3" />
                      Cancelado
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {match.finished_at &&
                      formatDistanceToNow(new Date(match.finished_at), {
                        addSuffix: true,
                        locale: es,
                      })}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className={`font-medium ${match.winner === "home" ? "text-primary" : ""}`}>
                    {match.home_team}
                    {match.winner === "home" && <Trophy className="ml-1 inline h-3 w-3" />}
                  </p>
                  <p className={`font-medium ${match.winner === "away" ? "text-secondary" : ""}`}>
                    {match.away_team}
                    {match.winner === "away" && <Trophy className="ml-1 inline h-3 w-3" />}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold tabular-nums ${match.winner === "home" ? "text-primary" : ""}`}>
                    {match.home_sets_won}
                  </p>
                  <p className={`text-2xl font-bold tabular-nums ${match.winner === "away" ? "text-secondary" : ""}`}>
                    {match.away_sets_won}
                  </p>
                </div>
              </div>
              {match.status === "cancelled" && match.cancellation_reason && (
                <p className="mt-2 text-xs text-muted-foreground">Motivo: {match.cancellation_reason}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Match detail dialog */}
      <Dialog open={!!selectedMatch} onOpenChange={() => setSelectedMatch(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalle del Partido</DialogTitle>
          </DialogHeader>

          {selectedMatch && (
            <div className="space-y-4">
              {/* Teams and score */}
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className={`font-semibold ${selectedMatch.winner === "home" ? "text-primary" : ""}`}>
                      {selectedMatch.home_team}
                    </p>
                    <p className={`font-semibold ${selectedMatch.winner === "away" ? "text-secondary" : ""}`}>
                      {selectedMatch.away_team}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-3xl font-bold tabular-nums ${
                        selectedMatch.winner === "home" ? "text-primary" : ""
                      }`}
                    >
                      {selectedMatch.home_sets_won}
                    </p>
                    <p
                      className={`text-3xl font-bold tabular-nums ${
                        selectedMatch.winner === "away" ? "text-secondary" : ""
                      }`}
                    >
                      {selectedMatch.away_sets_won}
                    </p>
                  </div>
                </div>
              </div>

              {/* Sets breakdown */}
              <div>
                <h4 className="mb-2 text-sm font-medium text-muted-foreground">Resultado por Sets</h4>
                {isLoadingSets ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {matchSets.map((set) => (
                      <div key={set.id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                        <span className="text-sm text-muted-foreground">Set {set.set_number}</span>
                        <div className="flex items-center gap-4">
                          <span className={`font-semibold tabular-nums ${set.winner === "home" ? "text-primary" : ""}`}>
                            {set.home_score}
                          </span>
                          <span className="text-muted-foreground">-</span>
                          <span
                            className={`font-semibold tabular-nums ${set.winner === "away" ? "text-secondary" : ""}`}
                          >
                            {set.away_score}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                className="w-full gap-2 bg-transparent"
                onClick={(e) => {
                  e.stopPropagation()
                  setMediaMatch(selectedMatch)
                }}
              >
                <Camera className="h-4 w-4" />
                Ver fotos y videos
              </Button>

              {/* Match info */}
              <div className="border-t pt-4 text-sm text-muted-foreground">
                {selectedMatch.status === "cancelled" && (
                  <p className="mb-2">
                    <span className="font-medium text-destructive">Cancelado:</span> {selectedMatch.cancellation_reason}
                  </p>
                )}
                <p>
                  Fecha:{" "}
                  {selectedMatch.finished_at &&
                    new Date(selectedMatch.finished_at).toLocaleDateString("es-ES", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                </p>
              </div>

              <Button variant="outline" className="w-full bg-transparent" onClick={() => setSelectedMatch(null)}>
                Cerrar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {mediaMatch && (
        <MatchMediaGallery
          matchId={mediaMatch.id}
          isOpen={!!mediaMatch}
          onClose={() => setMediaMatch(null)}
          matchTitle={`${mediaMatch.home_team} vs ${mediaMatch.away_team}`}
        />
      )}
    </>
  )
}
