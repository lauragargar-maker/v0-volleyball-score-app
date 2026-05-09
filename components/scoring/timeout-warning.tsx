"use client"

import { AlertTriangle, X } from "lucide-react"

interface TimeoutWarningProps {
  onDismiss?: () => void
}

export function TimeoutWarning({ onDismiss }: TimeoutWarningProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="font-medium text-amber-900 dark:text-amber-100">
          Tu sesion de marcador esta a punto de expirar
        </p>
        <p className="text-sm text-amber-800/80 dark:text-amber-100/80">
          Si no actualizas el marcador en 1 minuto, otro miembro podra tomarlo.
        </p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-amber-900/60 hover:text-amber-900 dark:text-amber-100/60 dark:hover:text-amber-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
