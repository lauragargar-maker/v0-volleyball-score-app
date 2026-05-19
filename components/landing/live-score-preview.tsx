import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Minus, Plus, Share2, Square } from "lucide-react"

// Presentational mirror of the scorer view in app/(authenticated)/home/page.tsx —
// the view the person annotating the match sees. Hardcoded fake match data; keep
// visually aligned with the real scoring UI when its structure changes meaningfully.
// This file does not import from the real component to keep the marketing surface
// free of data-fetching code.

const fakeMatch = {
  home_team: "Voleibol Pamplona",
  away_team: "CV Tudela",
  home_sets_won: 1,
  away_sets_won: 1,
  current_set_number: 3,
  current_home_score: 18,
  current_away_score: 21,
  sets: [
    { number: 1, home: 25, away: 21, status: "finished" as const, winner: "home" as const },
    { number: 2, home: 22, away: 25, status: "finished" as const, winner: "away" as const },
    { number: 3, home: 18, away: 21, status: "in_progress" as const, winner: null },
  ],
}

export function LiveScorePreview() {
  return (
    <div
      role="img"
      aria-label="Vista previa del anotador: Voleibol Pamplona contra CV Tudela, sets 1 a 1, set 3 en juego 18-21."
      className="mx-auto w-full max-w-[400px] rounded-2xl border border-border/60 bg-card p-4 shadow-2xl shadow-primary/5 sm:p-5"
    >
      <div className="space-y-4">
        {/* Match info header */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Partido en curso</h3>
            <p className="truncate text-xs text-muted-foreground">
              Set {fakeMatch.current_set_number} · Sets {fakeMatch.home_sets_won} – {fakeMatch.away_sets_won}
            </p>
          </div>
          <div className="flex flex-shrink-0 gap-1.5">
            <Button variant="outline" size="sm" className="h-7 bg-transparent px-2 text-xs">
              <Share2 className="mr-1 h-3 w-3" />
              Compartir
            </Button>
            <Button variant="destructive" size="sm" className="h-7 px-2 text-xs">
              <Square className="mr-1 h-3 w-3" />
              Finalizar
            </Button>
          </div>
        </div>

        {/* Score controls */}
        <div className="grid grid-cols-2 gap-2">
          {/* Home team */}
          <Card>
            <CardHeader className="pb-1 pt-3">
              <CardTitle className="truncate text-center text-xs font-medium text-muted-foreground">
                {fakeMatch.home_team}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-3">
              <div className="text-center text-5xl font-bold tabular-nums text-primary">
                {fakeMatch.current_home_score}
              </div>
              <div className="flex justify-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 rounded-full bg-transparent"
                  aria-hidden
                  tabIndex={-1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90"
                  aria-hidden
                  tabIndex={-1}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Away team */}
          <Card>
            <CardHeader className="pb-1 pt-3">
              <CardTitle className="truncate text-center text-xs font-medium text-muted-foreground">
                {fakeMatch.away_team}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-3">
              <div className="text-center text-5xl font-bold tabular-nums text-secondary">
                {fakeMatch.current_away_score}
              </div>
              <div className="flex justify-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 rounded-full bg-transparent"
                  aria-hidden
                  tabIndex={-1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  className="h-9 w-9 rounded-full bg-secondary hover:bg-secondary/90"
                  aria-hidden
                  tabIndex={-1}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sets summary */}
        <Card>
          <CardHeader className="pb-1 pt-3">
            <CardTitle className="text-xs font-medium">Resumen de Sets</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
              <div className="font-medium text-muted-foreground">Set</div>
              {fakeMatch.sets.map((set) => (
                <div
                  key={set.number}
                  className={
                    set.status === "in_progress"
                      ? "font-semibold text-primary"
                      : "text-muted-foreground"
                  }
                >
                  {set.number}
                </div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-4 gap-1.5 text-center text-xs">
              <div className="truncate text-muted-foreground">{fakeMatch.home_team}</div>
              {fakeMatch.sets.map((set) => (
                <div
                  key={`home-${set.number}`}
                  className={`font-semibold ${set.winner === "home" ? "text-primary" : ""}`}
                >
                  {set.home}
                </div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-4 gap-1.5 text-center text-xs">
              <div className="truncate text-muted-foreground">{fakeMatch.away_team}</div>
              {fakeMatch.sets.map((set) => (
                <div
                  key={`away-${set.number}`}
                  className={`font-semibold ${set.winner === "away" ? "text-secondary" : ""}`}
                >
                  {set.away}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
