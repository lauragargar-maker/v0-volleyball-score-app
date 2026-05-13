"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Loader2 } from "lucide-react"

interface ReclaimDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentScorerLabel: string
  isPending: boolean
  onConfirm: () => void
}

export function ReclaimDialog({
  open,
  onOpenChange,
  currentScorerLabel,
  isPending,
  onConfirm,
}: ReclaimDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Reclamar el marcador
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium">{currentScorerLabel}</span> esta gestionando
            el marcador actualmente. Si continuas, perdera la capacidad de editarlo y
            recibira una notificacion.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reclamando...
              </>
            ) : (
              "Reclamar marcador"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
