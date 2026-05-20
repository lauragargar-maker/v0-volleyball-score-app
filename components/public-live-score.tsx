"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Match, Set } from "@/lib/types"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Maximize2, Minimize2, Radio } from "lucide-react"

interface PublicLiveScoreProps {
  matchId: string
}

export function PublicLiveScore({ matchId }: PublicLiveScoreProps) {
  const [match, setMatch] = useState<Match | null>(null)
  const [sets, setSets] = useState<Set[]>([])
  const [currentSet, setCurrentSet] = useState<Set | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPresenting, setIsPresenting] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

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

  // Keep local state in sync if the user exits native fullscreen (e.g. Esc)
  useEffect(() => {
    const handleChange = () => {
      if (!document.fullscreenElement) {
        setIsPresenting(false)
      }
    }
    document.addEventListener("fullscreenchange", handleChange)
    return () => document.removeEventListener("fullscreenchange", handleChange)
  }, [])

  const togglePresenting = () => {
    if (isPresenting) {
      setIsPresenting(false)
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    } else {
      setIsPresenting(true)
      // True fullscreen where supported; the CSS overlay covers browsers
      // (e.g. iOS Safari) that don't support element fullscreen.
      rootRef.current?.requestFullscreen?.().catch(() => {})
    }
  }

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

  const scoreSize = isPresenting
    ? "text-[clamp(5rem,22vw,20rem)] leading-none"
    : "text-6xl md:text-8xl lg:text-9xl"
  const teamNameSize = isPresenting
    ? "mb-4 text-2xl sm:text-3xl md:text-4xl lg:text-5xl"
    : "mb-2 text-sm md:mb-3 md:text-xl lg:text-2xl"
  const vsSize = isPresenting
    ? "text-3xl md:text-5xl lg:text-6xl"
    : "text-2xl md:text-4xl lg:text-5xl"

  return (
    <div
      ref={rootRef}
      className={
        isPresenting
          ? "fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 overflow-y-auto bg-background p-6 md:gap-10 md:p-10"
          : "relative space-y-6 md:space-y-8"
      }
    >
      {/* Presentation toggle */}
      <button
        type="button"
        onClick={togglePresenting}
        aria-label={isPresenting ? "Salir de pantalla completa" : "Pantalla completa"}
        className="absolute right-0 top-0 z-10 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:h-11 md:w-11"
      >
        {isPresenting ? (
          <Minimize2 className="h-5 w-5 md:h-6 md:w-6" />
        ) : (
          <Maximize2 className="h-5 w-5 md:h-6 md:w-6" />
        )}
      </button>

      {/* Status indicator */}
      <div className="flex items-center justify-center gap-2 md:gap-3">
        {match.status === "in_progress" ? (
          <>
            <span className="relative flex h-3 w-3 md:h-4 md:w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-primary md:h-4 md:w-4" />
            </span>
            <span className="text-sm font-medium text-primary md:text-lg lg:text-xl">EN VIVO</span>
          </>
        ) : match.status === "finished" ? (
          <Badge variant="secondary" className="md:px-3 md:py-1 md:text-base">FINALIZADO</Badge>
        ) : (
          <Badge variant="destructive" className="md:px-3 md:py-1 md:text-base">CANCELADO</Badge>
        )}
      </div>

      {/* Main score card */}
      <Card
        className={
          isPresenting
            ? "w-full max-w-6xl overflow-hidden border-0 bg-transparent shadow-none"
            : "w-full overflow-hidden"
        }
      >
        {/* Sets won header */}
        <div className="flex items-center justify-between bg-muted/50 px-4 py-2 md:px-6 md:py-3">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground md:text-sm">
            Sets
          </span>
          <div className="flex gap-6 md:gap-8">
            <span className="text-lg font-bold md:text-2xl lg:text-3xl">{match.home_sets_won}</span>
            <span className="text-lg font-bold text-muted-foreground md:text-2xl lg:text-3xl">-</span>
            <span className="text-lg font-bold md:text-2xl lg:text-3xl">{match.away_sets_won}</span>
          </div>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground md:text-sm">
            {isFinished ? "Final" : `Set ${currentSet?.set_number || 1}`}
          </span>
        </div>

        {/* Team scores */}
        <div className="p-6 md:p-10 lg:p-14">
          <div className="flex items-center justify-between gap-4 md:gap-8">
            {/* Home team */}
            <div className="flex-1 text-center">
              <p className={`truncate font-medium text-muted-foreground ${teamNameSize}`}>
                {match.home_team}
              </p>
              <div className={`font-bold tabular-nums text-primary ${scoreSize}`}>
                {currentSet?.home_score || 0}
              </div>
            </div>

            {/* Divider */}
            <div className="flex flex-col items-center gap-2">
              <span className={`font-light text-muted-foreground ${vsSize}`}>vs</span>
            </div>

            {/* Away team */}
            <div className="flex-1 text-center">
              <p className={`truncate font-medium text-muted-foreground ${teamNameSize}`}>
                {match.away_team}
              </p>
              <div className={`font-bold tabular-nums text-secondary ${scoreSize}`}>
                {currentSet?.away_score || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Winner banner for finished matches */}
        {match.status === "finished" && match.winner && (
          <div className="border-t border-border/40 bg-primary/10 px-4 py-3 text-center md:py-4">
            <p className="text-sm font-medium text-primary md:text-lg">
              Ganador: {match.winner === "home" ? match.home_team : match.away_team}
            </p>
          </div>
        )}

        {/* Cancelled reason */}
        {match.status === "cancelled" && match.cancellation_reason && (
          <div className="border-t border-border/40 bg-destructive/10 px-4 py-3 text-center md:py-4">
            <p className="text-sm text-muted-foreground md:text-base">
              Motivo: {match.cancellation_reason}
            </p>
          </div>
        )}
      </Card>

      {/* Sets results (secondary, kept compact) */}
      {sets.length > 0 && (
        <div className="w-full space-y-2 md:space-y-3">
          <h3 className={`text-sm font-medium text-muted-foreground ${isPresenting ? "text-center" : ""}`}>
            Resultado de sets
          </h3>
          <div className="flex flex-wrap justify-center gap-2 md:gap-3">
            {sets.map((set) => (
              <Card
                key={set.id}
                className={`min-w-[5rem] px-3 py-2 text-center md:min-w-[6rem] md:px-4 md:py-3 ${
                  set.status === "in_progress" ? "ring-2 ring-primary" : ""
                }`}
              >
                <p className="mb-1 text-xs text-muted-foreground md:text-sm">Set {set.set_number}</p>
                <p className="font-semibold tabular-nums md:text-lg">
                  <span className={set.winner === "home" ? "text-primary" : ""}>
                    {set.home_score}
                  </span>
                  <span className="mx-1 text-muted-foreground">-</span>
                  <span className={set.winner === "away" ? "text-secondary" : ""}>
                    {set.away_score}
                  </span>
                </p>
                {set.status === "finished" && (
                  <Badge variant="secondary" className="mt-1 max-w-full truncate text-[10px] md:text-xs">
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
