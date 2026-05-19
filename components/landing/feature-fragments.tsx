import { Badge } from "@/components/ui/badge"
import { Copy, Link2, Play } from "lucide-react"

// Compact visual fragments used inside the landing-page feature tiles.
// Each fragment is purely presentational — hardcoded fake data, no
// interactivity. Designed to fit a narrow card (≈260-280px wide on lg,
// full-width on mobile) and a fixed-ish height that keeps the tile grid
// aligned regardless of which tile has a fragment vs. an icon.

const FRAGMENT_HEIGHT = "h-24" // ~96px — visual parity with the icon tile in vertical rhythm

/**
 * Score widget — companion to "Marcador en Tiempo Real".
 * Shows an EN VIVO pulse and a compact two-team score line.
 */
export function ScoreWidgetFragment() {
  return (
    <div
      aria-hidden
      className={`${FRAGMENT_HEIGHT} mb-4 flex flex-col justify-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2`}
    >
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-primary">
          En vivo · Set 3
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] text-muted-foreground">Voleibol Pamplona</p>
          <p className="text-2xl font-bold tabular-nums leading-none text-primary">18</p>
        </div>
        <span className="text-xs text-muted-foreground">—</span>
        <div className="min-w-0 flex-1 text-right">
          <p className="truncate text-[10px] text-muted-foreground">CV Tudela</p>
          <p className="text-2xl font-bold tabular-nums leading-none text-secondary">21</p>
        </div>
      </div>
    </div>
  )
}

/**
 * Share-link card — companion to "Fácil de Compartir".
 * Static visual mimic of the in-app share affordance.
 */
export function ShareLinkFragment() {
  return (
    <div
      aria-hidden
      className={`${FRAGMENT_HEIGHT} mb-4 flex flex-col justify-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2`}
    >
      <p className="text-[10px] font-medium text-muted-foreground">Enlace del partido</p>
      <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1.5">
        <Link2 className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        <span className="truncate text-xs font-mono text-foreground">
          volleyscore.app/live/x9q3a
        </span>
        <button
          type="button"
          tabIndex={-1}
          className="flex-shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
          aria-hidden
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

/**
 * Recent-matches list — companion to "Historial Completo".
 * Shows two compact past-match rows with final scores.
 */
type HistoryRow = {
  home: string
  away: string
  home_sets: number
  away_sets: number
  winner: "home" | "away"
}

const historyRows: HistoryRow[] = [
  {
    home: "Voleibol Pamplona",
    away: "CV Tudela",
    home_sets: 3,
    away_sets: 1,
    winner: "home",
  },
  {
    home: "CD Larrabide",
    away: "Voleibol Pamplona",
    home_sets: 3,
    away_sets: 2,
    winner: "home",
  },
]

/**
 * New-match starter — companion to "Acceso desde Cualquier Lugar".
 * Compact mirror of the empty-state "Iniciar nuevo partido" affordance,
 * showing two team-name pills and a primary action button.
 */
export function NewMatchFragment() {
  return (
    <div
      aria-hidden
      className={`${FRAGMENT_HEIGHT} mb-4 flex flex-col justify-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-2`}
    >
      <p className="text-[10px] font-medium text-muted-foreground">Nuevo partido</p>
      <div className="flex items-center gap-1.5">
        <div className="flex-1 truncate rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] text-foreground">
          Voleibol Pamplona
        </div>
        <span className="text-[10px] text-muted-foreground">vs</span>
        <div className="flex-1 truncate rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] text-foreground">
          CV Tudela
        </div>
      </div>
      <div className="flex justify-end">
        <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
          <Play className="h-2.5 w-2.5 fill-current" />
          Iniciar
        </span>
      </div>
    </div>
  )
}

export function HistoryListFragment() {
  return (
    <div
      aria-hidden
      className={`${FRAGMENT_HEIGHT} mb-4 flex flex-col justify-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-2`}
    >
      {historyRows.map((row, i) => (
        <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
          <span className="min-w-0 flex-1 truncate text-foreground">{row.home}</span>
          <span className="flex-shrink-0 font-semibold tabular-nums">
            <span className={row.winner === "home" ? "text-primary" : "text-muted-foreground"}>
              {row.home_sets}
            </span>
            <span className="mx-1 text-muted-foreground">-</span>
            <span className={row.winner === "away" ? "text-primary" : "text-muted-foreground"}>
              {row.away_sets}
            </span>
          </span>
          <span className="min-w-0 flex-1 truncate text-right text-foreground">{row.away}</span>
        </div>
      ))}
      <div className="flex justify-end">
        <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">
          2 más
        </Badge>
      </div>
    </div>
  )
}
