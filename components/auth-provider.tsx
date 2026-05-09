"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  signOut: async () => {},
})

function getSupabaseStorageKey(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  let projectRef = ""
  if (url.includes(".supabase.co")) {
    try {
      projectRef = new URL(url).hostname.split(".")[0]
    } catch {}
  } else {
    projectRef = url.split("/").filter(Boolean).pop() ?? ""
  }
  return `sb-${projectRef}-auth-token`
}

function readCachedSession(): User | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(getSupabaseStorageKey())
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const user = parsed?.user ?? null
    if (!user?.email) return null
    const expiresAt: number = parsed?.expires_at ?? 0
    if (expiresAt && expiresAt < Math.floor(Date.now() / 1000)) return null
    return user as User
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const cachedUser = readCachedSession()

  const [user, setUser] = useState<User | null>(cachedUser)
  const [isLoading, setIsLoading] = useState(cachedUser === null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    const supabase = createClient()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMountedRef.current) return

      const currentUser = session?.user ?? null

      if (event === "SIGNED_OUT" || !currentUser) {
        setUser(null)
        setIsLoading(false)
        return
      }

      setUser(currentUser)
      setIsLoading(false)
    })

    return () => {
      isMountedRef.current = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      if (isMountedRef.current) {
        setUser(null)
      }
    } catch {
      // Silently handle errors
    }
  }, [])

  return <AuthContext.Provider value={{ user, isLoading, signOut }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
