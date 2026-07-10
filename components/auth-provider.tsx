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

// @supabase/ssr's browser client persists the session in cookies (not
// localStorage): `sb-<ref>-auth-token`, split into `.0`/`.1`... chunks when
// large, with the JSON optionally base64url-encoded behind a `base64-` prefix.
function readAuthCookieValue(key: string): string | null {
  const found: Record<string, string> = {}
  for (const part of document.cookie.split(";")) {
    const eq = part.indexOf("=")
    if (eq === -1) continue
    const name = part.slice(0, eq).trim()
    if (name !== key && !name.startsWith(`${key}.`)) continue
    const value = part.slice(eq + 1).trim()
    try {
      found[name] = decodeURIComponent(value)
    } catch {
      found[name] = value
    }
  }
  if (found[key]) return found[key]
  const chunks: string[] = []
  for (let i = 0; found[`${key}.${i}`] !== undefined; i++) {
    chunks.push(found[`${key}.${i}`])
  }
  return chunks.length > 0 ? chunks.join("") : null
}

function decodeSessionCookie(raw: string): unknown {
  if (!raw.startsWith("base64-")) return JSON.parse(raw)
  const b64 = raw.slice("base64-".length).replace(/-/g, "+").replace(/_/g, "/")
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4)
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

function readCachedSession(): User | null {
  if (typeof window === "undefined") return null
  try {
    const raw = readAuthCookieValue(getSupabaseStorageKey())
    if (!raw) return null
    const parsed = decodeSessionCookie(raw) as { user?: User | null; expires_at?: number } | null
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
