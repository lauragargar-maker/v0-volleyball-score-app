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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const isMountedRef = useRef(true)
  const isLoadingRef = useRef(true) // mirrors isLoading without stale closure issues
  const lastCheckedEmailRef = useRef<string | null>(null)

  const setLoading = useCallback((value: boolean) => {
    isLoadingRef.current = value
    setIsLoading(value)
  }, [])

  const checkAdminStatus = useCallback(async (email: string): Promise<boolean> => {
    try {
      const supabase = createClient()
      // Race the query against a 5-second timeout so it can never hang indefinitely
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

    // Use onAuthStateChange as the SOLE source of truth.
    // Do NOT call getUser() separately - it can hang when there are
    // multiple GoTrueClient instances or during token refresh races.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("[v0] AuthProvider: onAuthStateChange", { event, hasSession: !!session })

        if (!isMountedRef.current) return

        const currentUser = session?.user ?? null
        const currentEmail = currentUser?.email ?? null

        // On SIGNED_OUT, reset everything
        if (event === "SIGNED_OUT" || !currentUser) {
          setUser(null)
          setIsAdmin(false)
          lastCheckedEmailRef.current = null
          setLoading(false)
          return
        }

        // Always update user from session
        setUser(currentUser)

        // Skip admin check if we already checked this email
        if (currentEmail && currentEmail === lastCheckedEmailRef.current) {
          console.log("[v0] AuthProvider: same email, reusing admin status")
          setLoading(false)
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
            }
          } catch {
            // Silently handle
          }
        }

        if (isMountedRef.current) {
          setLoading(false)
        }
      }
    )

    // Safety timeout: if onAuthStateChange never fires or checkAdminStatus hangs,
    // ensure we don't show spinner forever. Uses isLoadingRef to avoid stale closure.
    const timeout = setTimeout(() => {
      if (isMountedRef.current && isLoadingRef.current) {
        console.log("[v0] AuthProvider: safety timeout, forcing isLoading=false")
        setLoading(false)
      }
    }, 3000)

    return () => {
      isMountedRef.current = false
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [checkAdminStatus, setLoading])

  const signOut = useCallback(async () => {
    try {
      const supabase = createClient()
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
