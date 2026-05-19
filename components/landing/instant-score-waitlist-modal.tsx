"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import { joinInstantScoreWaitlist } from "@/app/(public)/auth/actions"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface InstantScoreWaitlistModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InstantScoreWaitlistModal({ open, onOpenChange }: InstantScoreWaitlistModalProps) {
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const trimmed = email.trim()
  const isValidEmail = EMAIL_REGEX.test(trimmed)

  const handleClose = () => {
    if (isSubmitting) return
    onOpenChange(false)
    setEmail("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidEmail || isSubmitting) return

    setIsSubmitting(true)
    const result = await joinInstantScoreWaitlist(trimmed)
    setIsSubmitting(false)

    if (result.ok) {
      toast({
        title: "¡Gracias!",
        description: "Te avisaremos cuando esté lista.",
      })
      onOpenChange(false)
      setEmail("")
    } else {
      toast({
        title: "No hemos podido guardar tu correo",
        description: "Inténtalo de nuevo en un momento.",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Próximamente</DialogTitle>
          <DialogDescription>
            Estamos terminando esta funcionalidad. Déjanos tu correo y te avisamos en cuanto esté
            lista.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="waitlist-email">Correo electrónico</Label>
            <Input
              id="waitlist-email"
              type="email"
              placeholder="usuario@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={isSubmitting}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
              Cerrar
            </Button>
            {isValidEmail && (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Avísame"
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
