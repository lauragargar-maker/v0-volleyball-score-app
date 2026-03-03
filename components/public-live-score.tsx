"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Match, Set } from "@/lib/types"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Radio } from "lucide-react"

interface PublicLiveScoreProps {
  matchId: string
}

export function PublicLiveScore({ matchId }: PublicLiveScoreProps) {
  const [match, setMatch] = useState<Match | null>(null)
  const [sets, setSets] = useState<Set[]>([])
  const [currentSet, setCurrentSet] = useState<Set | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const fetchMatch = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const { data, error: matchError } = await supabase
          .from("matches")
          .select("*")
          .eq("id", matchId)
          .single()

        if (matchError) {
          setError("No se encontro el partido")
          setIsLoading(false)
          return
        }

        setMatch(data)

        const { data: setsData } = await supabase
          .from("sets")
          .select("*")
          .eq("match_id", data.id)
          .order("set_number", { ascending: true })

        if (setsData) {
          setSets(setsData)
          const active = setsData.find((s) => s.status === "in_progress")
          setCurrentSet(active || setsData[setsData.length - 1] || null)
        }
      } catch {
        setError("Error al cargar el partido")
      } finally {
        setIsLoading(false)
      }
    }

    fetchMatch()

    // Subscribe to realtime updates
    const matchChannel = supabase
      .channel(`match-${matchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `id=eq.${matchId}` },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            setMatch(payload.new as Match)
          }
        }
      )
      .subscribe()

    const setsChannel = supabase
      .channel(`sets-${matchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sets", filter: `match_id=eq.${matchId}` },
        (payload) => {
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            const newSet = payload.new as Set
            setSets((prev) => {
              const existing = prev.findIndex((s) => s.id === newSet.id)
              if (existing >= 0) {
                const updated = [...prev]
                updated[existing] = newSet
                return updated
              }
              return [...prev, newSet].sort((a, b) => a.set_number - b.set_number)
            })
            if (newSet.status === "in_progress") {
              setCurrentSet(newSet)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(matchChannel)
      supabase.removeChannel(setsChannel)
    }
  }, [matchId])

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <Radio className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="mb-2 text-xl font-semibold">Error</h2>
        <p className="text-muted-foreground">{error}</p>
      </Card>
    )
  }

  if (!match) {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Radio className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="mb-2 text-xl font-semibold">Partido no encontrado</h2>
        <p className="text-muted-foreground">
          El enlace puede estar incorrecto o el partido ya no existe.
        </p>
      </Card>
    )
  }

  const isFinished = match.status === "finished" || match.status === "cancelled"

  return (
    <div className="space-y-6">
      {/* Status indicator */}
      <div className="flex items-center justify-center gap-2">
        {match.status === "in_progress" ? (
          <>
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
            </span>
            <span className="text-sm font-medium text-primary">EN VIVO</span>
          </>
        ) : match.status === "finished" ? (
          <Badge variant="secondary">FINALIZADO</Badge>
        ) : (
          <Badge variant="destructive">CANCELADO</Badge>
        )}
      </div>

      {/* Main score card */}
      <Card className="overflow-hidden">
        {/* Sets won header */}
        <div className="flex items-center justify-between bg-muted/50 px-4 py-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Sets
          </span>
          <div className="flex gap-6">
            <span className="text-lg font-bold">{match.home_sets_won}</span>
            <span className="text-lg font-bold text-muted-foreground">-</span>
            <span className="text-lg font-bold">{match.away_sets_won}</span>
          </div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {isFinished ? "Final" : `Set ${currentSet?.set_number || 1}`}
          </span>
        </div>

        {/* Team scores */}
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            {/* Home team */}
            <div className="flex-1 text-center">
              <p className="mb-2 text-sm font-medium text-muted-foreground truncate">
                {match.home_team}
              </p>
              <div className="text-6xl font-bold tabular-nums text-primary">
                {currentSet?.home_score || 0}
              </div>
            </div>

            {/* Divider */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-2xl font-light text-muted-foreground">vs</span>
            </div>

            {/* Away team */}
            <div className="flex-1 text-center">
              <p className="mb-2 text-sm font-medium text-muted-foreground truncate">
                {match.away_team}
              </p>
              <div className="text-6xl font-bold tabular-nums text-secondary">
                {currentSet?.away_score || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Winner banner for finished matches */}
        {match.status === "finished" && match.winner && (
          <div className="bg-primary/10 px-4 py-3 text-center border-t border-border/40">
            <p className="text-sm font-medium text-primary">
              Ganador: {match.winner === "home" ? match.home_team : match.away_team}
            </p>
          </div>
        )}

        {/* Cancelled reason */}
        {match.status === "cancelled" && match.cancelled_reason && (
          <div className="bg-destructive/10 px-4 py-3 text-center border-t border-border/40">
            <p className="text-sm text-muted-foreground">
              Motivo: {match.cancelled_reason}
            </p>
          </div>
        )}
      </Card>

      {/* Sets results */}
      {sets.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Resultado de sets</h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {sets.map((set) => (
              <Card
                key={set.id}
                className={`p-3 text-center ${
                  set.status === "in_progress" ? "ring-2 ring-primary" : ""
                }`}
              >
                <p className="mb-1 text-xs text-muted-foreground">Set {set.set_number}</p>
                <p className="font-semibold tabular-nums">
                  <span className={set.winner === "home" ? "text-primary" : ""}>
                    {set.home_score}
                  </span>
                  <span className="mx-1 text-muted-foreground">-</span>
                  <span className={set.winner === "away" ? "text-secondary" : ""}>
                    {set.away_score}
                  </span>
                </p>
                {set.status === "finished" && (
                  <Badge variant="secondary" className="mt-1 text-[10px]">
                    {set.winner === "home" ? match.home_team : match.away_team}
                  </Badge>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
