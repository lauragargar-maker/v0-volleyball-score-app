import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-4">
      <Card className="w-full max-w-sm border-destructive/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-xl">Error de autenticacion</CardTitle>
          <CardDescription>
            Hubo un problema al verificar tu identidad. El enlace puede haber expirado o ser invalido.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Link href="/auth/login">
            <Button className="w-full">Intentar de nuevo</Button>
          </Link>
          <Link href="/">
            <Button variant="outline" className="w-full bg-transparent">
              Volver al inicio
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
