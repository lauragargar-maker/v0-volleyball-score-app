"use client"

import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"

interface LockedBannerProps {
  scorerLabel: string
  onReclaim: () => void
}

export function LockedBanner({ scorerLabel, onReclaim }: LockedBannerProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Lock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-amber-900 dark:text-amber-100">
            {scorerLabel} esta gestionando el marcador
          </p>
          <p className="text-sm text-amber-800/80 dark:text-amber-100/80">
            Solo puedes ver el marcador. Reclama el control si necesitas editarlo.
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onReclaim} className="shrink-0">
        Reclamar marcador
      </Button>
    </div>
  )
}
