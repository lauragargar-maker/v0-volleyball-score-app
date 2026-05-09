"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/components/auth-provider"
import type { Club, ClubRole, Membership } from "@/lib/types"

const ACTIVE_CLUB_KEY = "volleyball-active-club"

interface ClubContextType {
  memberships: Membership[]
  activeClub: Club | null
  roleInActive: ClubRole | null
  isAdminOfActive: boolean
  isLoading: boolean
  setActiveClub: (clubId: string | null) => void
  refresh: () => Promise<void>
}

const ClubContext = createContext<ClubContextType>({
  memberships: [],
  activeClub: null,
  roleInActive: null,
  isAdminOfActive: false,
  isLoading: true,
  setActiveClub: () => {},
  refresh: async () => {},
})

function readStoredActiveClubId(): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(ACTIVE_CLUB_KEY)
  } catch {
    return null
  }
}

function writeStoredActiveClubId(id: string | null): void {
  if (typeof window === "undefined") return
  try {
    if (id) localStorage.setItem(ACTIVE_CLUB_KEY, id)
    else localStorage.removeItem(ACTIVE_CLUB_KEY)
  } catch {}
}

export function ClubProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth()
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [activeClubId, setActiveClubIdState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchMemberships = useCallback(async (): Promise<Membership[]> => {
    if (!user) return []
    const supabase = createClient()
    const { data, error } = await supabase
      .from("club_members")
      .select("role, joined_at, clubs:club_id(*)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })

    if (error || !data) return []

    return data
      .filter((row: any) => row.clubs)
      .map((row: any) => ({ club: row.clubs as Club, role: row.role as ClubRole }))
  }, [user])

  const refresh = useCallback(async () => {
    const list = await fetchMemberships()
    setMemberships(list)

    setActiveClubIdState((current) => {
      const stored = current ?? readStoredActiveClubId()
      const isStoredValid = stored !== null && list.some((m) => m.club.id === stored)
      if (isStoredValid) return stored
      if (list.length === 1) return list[0].club.id
      return null
    })

    setIsLoading(false)
  }, [fetchMemberships])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setMemberships([])
      setActiveClubIdState(null)
      setIsLoading(false)
      return
    }
    refresh()
  }, [authLoading, user, refresh])

  // Subscribe to changes on this user's memberships so removals/role changes
  // are reflected immediately without requiring a manual refresh.
  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    const channel = supabase
      .channel(`club-members:user:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "club_members",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refresh()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, refresh])

  // Persist active club id
  useEffect(() => {
    writeStoredActiveClubId(activeClubId)
  }, [activeClubId])

  const setActiveClub = useCallback(
    (clubId: string | null) => {
      if (clubId === null) {
        setActiveClubIdState(null)
        return
      }
      const isMember = memberships.some((m) => m.club.id === clubId)
      if (!isMember) return
      setActiveClubIdState(clubId)
    },
    [memberships],
  )

  const { activeClub, roleInActive } = useMemo(() => {
    const m = memberships.find((m) => m.club.id === activeClubId)
    return {
      activeClub: m?.club ?? null,
      roleInActive: m?.role ?? null,
    }
  }, [memberships, activeClubId])

  const value = useMemo<ClubContextType>(
    () => ({
      memberships,
      activeClub,
      roleInActive,
      isAdminOfActive: roleInActive === "admin",
      isLoading,
      setActiveClub,
      refresh,
    }),
    [memberships, activeClub, roleInActive, isLoading, setActiveClub, refresh],
  )

  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>
}

export const useClub = () => useContext(ClubContext)
