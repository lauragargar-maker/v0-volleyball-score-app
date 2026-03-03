"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Match, Set } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Minus, Play, Square, Share2, Loader2, Trophy, AlertTriangle, Check, X } from "lucide-react"

export default function HomePage() {
  const [match, setMatch] = useState<Match | null>(null)
  const [sets, setSets] = useState<Set[]>([])
  const [currentSet, setCurrentSet] = useState<Set | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isStartingMatch, setIsStartingMatch] = useState(false)
  const [homeTeam, setHomeTeam] = useState("")
  const [awayTeam, setAwayTeam] = useState("")
  const [cancelReason, setCancelReason] = useState("")
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showNewMatchDialog, setShowNewMatchDialog] = useState(false)
  const [notification, setNotification] = useState<{
    show: boolean
    title: string
    description: string
    type: "success" | "error"
  }>({ show: false, title: "", description: "", type: "success" })

  const supabase = createClient()

  useEffect(() => {
    fetchActiveMatch()
  }, [])

  const fetchActiveMatch = async () => {
    setIsLoading(true)
    const { data: matchData } = await supabase
      .from("matches")
      .select("*")
      .eq("status", "in_progress")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (matchData) {
      setMatch(matchData)
      const { data: setsData } = await supabase
        .from("sets")
        .select("*")
        .eq("match_id", matchData.id)
        .order("set_number", { ascending: true })

      if (setsData) {
        setSets(setsData)
        const active = setsData.find((s) => s.status === "in_progress")
        setCurrentSet(active || null)
      }
    }
    setIsLoading(false)
  }

  const startNewMatch = async () => {
    if (!homeTeam.trim() || !awayTeam.trim()) {
      showNotification("Error", "Debes indicar el nombre de ambos equipos", "error")
      return
    }

    setIsStartingMatch(true)

    const { data: newMatch, error: matchError } = await supabase
      .from("matches")
      .insert({
        home_team: homeTeam.trim(),
        away_team: awayTeam.trim(),
        status: "in_progress",
      })
      .select()
      .single()

    if (matchError || !newMatch) {
      showNotification("Error", "No se pudo crear el partido", "error")
      setIsStartingMatch(false)
      return
    }

    const { data: firstSet } = await supabase
      .from("sets")
      .insert({
        match_id: newMatch.id,
        set_number: 1,
        status: "in_progress",
      })
      .select()
      .single()

    setMatch(newMatch)
    if (firstSet) {
      setSets([firstSet])
      setCurrentSet(firstSet)
    }

    setHomeTeam("")
    setAwayTeam("")
    setShowNewMatchDialog(false)
    setIsStartingMatch(false)

    showNotification("Partido iniciado", `${newMatch.home_team} vs ${newMatch.away_team}`)
  }

  const updateScore = async (team: "home" | "away", delta: number) => {
    if (!currentSet || !match) return

    const field = team === "home" ? "home_score" : "away_score"
    const newScore = Math.max(0, Math.min(25, currentSet[field] + delta))

    const { data: updatedSet } = await supabase
      .from("sets")
      .update({ [field]: newScore })
      .eq("id", currentSet.id)
      .select()
      .single()

    if (updatedSet) {
      setCurrentSet(updatedSet)
      setSets((prev) => prev.map((s) => (s.id === updatedSet.id ? updatedSet : s)))

      if (newScore >= 25 && Math.abs(updatedSet.home_score - updatedSet.away_score) >= 2) {
        await finishSet(updatedSet)
      }
    }
  }

  const finishSet = async (set: Set) => {
    if (!match) return

    const winner = set.home_score > set.away_score ? "home" : "away"

    await supabase.from("sets").update({ status: "finished", winner }).eq("id", set.id)

    const newHomeSets = match.home_sets_won + (winner === "home" ? 1 : 0)
    const newAwaySets = match.away_sets_won + (winner === "away" ? 1 : 0)

    if (newHomeSets >= 2 || newAwaySets >= 2) {
      await supabase
        .from("matches")
        .update({
          status: "finished",
          winner: newHomeSets >= 2 ? "home" : "away",
          home_sets_won: newHomeSets,
          away_sets_won: newAwaySets,
          finished_at: new Date().toISOString(),
        })
        .eq("id", match.id)

      showNotification("Partido finalizado", `Ganador: ${newHomeSets >= 2 ? match.home_team : match.away_team}`)

      setMatch(null)
      setSets([])
      setCurrentSet(null)
    } else {
      await supabase
        .from("matches")
        .update({
          home_sets_won: newHomeSets,
          away_sets_won: newAwaySets,
        })
        .eq("id", match.id)

      const { data: newSet } = await supabase
        .from("sets")
        .insert({
          match_id: match.id,
          set_number: sets.length + 1,
          status: "in_progress",
        })
        .select()
        .single()

      if (newSet) {
        setSets((prev) => [
          ...prev.map((s) => (s.id === set.id ? { ...s, status: "finished" as const, winner } : s)),
          newSet,
        ])
        setCurrentSet(newSet)
        setMatch((prev) => (prev ? { ...prev, home_sets_won: newHomeSets, away_sets_won: newAwaySets } : null))

        showNotification(`Set ${set.set_number} finalizado`, `Comienza el Set ${newSet.set_number}`)
      }
    }
  }

  const cancelMatch = async () => {
    if (!match) return

    await supabase
      .from("matches")
      .update({
        status: "cancelled",
        cancellation_reason: cancelReason || "Sin motivo especificado",
        finished_at: new Date().toISOString(),
      })
      .eq("id", match.id)

    showNotification("Partido cancelado", cancelReason || "El partido ha sido cancelado")

    setMatch(null)
    setSets([])
    setCurrentSet(null)
    setCancelReason("")
    setShowCancelDialog(false)
  }

  const shareMatch = async () => {
    if (!match || !currentSet) return

    // Generate public live score link
    const shareUrl = `${window.location.origin}/live/${match.id}`
    const scoreText = `${match.home_team} ${currentSet.home_score} - ${currentSet.away_score} ${match.away_team}`
    const setsText = `Sets: ${match.home_sets_won} - ${match.away_sets_won}`

    const shareData = {
      title: `${match.home_team} vs ${match.away_team}`,
      text: `${scoreText} (${setsText}) - Sigue el partido en vivo`,
      url: shareUrl,
    }

    const canShare = navigator.share && navigator.canShare?.(shareData)

    if (canShare) {
      try {
        await navigator.share(shareData)
        showNotification("Compartido", "El enlace ha sido compartido correctamente")
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          await copyToClipboard(shareUrl)
        }
      }
    } else {
      await copyToClipboard(shareUrl)
    }
  }

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      showNotification("Enlace copiado", "El enlace ha sido copiado al portapapeles")
    } catch {
      showNotification("Enlace del partido", url, "error")
    }
  }

  const showNotification = (title: string, description: string, type: "success" | "error" = "success") => {
    setNotification({ show: true, title, description, type })
    setTimeout(() => {
      setNotification((prev) => ({ ...prev, show: false }))
    }, 3000)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {notification.show && (
        <div className="fixed top-16 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <div
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg ${
              notification.type === "success"
                ? "border-secondary/30 bg-secondary/10 text-secondary"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {notification.type === "success" ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
            <div>
              <p className="font-medium">{notification.title}</p>
              <p className="text-sm opacity-80">{notification.description}</p>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {!match ? (
            <Card className="p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Trophy className="h-8 w-8 text-primary" />
              </div>
              <h2 className="mb-2 text-xl font-semibold">Panel de Control</h2>
              <p className="mb-6 text-muted-foreground">
                No hay ningun partido en curso. Inicia uno nuevo para comenzar a registrar puntos.
              </p>

              <Dialog open={showNewMatchDialog} onOpenChange={setShowNewMatchDialog}>
                <DialogTrigger asChild>
                  <Button size="lg" className="gap-2">
                    <Play className="h-5 w-5" />
                    Iniciar nuevo partido
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nuevo Partido</DialogTitle>
                    <DialogDescription>Introduce los nombres de los equipos para comenzar</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="homeTeam">Equipo Local</Label>
                      <Input
                        id="homeTeam"
                        placeholder="Nombre del equipo local"
                        value={homeTeam}
                        onChange={(e) => setHomeTeam(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="awayTeam">Equipo Visitante</Label>
                      <Input
                        id="awayTeam"
                        placeholder="Nombre del equipo visitante"
                        value={awayTeam}
                        onChange={(e) => setAwayTeam(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={startNewMatch} disabled={isStartingMatch} className="w-full">
                      {isStartingMatch ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Iniciando...
                        </>
                      ) : (
                        "Comenzar Partido"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </Card>
          ) : (
            <>
              {/* Match info header */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-semibold">Partido en curso</h1>
                  <p className="text-sm text-muted-foreground">
                    Set {currentSet?.set_number || 1} | Sets: {match.home_sets_won} - {match.away_sets_won}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={shareMatch} className="bg-transparent">
                    <Share2 className="mr-1 h-4 w-4" />
                    Compartir
                  </Button>
                  <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Square className="mr-1 h-4 w-4" />
                        Finalizar
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          Finalizar partido
                        </DialogTitle>
                        <DialogDescription>
                          Esta accion cancelara el partido antes de que termine normalmente. El resultado parcial se
                          guardara en el historial.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <Label htmlFor="reason">Motivo (opcional)</Label>
                        <Textarea
                          id="reason"
                          placeholder="Ej: Lluvia, lesion, etc."
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          className="mt-2"
                        />
                      </div>
                      <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setShowCancelDialog(false)} className="bg-transparent">
                          Continuar partido
                        </Button>
                        <Button variant="destructive" onClick={cancelMatch}>
                          Finalizar partido
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Score controls */}
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Home team */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-center text-sm font-medium text-muted-foreground">
                      {match.home_team}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center text-7xl font-bold tabular-nums text-primary">
                      {currentSet?.home_score || 0}
                    </div>
                    <div className="flex justify-center gap-3">
                      <Button
                        size="lg"
                        variant="outline"
                        className="h-14 w-14 rounded-full text-xl bg-transparent"
                        onClick={() => updateScore("home", -1)}
                        disabled={!currentSet || currentSet.home_score <= 0}
                      >
                        <Minus className="h-6 w-6" />
                        <span className="sr-only">Restar punto local</span>
                      </Button>
                      <Button
                        size="lg"
                        className="h-14 w-14 rounded-full bg-primary text-xl hover:bg-primary/90"
                        onClick={() => updateScore("home", 1)}
                        disabled={!currentSet || currentSet.home_score >= 25}
                      >
                        <Plus className="h-6 w-6" />
                        <span className="sr-only">Sumar punto local</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Away team */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-center text-sm font-medium text-muted-foreground">
                      {match.away_team}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center text-7xl font-bold tabular-nums text-secondary">
                      {currentSet?.away_score || 0}
                    </div>
                    <div className="flex justify-center gap-3">
                      <Button
                        size="lg"
                        variant="outline"
                        className="h-14 w-14 rounded-full text-xl bg-transparent"
                        onClick={() => updateScore("away", -1)}
                        disabled={!currentSet || currentSet.away_score <= 0}
                      >
                        <Minus className="h-6 w-6" />
                        <span className="sr-only">Restar punto visitante</span>
                      </Button>
                      <Button
                        size="lg"
                        className="h-14 w-14 rounded-full bg-secondary text-xl hover:bg-secondary/90"
                        onClick={() => updateScore("away", 1)}
                        disabled={!currentSet || currentSet.away_score >= 25}
                      >
                        <Plus className="h-6 w-6" />
                        <span className="sr-only">Sumar punto visitante</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sets summary */}
              {sets.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Resumen de Sets</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-5 gap-2 text-center text-sm">
                      <div className="font-medium text-muted-foreground">Set</div>
                      {sets.map((set) => (
                        <div
                          key={set.id}
                          className={
                            set.status === "in_progress" ? "font-semibold text-primary" : "text-muted-foreground"
                          }
                        >
                          {set.set_number}
                        </div>
                      ))}
                      {Array.from({ length: 4 - sets.length }).map((_, i) => (
                        <div key={`empty-${i}`} className="text-muted-foreground/30">
                          -
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 grid grid-cols-5 gap-2 text-center">
                      <div className="truncate text-xs text-muted-foreground">{match.home_team}</div>
                      {sets.map((set) => (
                        <div key={set.id} className={`font-semibold ${set.winner === "home" ? "text-primary" : ""}`}>
                          {set.home_score}
                        </div>
                      ))}
                      {Array.from({ length: 4 - sets.length }).map((_, i) => (
                        <div key={`empty-home-${i}`} className="text-muted-foreground/30">
                          -
                        </div>
                      ))}
                    </div>
                    <div className="mt-1 grid grid-cols-5 gap-2 text-center">
                      <div className="truncate text-xs text-muted-foreground">{match.away_team}</div>
                      {sets.map((set) => (
                        <div key={set.id} className={`font-semibold ${set.winner === "away" ? "text-secondary" : ""}`}>
                          {set.away_score}
                        </div>
                      ))}
                      {Array.from({ length: 4 - sets.length }).map((_, i) => (
                        <div key={`empty-away-${i}`} className="text-muted-foreground/30">
                          -
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
