"use client"

import { useState } from "react"
import { approveRequest, rejectRequest } from "./actions"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"

interface JoinRequestRow {
  id: string
  email: string
  created_at: string
}

export function RequestsList({ requests }: { requests: JoinRequestRow[] }) {
  const [pending, setPending] = useState<Record<string, "approving" | "rejecting" | "done" | "error">>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handle = async (id: string, action: "approve" | "reject") => {
    setPending((p) => ({ ...p, [id]: action === "approve" ? "approving" : "rejecting" }))
    setErrors((e) => { const next = { ...e }; delete next[id]; return next })

    const result =
      action === "approve" ? await approveRequest(id) : await rejectRequest(id)

    if (!result.ok) {
      setPending((p) => ({ ...p, [id]: "error" }))
      setErrors((e) => ({ ...e, [id]: result.error ?? "Error" }))
      return
    }
    setPending((p) => ({ ...p, [id]: "done" }))
  }

  if (requests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No hay solicitudes pendientes.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => {
        const state = pending[req.id]
        const isDone = state === "done"
        const isBusy = state === "approving" || state === "rejecting"

        return (
          <Card key={req.id} className={`p-4 flex items-center justify-between gap-4 ${isDone ? "opacity-50" : ""}`}>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{req.email}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(req.created_at).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              {errors[req.id] && (
                <p className="text-xs text-destructive mt-1">{errors[req.id]}</p>
              )}
            </div>

            {isDone ? (
              <span className="text-xs text-muted-foreground">Procesada</span>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handle(req.id, "reject")}
                  disabled={isBusy}
                  className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive h-8"
                >
                  {state === "rejecting" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  <span className="ml-1.5 hidden sm:inline">Rechazar</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => handle(req.id, "approve")}
                  disabled={isBusy}
                  className="h-8"
                >
                  {state === "approving" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5" />
                  )}
                  <span className="ml-1.5 hidden sm:inline">Aprobar</span>
                </Button>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
