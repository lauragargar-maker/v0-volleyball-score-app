"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Match, Set } from "@/lib/types"

const DEFAULT_POLL_MS = 45_000
const RESUBSCRIBE_DELAY_MS = 2_000

export interface UseLiveMatchResult {
  match: Match | null
  sets: Set[]
  currentSet: Set | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

// Keeps a match + its sets live: initial fetch, realtime subscription with
// self-healing reconnects, refetch on tab wake-up (visibility/focus/online),
// and a slow polling safety net while the match is in progress. Mobile
// browsers suspend WebSockets in the background and Supabase Realtime never
// replays missed events, so freshness cannot rely on the socket alone.
export function useLiveMatch(matchId: string, options?: { pollMs?: number }): UseLiveMatchResult {
  const pollMs = options?.pollMs ?? DEFAULT_POLL_MS
  const [match, setMatch] = useState<Match | null>(null)
  const [sets, setSets] = useState<Set[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Bumping the epoch tears down and recreates the realtime channel.
  const [channelEpoch, setChannelEpoch] = useState(0)
  const hasDataRef = useRef(false)
  const channelStateRef = useRef<"pending" | "joined" | "broken">("pending")

  // Merge one set row, never letting an older score overwrite a newer one
  // (score_version is bumped server-side on every score change).
  const mergeSet = useCallback((row: Set) => {
    setSets((prev) => {
      const idx = prev.findIndex((s) => s.id === row.id)
      if (idx === -1) {
        return [...prev, row].sort((a, b) => a.set_number - b.set_number)
      }
      if ((row.score_version ?? 0) < (prev[idx].score_version ?? 0)) return prev
      const next = [...prev]
      next[idx] = row
      return next
    })
  }, [])

  const fetchAll = useCallback(async () => {
    const supabase = createClient()
    try {
      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .single()

      if (matchError || !matchData) {
        // Stale-while-revalidate: only surface errors when there is
        // nothing on screen yet; otherwise keep showing the last data.
        if (!hasDataRef.current) setError("No se encontro el partido")
        return
      }

      const { data: setsData } = await supabase
        .from("sets")
        .select("*")
        .eq("match_id", matchId)
        .order("set_number", { ascending: true })

      setMatch(matchData as Match)
      if (setsData) {
        for (const row of setsData as Set[]) mergeSet(row)
      }
      hasDataRef.current = true
      setError(null)
    } catch {
      if (!hasDataRef.current) setError("Error al cargar el partido")
    } finally {
      setIsLoading(false)
    }
  }, [matchId, mergeSet])

  // Realtime subscription, recreated whenever channelEpoch bumps.
  useEffect(() => {
    const supabase = createClient()
    let disposed = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    channelStateRef.current = "pending"
    const channel = supabase
      .channel(`live-match:${matchId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${matchId}` },
        (payload: { new: unknown }) => setMatch(payload.new as Match),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sets", filter: `match_id=eq.${matchId}` },
        (payload: { eventType: string; new: unknown }) => {
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            mergeSet(payload.new as Set)
          }
        },
      )
      .subscribe((status: string) => {
        if (disposed) return
        if (status === "SUBSCRIBED") {
          channelStateRef.current = "joined"
          // Catch up on anything missed between fetch and join, or while
          // the socket was down (reconnects land here too).
          fetchAll()
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          channelStateRef.current = "broken"
          if (!retryTimer) {
            retryTimer = setTimeout(() => {
              retryTimer = null
              if (!disposed) setChannelEpoch((e) => e + 1)
            }, RESUBSCRIBE_DELAY_MS)
          }
        }
      })

    return () => {
      disposed = true
      if (retryTimer) clearTimeout(retryTimer)
      supabase.removeChannel(channel)
    }
  }, [matchId, channelEpoch, fetchAll, mergeSet])

  // Wake-up recovery: when the tab becomes visible / focused / back online,
  // refetch immediately and rebuild the channel if the socket didn't survive.
  useEffect(() => {
    const wake = () => {
      if (document.visibilityState !== "visible") return
      fetchAll()
      if (channelStateRef.current !== "joined") setChannelEpoch((e) => e + 1)
    }
    document.addEventListener("visibilitychange", wake)
    window.addEventListener("focus", wake)
    window.addEventListener("online", wake)
    return () => {
      document.removeEventListener("visibilitychange", wake)
      window.removeEventListener("focus", wake)
      window.removeEventListener("online", wake)
    }
  }, [fetchAll])

  // Polling safety net while the match is live and the tab visible, in case
  // the socket silently drops without emitting an error status.
  useEffect(() => {
    if (match?.status !== "in_progress") return
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchAll()
    }, pollMs)
    return () => clearInterval(interval)
  }, [match?.status, pollMs, fetchAll])

  const currentSet = sets.find((s) => s.status === "in_progress") ?? sets[sets.length - 1] ?? null

  return { match, sets, currentSet, isLoading, error, refetch: fetchAll }
}
