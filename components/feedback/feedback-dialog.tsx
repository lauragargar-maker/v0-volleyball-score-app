"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/components/auth-provider"
import { Loader2 } from "lucide-react"

const MESSAGE_MAX = 2000

type FeedbackType = "bug" | "idea" | "other"

interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const { user } = useAuth()
  const { toast } = useToast()

  const [type, setType] = useState<FeedbackType>("other")
  const [message, setMessage] = useState("")
  const [email, setEmail] = useState(user?.email ?? "")
  const [honeypot, setHoneypot] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const trimmedMessage = message.trim()
  const canSubmit = trimmedMessage.length > 0 && !isSubmitting

  const resetForm = () => {
    setType("other")
    setMessage("")
    setEmail(user?.email ?? "")
    setHoneypot("")
  }

  const handleClose = () => {
    if (isSubmitting) return
    onOpenChange(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          message: trimmedMessage,
          email: email.trim(),
          honeypot,
          route: typeof window !== "undefined" ? window.location.pathname : "",
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }

      if (res.ok && data.ok) {
        toast({
          title: "¡Gracias!",
          description: "He recibido tu mensaje.",
        })
        resetForm()
        onOpenChange(false)
      } else {
        toast({
          title: "No se pudo enviar",
          description: data.error ?? "Inténtalo de nuevo en un momento.",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "No se pudo enviar",
        description: "Comprueba tu conexión e inténtalo de nuevo.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar feedback</DialogTitle>
          <DialogDescription>
            Cuéntanos qué te parece VolleyScore. Leo todos los mensajes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <RadioGroup
              value={type}
              onValueChange={(value) => setType(value as FeedbackType)}
              className="flex gap-4"
              disabled={isSubmitting}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="bug" id="feedback-type-bug" />
                <Label htmlFor="feedback-type-bug" className="font-normal cursor-pointer">
                  Error
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="idea" id="feedback-type-idea" />
                <Label htmlFor="feedback-type-idea" className="font-normal cursor-pointer">
                  Idea
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="other" id="feedback-type-other" />
                <Label htmlFor="feedback-type-other" className="font-normal cursor-pointer">
                  Otro
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-message">Mensaje</Label>
            <Textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribe aquí tu comentario, idea o problema..."
              maxLength={MESSAGE_MAX}
              rows={5}
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-email">Email (opcional)</Label>
            <Input
              id="feedback-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              autoComplete="email"
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">Para que pueda responderte.</p>
          </div>

          {/* Honeypot: hidden from humans, bots tend to fill it. */}
          <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
            <label htmlFor="feedback-company">No rellenar</label>
            <input
              id="feedback-company"
              name="company"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
