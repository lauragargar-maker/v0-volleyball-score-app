"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { MessageCircle } from "lucide-react"
import { FeedbackDialog } from "@/components/feedback/feedback-dialog"

export function FeedbackButton() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Suppress on the public live-score share page — spectators didn't opt into VolleyScore.
  if (pathname?.startsWith("/live/")) return null

  return (
    <>
      {!open && (
        <Button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Enviar feedback"
          className="fixed bottom-4 right-4 z-40 h-11 gap-2 rounded-full shadow-lg"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="hidden sm:inline">Feedback</span>
        </Button>
      )}
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
