"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { AdminRequest } from "@/lib/types"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Check, X, Clock, UserPlus, Loader2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"

interface AdminRequestsListProps {
  initialRequests: AdminRequest[]
}

export function AdminRequestsList({ initialRequests }: AdminRequestsListProps) {
  const [requests, setRequests] = useState<AdminRequest[]>(initialRequests)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    id: string
    action: "approve" | "reject"
    email: string
    name: string
  } | null>(null)
  const { toast } = useToast()

  const handleAction = async (id: string, action: "approve" | "reject", email: string) => {
    setProcessingId(id)
    const supabase = createClient()

    if (action === "approve") {
      // Add to admins table
      const { error: adminError } = await supabase.from("admins").insert({ email: email.toLowerCase() })

      if (adminError) {
        toast({
          title: "Error",
          description: "No se pudo aprobar la solicitud",
          variant: "destructive",
        })
        setProcessingId(null)
        return
      }
    }

    // Update request status
    const { error: updateError } = await supabase
      .from("admin_requests")
      .update({ status: action === "approve" ? "approved" : "rejected" })
      .eq("id", id)

    if (updateError) {
      toast({
        title: "Error",
        description: "No se pudo actualizar la solicitud",
        variant: "destructive",
      })
      setProcessingId(null)
      return
    }

    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: action === "approve" ? "approved" : "rejected" } : r)),
    )

    toast({
      title: action === "approve" ? "Solicitud aprobada" : "Solicitud rechazada",
      description:
        action === "approve" ? `${email} ahora tiene acceso de administrador` : "La solicitud ha sido rechazada",
    })

    setProcessingId(null)
    setConfirmAction(null)
  }

  const pendingRequests = requests.filter((r) => r.status === "pending")
  const processedRequests = requests.filter((r) => r.status !== "pending")

  if (requests.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <UserPlus className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="mb-2 text-xl font-semibold">Sin solicitudes</h2>
        <p className="text-muted-foreground">No hay solicitudes de acceso pendientes.</p>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {/* Pending requests */}
        {pendingRequests.length > 0 && (
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock className="h-4 w-4" />
              Pendientes ({pendingRequests.length})
            </h2>
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <Card key={request.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{request.name}</p>
                        <p className="text-sm text-muted-foreground">{request.email}</p>
                      </div>
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        Pendiente
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {request.reason && <p className="mb-3 text-sm text-muted-foreground">{request.reason}</p>}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(request.created_at), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-destructive hover:bg-destructive hover:text-destructive-foreground bg-transparent"
                          onClick={() =>
                            setConfirmAction({
                              id: request.id,
                              action: "reject",
                              email: request.email,
                              name: request.name,
                            })
                          }
                          disabled={processingId === request.id}
                        >
                          {processingId === request.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                          Rechazar
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1"
                          onClick={() =>
                            setConfirmAction({
                              id: request.id,
                              action: "approve",
                              email: request.email,
                              name: request.name,
                            })
                          }
                          disabled={processingId === request.id}
                        >
                          {processingId === request.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          Aprobar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Processed requests */}
        {processedRequests.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Procesadas ({processedRequests.length})</h2>
            <div className="space-y-2">
              {processedRequests.map((request) => (
                <Card key={request.id} className="bg-muted/30">
                  <CardContent className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">{request.name}</p>
                      <p className="text-sm text-muted-foreground">{request.email}</p>
                    </div>
                    <Badge variant={request.status === "approved" ? "default" : "destructive"}>
                      {request.status === "approved" ? "Aprobada" : "Rechazada"}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.action === "approve" ? "Aprobar solicitud" : "Rechazar solicitud"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === "approve"
                ? `¿Estás seguro de que quieres dar acceso de administrador a ${confirmAction?.name} (${confirmAction?.email})?`
                : `¿Estás seguro de que quieres rechazar la solicitud de ${confirmAction?.name}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmAction && handleAction(confirmAction.id, confirmAction.action, confirmAction.email)}
              className={confirmAction?.action === "reject" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {confirmAction?.action === "approve" ? "Aprobar" : "Rechazar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </>
  )
}
