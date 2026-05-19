"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { createClub } from "./actions"
import { useClub } from "@/components/club-provider"

export default function NewClubPage() {
  const router = useRouter()
  const { refresh, setActiveClub } = useClub()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createClub(fd)
      if (!result.ok) {
        setError(result.error ?? "No se pudo crear el club.")
        return
      }
      await refresh()
      if (result.clubId) setActiveClub(result.clubId)
      router.push("/home")
    })
  }

  return (
    <div className="px-4 py-12">
      <div className="mx-auto max-w-xl space-y-4">
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>

        <Card className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Crear un club</h1>
            <p className="text-sm text-muted-foreground">
              Podrás apuntar partidos, compartirlos y guardarlos en el histórico del club.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del club</Label>
              <Input
                id="name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={80}
                placeholder="Ej: Club Volei Madrid"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripcion (opcional)</Label>
              <Textarea
                id="description"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Una breve descripcion del club"
                rows={3}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                "Crear club"
              )}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
