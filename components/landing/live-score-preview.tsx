import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

// Presentational mirror of components/live-score.tsx for the landing-page hero.
// Hardcoded fake match: keep visually aligned with the real live-score view when its
// structure changes meaningfully (this file does not import from it to avoid pulling
// data-fetching code into a static marketing surface).

const fakeMatch = {
  home_team: "Voleibol Pamplona",
  away_team: "CV Tudela",
  home_sets_won: 2,
  away_sets_won: 1,
  current_set_number: 4,
  current_home_score: 18,
  current_away_score: 21,
  previous_sets: [
    { number: 1, home: 25, away: 21, winner: "home" as const },
    { number: 2, home: 22, away: 25, winner: "away" as const },
    { number: 3, home: 25, away: 18, winner: "home" as const },
  ],
}

export function LiveScorePreview() {
  return (
    <div
      role="img"
      aria-label="Vista previa del marcador en vivo: Voleibol Pamplona contra CV Tudela, sets 2 a 1, punto actual 18-21."
      className="mx-auto w-full max-w-[400px] rounded-2xl border border-border/60 bg-card p-4 shadow-2xl shadow-primary/5 sm:p-6"
    >
      <div className="space-y-5">
        {/* Live indicator */}
        <div className="flex items-center justify-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <span className="text-xs font-medium text-primary">EN VIVO</span>
        </div>

        {/* Main score card */}
        <Card className="overflow-hidden">
          {/* Sets won header */}
          <div className="flex items-center justify-between bg-muted/50 px-4 py-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Sets
            </span>
            <div className="flex gap-4">
              <span className="text-base font-bold">{fakeMatch.home_sets_won}</span>
              <span className="text-base font-bold text-muted-foreground">-</span>
              <span className="text-base font-bold">{fakeMatch.away_sets_won}</span>
            </div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Set {fakeMatch.current_set_number}
            </span>
          </div>

          {/* Team scores */}
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 text-center">
                <p className="mb-1 truncate text-xs font-medium text-muted-foreground">
                  {fakeMatch.home_team}
                </p>
                <div className="text-5xl font-bold tabular-nums text-primary">
                  {fakeMatch.current_home_score}
                </div>
              </div>
              <span className="text-xl font-light text-muted-foreground">vs</span>
              <div className="flex-1 text-center">
                <p className="mb-1 truncate text-xs font-medium text-muted-foreground">
                  {fakeMatch.away_team}
                </p>
                <div className="text-5xl font-bold tabular-nums text-secondary">
                  {fakeMatch.current_away_score}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Previous sets */}
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground">Resultado de sets</h3>
          <div className="grid grid-cols-3 gap-2">
            {fakeMatch.previous_sets.map((set) => (
              <Card key={set.number} className="p-2 text-center">
                <p className="mb-0.5 text-[10px] text-muted-foreground">Set {set.number}</p>
                <p className="text-sm font-semibold tabular-nums">
                  <span className={set.winner === "home" ? "text-primary" : ""}>{set.home}</span>
                  <span className="mx-1 text-muted-foreground">-</span>
                  <span className={set.winner === "away" ? "text-secondary" : ""}>{set.away}</span>
                </p>
                <Badge variant="secondary" className="mt-1 text-[9px]">
                  {set.winner === "home" ? fakeMatch.home_team : fakeMatch.away_team}
                </Badge>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
