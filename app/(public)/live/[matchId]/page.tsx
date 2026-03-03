import { PublicLiveScore } from "@/components/public-live-score"

interface LiveMatchPageProps {
  params: Promise<{
    matchId: string
  }>
}

export default async function LiveMatchPage({ params }: LiveMatchPageProps) {
  const { matchId } = await params

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal header */}
      <header className="w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-12 max-w-screen-xl items-center justify-center px-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">VS</span>
            </div>
            <span className="font-medium text-foreground text-sm">VolleyScore</span>
          </div>
        </div>
      </header>

      {/* Score display */}
      <main className="container max-w-lg px-4 py-8">
        <PublicLiveScore matchId={matchId} />
      </main>
    </div>
  )
}
