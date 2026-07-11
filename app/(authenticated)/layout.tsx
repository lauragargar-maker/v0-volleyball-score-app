"use client"

import type React from "react"
import { useSyncExternalStore } from "react"
import { useAuth } from "@/components/auth-provider"
import { ClubProvider, useClub } from "@/components/club-provider"
import { AuthenticatedHeader } from "@/components/authenticated-header"

const emptySubscribe = () => () => {}

// False during SSR and the hydration render, true right after. The providers
// seed user/memberships synchronously on the client, so without this the
// hydration render (content) would not match the server HTML (spinner).
function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
}

function Inner({ children }: { children: React.ReactNode }) {
  const { isLoading: authLoading } = useAuth()
  const { isLoading: clubLoading } = useClub()
  const hydrated = useHydrated()
  const isLoading = !hydrated || authLoading || clubLoading

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <AuthenticatedHeader />
      <main>{children}</main>
    </div>
  )
}

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClubProvider>
      <Inner>{children}</Inner>
    </ClubProvider>
  )
}
