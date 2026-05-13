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
import { Lock } from "lucide-react"

interface ReclaimedNoticeDialogProps {
  open: boolean
  newScorerLabel: string
  onClose: () => void
}

export function ReclaimedNoticeDialog({ open, newScorerLabel, onClose }: ReclaimedNoticeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-600" />
            Marcador reclamado
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium">{newScorerLabel}</span> ha reclamado la
            gestion del marcador. Ahora solo puedes ver el marcador.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onClose} className="w-full">
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
