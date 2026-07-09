"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/components/auth-provider"
import type { ActiveScorer } from "@/lib/types"

const WARNING_MS = 9 * 60 * 1000

export type ScorerLockState =
  | { status: "loading" }
  | { status: "unclaimed" }
  | { status: "owned"; row: ActiveScorer }
  | { status: "locked_by_other"; row: ActiveScorer }

export interface UseActiveScorerResult {
  state: ScorerLockState
  isActiveScorer: boolean
  scorerUserId: string | null
  expiringSoon: boolean
  reclaimedNotice: string | null
  acquire: () => Promise<{ ok: boolean; error?: string }>
  reclaim: () => Promise<{ ok: boolean; error?: string }>
  touch: () => Promise<{ ok: boolean; error?: string }>
  release: () => Promise<void>
  refetch: () => Promise<void>
  dismissReclaimedNotice: () => void
}

export function useActiveScorer(matchId: string | null): UseActiveScorerResult {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const supabase = createClient()
  const [state, setState] = useState<ScorerLockState>({ status: "loading" })
  const [expiringSoon, setExpiringSoon] = useState(false)
  const [reclaimedNotice, setReclaimedNotice] = useState<string | null>(null)
  const wasOwnerRef = useRef(false)
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastMatchIdRef = useRef<string | null>(null)

  const clearWarningTimer = () => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current)
      warningTimerRef.current = null
    }
    setExpiringSoon(false)
  }

  const scheduleWarning = useCallback((lastActivityIso: string) => {
    clearWarningTimer()
    const elapsed = Date.now() - new Date(lastActivityIso).getTime()
    const ms = Math.max(0, WARNING_MS - elapsed)
    warningTimerRef.current = setTimeout(() => {
      setExpiringSoon(true)
    }, ms)
  }, [])

  const applyRow = useCallback(
    (row: ActiveScorer | null) => {
      if (!userId) return
      if (!row) {
        if (wasOwnerRef.current) {
          // Lock disappeared while we owned it (cron cleanup or manual release).
          wasOwnerRef.current = false
        }
        clearWarningTimer()
        setState({ status: "unclaimed" })
        return
      }
      if (row.user_id === userId) {
        wasOwnerRef.current = true
        scheduleWarning(row.last_activity)
        setState({ status: "owned", row })
      } else {
        if (wasOwnerRef.current) {
          // We had the lock, someone else now holds it -> we were reclaimed.
          setReclaimedNotice(row.user_id)
          wasOwnerRef.current = false
        }
        clearWarningTimer()
        setState({ status: "locked_by_other", row })
      }
    },
    // Keyed on the id (a stable string) so token-refresh echoes that produce
    // a new user object don't cascade into refetches/resubscriptions.
    [userId, scheduleWarning],
  )

  const fetchRow = useCallback(async () => {
    if (!matchId) return
    const { data } = await supabase
      .from("active_scorers")
      .select("*")
      .eq("match_id", matchId)
      .maybeSingle()
    applyRow((data as ActiveScorer | null) ?? null)
  }, [matchId, supabase, applyRow])

  useEffect(() => {
    if (!matchId || !userId) return
    // Only reset to "loading" (which disables the score buttons) when the
    // match actually changed — not on auth echoes or silent refetches.
    if (lastMatchIdRef.current !== matchId) {
      lastMatchIdRef.current = matchId
      setState({ status: "loading" })
    }
    fetchRow()
  }, [matchId, userId, fetchRow])

  // Realtime subscription for changes on this match's lock.
  useEffect(() => {
    if (!matchId) return
    const channel = supabase
      .channel(`active-scorer:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "active_scorers",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            applyRow(null)
            return
          }
          applyRow(payload.new as ActiveScorer)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [matchId, supabase, applyRow])

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => clearWarningTimer()
  }, [])

  const acquire = useCallback(async () => {
    if (!matchId) return { ok: false, error: "no_match" }
    const { data, error } = await supabase.rpc("claim_active_scorer", {
      _match_id: matchId,
      _force: false,
      _expected_version: null,
    })
    if (error) {
      return { ok: false, error: error.message }
    }
    applyRow(data as ActiveScorer)
    return { ok: true }
  }, [matchId, supabase, applyRow])

  const reclaim = useCallback(async () => {
    if (!matchId) return { ok: false, error: "no_match" }
    const expectedVersion =
      state.status === "locked_by_other" ? state.row.version : null
    const { data, error } = await supabase.rpc("claim_active_scorer", {
      _match_id: matchId,
      _force: true,
      _expected_version: expectedVersion,
    })
    if (error) {
      return { ok: false, error: error.message }
    }
    applyRow(data as ActiveScorer)
    return { ok: true }
  }, [matchId, supabase, applyRow, state])

  const touch = useCallback(async () => {
    if (!matchId) return { ok: false, error: "no_match" }
    const { data, error } = await supabase.rpc("touch_active_scorer", {
      _match_id: matchId,
    })
    if (error) {
      return { ok: false, error: error.message }
    }
    applyRow(data as ActiveScorer)
    return { ok: true }
  }, [matchId, supabase, applyRow])

  const release = useCallback(async () => {
    if (!matchId) return
    await supabase.rpc("release_active_scorer", { _match_id: matchId })
    wasOwnerRef.current = false
    clearWarningTimer()
  }, [matchId, supabase])

  const dismissReclaimedNotice = useCallback(() => setReclaimedNotice(null), [])

  const isActiveScorer = state.status === "owned"
  const scorerUserId =
    state.status === "owned" || state.status === "locked_by_other"
      ? state.row.user_id
      : null

  return {
    state,
    isActiveScorer,
    scorerUserId,
    expiringSoon,
    reclaimedNotice,
    acquire,
    reclaim,
    touch,
    release,
    refetch: fetchRow,
    dismissReclaimedNotice,
  }
}
