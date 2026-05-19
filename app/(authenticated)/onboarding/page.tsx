"use client"

import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Users } from "lucide-react"

export default function OnboardingPage() {
  return (
    <div className="px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Bienvenido a VolleyScore</h1>
          <p className="text-muted-foreground">
            Para empezar, crea un nuevo club o unete a uno existente.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-6 flex flex-col items-center text-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Plus className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Crear un club</h2>
              <p className="text-sm text-muted-foreground">
                Crea un club nuevo y empieza a guardar info de partidos
              </p>
            </div>
            <Button asChild className="w-full">
              <Link href="/clubs/new">Crear club</Link>
            </Button>
          </Card>

          <Card className="p-6 flex flex-col items-center text-center gap-4">
            <div className="h-12 w-12 rounded-full bg-secondary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Unirme a un club</h2>
              <p className="text-sm text-muted-foreground">
                Solicita unirte a un club existente buscandolo por nombre o codigo.
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                /* TODO: emit analytics event when instrumentation lands */
              }}
            >
              Proximamente
            </Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
