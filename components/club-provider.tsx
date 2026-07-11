"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/components/auth-provider"
import type { Club, ClubRole, Membership } from "@/lib/types"

const ACTIVE_CLUB_KEY = "volleyball-active-club"
const MEMBERSHIPS_CACHE_KEY = "volleyball-memberships"

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

function membershipsEqual(a: Membership[], b: Membership[]): boolean {
  if (a.length !== b.length) return false
  return a.every(
    (m, i) => m.club.id === b[i].club.id && m.role === b[i].role && m.club.name === b[i].club.name,
  )
}

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

// Last known memberships snapshot, kept per user so a full page load can
// render clubs immediately instead of waiting for the club_members fetch.
// refresh() reconciles it against the server in the background.
function readCachedMemberships(userId: string | null): Membership[] | null {
  if (!userId || typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(MEMBERSHIPS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.userId !== userId || !Array.isArray(parsed.memberships)) return null
    return parsed.memberships as Membership[]
  } catch {
    return null
  }
}

function writeCachedMemberships(userId: string, memberships: Membership[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(MEMBERSHIPS_CACHE_KEY, JSON.stringify({ userId, memberships }))
  } catch {}
}

function clearCachedMemberships(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(MEMBERSHIPS_CACHE_KEY)
  } catch {}
}

function pickActiveClubId(list: Membership[], stored: string | null): string | null {
  if (stored !== null && list.some((m) => m.club.id === stored)) return stored
  if (list.length === 1) return list[0].club.id
  return null
}

export function ClubProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth()
  const userId = user?.id ?? null

  // When the auth user was seeded synchronously (from the session cookie),
  // seed memberships from the per-user cache in the same render so the
  // layout never has to show its loading gate on warm page loads.
  const [seeded] = useState<Membership[] | null>(() => readCachedMemberships(userId))
  const [memberships, setMemberships] = useState<Membership[]>(seeded ?? [])
  const [activeClubId, setActiveClubIdState] = useState<string | null>(() =>
    seeded ? pickActiveClubId(seeded, readStoredActiveClubId()) : null,
  )
  const [isLoading, setIsLoading] = useState(seeded === null)

  const fetchMemberships = useCallback(async (): Promise<Membership[] | null> => {
    if (!userId) return []
    const supabase = createClient()
    const { data, error } = await supabase
      .from("club_members")
      .select("role, joined_at, clubs:club_id(*)")
      .eq("user_id", userId)
      .order("joined_at", { ascending: true })

    if (error || !data) return null

    return data
      .filter((row: any) => row.clubs)
      .map((row: any) => ({ club: row.clubs as Club, role: row.role as ClubRole }))
  }, [userId])

  const refresh = useCallback(async () => {
    const list = await fetchMemberships()

    // Transient fetch failure: keep whatever we have (cached or previous)
    // rather than flashing empty-club states or poisoning the cache.
    if (list === null) {
      setIsLoading(false)
      return
    }

    if (userId) writeCachedMemberships(userId, list)

    // Keep array identity stable when nothing changed: a new memberships
    // array produces a new activeClub object, which would make every screen
    // keyed on it (e.g. the scoring console) refetch on tab resume.
    setMemberships((prev) => (membershipsEqual(prev, list) ? prev : list))

    setActiveClubIdState((current) => pickActiveClubId(list, current ?? readStoredActiveClubId()))

    setIsLoading(false)
  }, [fetchMemberships, userId])

  useEffect(() => {
    if (authLoading) return
    if (!userId) {
      clearCachedMemberships()
      setMemberships([])
      setActiveClubIdState(null)
      setIsLoading(false)
      return
    }
    refresh()
  }, [authLoading, userId, refresh])

  // Subscribe to changes on this user's memberships so removals/role changes
  // are reflected immediately without requiring a manual refresh.
  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`club-members:user:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "club_members",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          refresh()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, refresh])

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
