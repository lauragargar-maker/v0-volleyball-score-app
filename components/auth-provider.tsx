"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

interface AuthContextType {
  user: User | null
  isAdmin: boolean
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  isLoading: true,
  signOut: async () => {},
})

// --- Sync localStorage helpers ---

function getSupabaseStorageKey(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  let projectRef = ""
  if (url.includes(".supabase.co")) {
    try { projectRef = new URL(url).hostname.split(".")[0] } catch {}
  } else {
    // Dashboard URL pattern: https://supabase.com/dashboard/project/{ref}
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

function readCachedAdminStatus(email: string): boolean | null {
  if (typeof window === "undefined") return null
  try {
    const val = localStorage.getItem(`volleyball-admin-${email}`)
    if (val === "true") return true
    if (val === "false") return false
    return null
  } catch {
    return null
  }
}

function writeCachedAdminStatus(email: string, isAdmin: boolean): void {
  try {
    localStorage.setItem(`volleyball-admin-${email}`, String(isAdmin))
  } catch {}
}

function clearCachedAdminStatus(email: string): void {
  try {
    localStorage.removeItem(`volleyball-admin-${email}`)
  } catch {}
}

// --- Component ---

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const cachedUser  = readCachedSession()
  const cachedAdmin = cachedUser?.email ? readCachedAdminStatus(cachedUser.email) : null
  const hasCache    = cachedUser !== null && cachedAdmin !== null

  const [user, setUser] = useState<User | null>(cachedUser)
  const [isAdmin, setIsAdmin] = useState(cachedAdmin ?? false)
  const [isLoading, setIsLoading] = useState(!hasCache)
  const isMountedRef = useRef(true)
  const lastCheckedEmailRef = useRef<string | null>(cachedUser?.email ?? null)

  const checkAdminStatus = useCallback(async (email: string): Promise<boolean> => {
    try {
      const supabase = createClient()
      const result = await Promise.race([
        supabase
          .from("admins")
          .select("email")
          .eq("email", email.toLowerCase())
          .limit(1),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Admin check timeout")), 5000)
        ),
      ])

      if (result.error) {
        return false
      }

      return (result.data?.length ?? 0) > 0
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    const supabase = createClient()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("[v0] AuthProvider: onAuthStateChange", { event, hasSession: !!session })

        if (!isMountedRef.current) return

        const currentUser = session?.user ?? null
        const currentEmail = currentUser?.email ?? null

        if (event === "SIGNED_OUT" || !currentUser) {
          const evictEmail = lastCheckedEmailRef.current
          if (evictEmail) clearCachedAdminStatus(evictEmail)
          setUser(null)
          setIsAdmin(false)
          lastCheckedEmailRef.current = null
          setIsLoading(false)
          return
        }

        setUser(currentUser)

        // Skip admin check if we already checked this email
        if (currentEmail && currentEmail === lastCheckedEmailRef.current) {
          console.log("[v0] AuthProvider: same email, reusing admin status")
          setIsLoading(false)
          return
        }

        // Check admin status for new email
        if (currentEmail) {
          lastCheckedEmailRef.current = currentEmail
          try {
            const adminStatus = await checkAdminStatus(currentEmail)
            console.log("[v0] AuthProvider: admin check result", { email: currentEmail, adminStatus })
            if (isMountedRef.current) {
              setIsAdmin(adminStatus)
              writeCachedAdminStatus(currentEmail, adminStatus)
            }
          } catch {
            // Silently handle
          }
        }

        if (isMountedRef.current) {
          setIsLoading(false)
        }
      }
    )

    return () => {
      isMountedRef.current = false
      subscription.unsubscribe()
    }
  }, [checkAdminStatus])

  const signOut = useCallback(async () => {
    try {
      const supabase = createClient()
      const evictEmail = lastCheckedEmailRef.current
      if (evictEmail) clearCachedAdminStatus(evictEmail)
      lastCheckedEmailRef.current = null
      await supabase.auth.signOut()
      if (isMountedRef.current) {
        setUser(null)
        setIsAdmin(false)
      }
    } catch {
      // Silently handle errors
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, isAdmin, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
