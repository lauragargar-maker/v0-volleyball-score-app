"use client"

import type React from "react"
import { useEffect, useState, useRef } from "react"
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, UserPlus, KeyRound, Loader2, Info } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { emailExists } from "../actions"

export default function RegisterPage() {
  const searchParams = useSearchParams()
  const initialEmail = searchParams.get("email") ?? ""
  const divertedFromLogin = searchParams.get("divertedFrom") === "login"

  const [email, setEmail] = useState(initialEmail)
  const [displayName, setDisplayName] = useState("")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState<"email" | "otp">("email")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [divertMessage, setDivertMessage] = useState<string | null>(
    divertedFromLogin
      ? "Este correo aún no está registrado. Te llevamos al registro para que crees tu cuenta."
      : null,
  )
  const turnstileRef = useRef<TurnstileInstance>(null)
  const router = useRouter()

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    setEmail(initialEmail)
  }, [initialEmail])

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()

    if (siteKey && !captchaToken) {
      setError("Por favor completa la verificación de seguridad.")
      return
    }

    setIsLoading(true)
    setError(null)
    setDivertMessage(null)

    const { exists } = await emailExists(email)

    if (exists) {
      const params = new URLSearchParams({ email, divertedFrom: "register" })
      router.replace(`/auth/login?${params.toString()}`)
      return
    }

    const supabase = createClient()
    const trimmedName = displayName.trim()
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase(),
      options: {
        shouldCreateUser: true,
        ...(trimmedName ? { data: { display_name: trimmedName } } : {}),
        ...(captchaToken ? { captchaToken } : {}),
      },
    })

    turnstileRef.current?.reset()
    setCaptchaToken(null)

    if (otpError) {
      setError(otpError.message)
      setIsLoading(false)
      return
    }

    setStep("otp")
    setIsLoading(false)
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.toLowerCase(),
      token: otp,
      type: "email",
    })

    if (verifyError) {
      setError("Código inválido o expirado")
      setIsLoading(false)
      return
    }

    router.push("/onboarding")
  }

  const handleBack = () => {
    setStep("email")
    setOtp("")
    setError(null)
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              {step === "email" ? (
                <UserPlus className="h-6 w-6 text-primary" />
              ) : (
                <KeyRound className="h-6 w-6 text-primary" />
              )}
            </div>
            <CardTitle className="text-2xl font-bold">
              {step === "email" ? "Crear cuenta" : "Introduce el código"}
            </CardTitle>
            <CardDescription>
              {step === "email"
                ? "Crea tu cuenta para empezar a usar VolleyScore."
                : `Te hemos enviado un código a ${email}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "email" ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                {divertMessage && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>{divertMessage}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayName">Tu nombre (opcional)</Label>
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="Nombre y apellidos"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    autoComplete="name"
                    className="h-12"
                  />
                  <p className="text-xs text-muted-foreground">
                    Aparecerá como autor de los partidos que anotes. Si lo dejas en blanco, usaremos tu
                    correo.
                  </p>
                </div>

                {siteKey && (
                  <div className="flex justify-center">
                    <Turnstile
                      ref={turnstileRef}
                      siteKey={siteKey}
                      onSuccess={(token) => setCaptchaToken(token)}
                      onExpire={() => setCaptchaToken(null)}
                      onError={() => setCaptchaToken(null)}
                    />
                  </div>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button
                  type="submit"
                  className="h-12 w-full bg-primary hover:bg-primary/90"
                  disabled={isLoading || (!!siteKey && !captchaToken)}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Continuar"
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp">Código de verificación</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                    autoComplete="one-time-code"
                    className="h-12 text-center text-2xl tracking-widest"
                    maxLength={6}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="h-12 w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    "Verificar"
                  )}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  ¿Email incorrecto?
                </Button>
              </form>
            )}
            <div className="mt-6 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                ¿Ya tienes cuenta?{" "}
                <Link
                  href={email ? `/auth/login?email=${encodeURIComponent(email)}` : "/auth/login"}
                  className="text-foreground underline-offset-4 hover:underline"
                >
                  Iniciar sesión
                </Link>
              </p>
              <Link href="/" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
                Volver al inicio
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
