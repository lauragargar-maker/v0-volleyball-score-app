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

// @supabase/ssr's createBrowserClient persists the session in cookies (not
// localStorage): either a single `sb-<ref>-auth-token` cookie or chunked
// `sb-<ref>-auth-token.0`, `.1`, ... cookies, with the JSON payload encoded
// as `base64-<base64url>`.
function readSessionCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const cookies = document.cookie.split("; ")
  const valueOf = (key: string): string | null => {
    const match = cookies.find((c) => c.startsWith(`${key}=`))
    return match ? decodeURIComponent(match.slice(key.length + 1)) : null
  }
  const direct = valueOf(name)
  if (direct !== null) return direct
  const chunks: string[] = []
  for (let i = 0; ; i++) {
    const chunk = valueOf(`${name}.${i}`)
    if (chunk === null) break
    chunks.push(chunk)
  }
  return chunks.length > 0 ? chunks.join("") : null
}

function decodeSessionCookie(raw: string): string {
  if (!raw.startsWith("base64-")) return raw
  const base64 = raw.slice("base64-".length).replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
  return atob(padded)
}

function readCachedSession(): User | null {
  try {
    const raw = readSessionCookie(getSupabaseStorageKey())
    if (!raw) return null
    const parsed = JSON.parse(decodeSessionCookie(raw))
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
  const [user, setUser] = useState<User | null>(() => readCachedSession())
  const [isLoading, setIsLoading] = useState(user === null)
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

      // Keep the user object identity stable across TOKEN_REFRESHED echoes
      // (fired every time the tab resumes): a new object here cascades into
      // membership refetches and match reloads in downstream providers.
      setUser((prev) =>
        prev && prev.id === currentUser.id && prev.updated_at === currentUser.updated_at ? prev : currentUser,
      )
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
