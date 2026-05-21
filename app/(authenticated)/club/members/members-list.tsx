"use client"

import { useState } from "react"
import { promoteMember, demoteMember, removeMember } from "./actions"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ShieldCheck, UserMinus, ArrowUp, ArrowDown, Loader2 } from "lucide-react"

interface MemberRow {
  userId: string
  email: string
  role: "admin" | "member"
  joinedAt: string
}

interface MembersListProps {
  clubId: string
  members: MemberRow[]
  currentUserId: string
}

export function MembersList({ clubId, members, currentUserId }: MembersListProps) {
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [localMembers, setLocalMembers] = useState(members)

  const run = async (
    userId: string,
    action: () => Promise<{ ok: boolean; error?: string }>,
    onSuccess: (prev: MemberRow[]) => MemberRow[],
  ) => {
    setBusy((b: Record<string, boolean>) => ({ ...b, [userId]: true }))
    setErrors((e: Record<string, string>) => { const next = { ...e }; delete next[userId]; return next })

    const result = await action()
    setBusy((b: Record<string, boolean>) => ({ ...b, [userId]: false }))

    if (!result.ok) {
      setErrors((e: Record<string, string>) => ({ ...e, [userId]: result.error ?? "Error" }))
      return
    }
    setLocalMembers(onSuccess)
  }

  const handlePromote = (m: MemberRow) =>
    run(
      m.userId,
      () => promoteMember(clubId, m.userId),
      (prev) => prev.map((x) => (x.userId === m.userId ? { ...x, role: "admin" } : x)),
    )

  const handleDemote = (m: MemberRow) =>
    run(
      m.userId,
      () => demoteMember(clubId, m.userId),
      (prev) => prev.map((x) => (x.userId === m.userId ? { ...x, role: "member" } : x)),
    )

  const handleRemove = (m: MemberRow) =>
    run(
      m.userId,
      () => removeMember(clubId, m.userId),
      (prev) => prev.filter((x) => x.userId !== m.userId),
    )

  if (localMembers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No hay miembros en este club.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {localMembers.map((m: MemberRow) => {
        const isSelf = m.userId === currentUserId
        const isBusy = !!busy[m.userId]

        return (
          <Card key={m.userId} className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-bold uppercase">
                {m.email.slice(0, 2)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {m.email}
                  {isSelf && <span className="ml-1.5 text-xs text-muted-foreground">(tú)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  Desde {new Date(m.joinedAt).toLocaleDateString("es-ES")}
                </p>
                {errors[m.userId] && (
                  <p className="text-xs text-destructive mt-0.5">{errors[m.userId]}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={m.role === "admin" ? "default" : "secondary"} className="gap-1">
                {m.role === "admin" && <ShieldCheck className="w-3 h-3" />}
                {m.role === "admin" ? "Admin" : "Miembro"}
              </Badge>

              {!isSelf && !isBusy && (
                <>
                  {m.role === "member" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Promover a admin"
                      onClick={() => handlePromote(m)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {m.role === "admin" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Degradar a miembro"
                      onClick={() => handleDemote(m)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                  )}

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Eliminar miembro"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar miembro?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se eliminará a <strong>{m.email}</strong> del club. Podrá volver a solicitar el acceso.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRemove(m)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}

              {isBusy && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
