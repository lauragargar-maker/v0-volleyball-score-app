"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { submitJoinRequest } from "./actions"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Hash, Users, CheckCircle, ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import type { Club } from "@/lib/types"

type Tab = "name" | "code"

export default function ClubJoinPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("name")
  const [nameQuery, setNameQuery] = useState("")
  const [codeQuery, setCodeQuery] = useState("")
  const [results, setResults] = useState<Club[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = (fn: () => Promise<void>, delay = 300) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(fn, delay)
  }

  const searchByName = async (query: string) => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    setIsSearching(true)
    setSearchError(null)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("clubs")
      .select("*")
      .ilike("name", `%${query.trim()}%`)
      .limit(10)

    setIsSearching(false)
    if (error) {
      setSearchError("Error al buscar clubes.")
      return
    }
    setResults((data as Club[]) ?? [])
  }

  const searchByCode = async (code: string) => {
    const clean = code.replace(/\D/g, "")
    if (clean.length !== 6) {
      setResults([])
      return
    }
    setIsSearching(true)
    setSearchError(null)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("clubs")
      .select("*")
      .eq("numeric_code", clean)
      .limit(1)

    setIsSearching(false)
    if (error) {
      setSearchError("Error al buscar el club.")
      return
    }
    setResults((data as Club[]) ?? [])
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setNameQuery(v)
    doSearch(() => searchByName(v))
  }

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 6)
    setCodeQuery(v)
    doSearch(() => searchByCode(v), 0)
  }

  const handleRequest = async (clubId: string) => {
    setSubmitting(clubId)
    setSubmitError(null)
    const result = await submitJoinRequest(clubId)
    setSubmitting(null)
    if (!result.ok) {
      setSubmitError(result.error ?? "Error al enviar la solicitud.")
      return
    }
    setSubmitted(clubId)
    setTimeout(() => router.push("/onboarding/pending"), 1200)
  }

  const switchTab = (t: Tab) => {
    setTab(t)
    setResults([])
    setSearchError(null)
    setSubmitError(null)
    setNameQuery("")
    setCodeQuery("")
  }

  return (
    <div className="px-4 py-12">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/onboarding">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Volver
            </Link>
          </Button>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Unirme a un club</h1>
          <p className="text-muted-foreground text-sm">
            Busca un club por nombre o introduce su código de 6 dígitos.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => switchTab("name")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
              tab === "name" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
            }`}
          >
            <Search className="w-4 h-4" />
            Por nombre
          </button>
          <button
            type="button"
            onClick={() => switchTab("code")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
              tab === "code" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
            }`}
          >
            <Hash className="w-4 h-4" />
            Por código
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          {tab === "name" ? (
            <Input
              placeholder="Nombre del club..."
              value={nameQuery}
              onChange={handleNameChange}
              className="pl-9"
              autoFocus
            />
          ) : (
            <Input
              placeholder="Código de 6 dígitos"
              value={codeQuery}
              onChange={handleCodeChange}
              className="pl-9 font-mono tracking-widest"
              maxLength={6}
              inputMode="numeric"
              autoFocus
            />
          )}
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        </div>

        {/* State feedback */}
        {isSearching && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {searchError && <p className="text-sm text-destructive text-center">{searchError}</p>}

        {submitError && (
          <p className="text-sm text-destructive text-center">{submitError}</p>
        )}

        {/* Results */}
        {!isSearching && results.length > 0 && (
          <div className="space-y-2">
            {results.map((club) => (
              <Card key={club.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{club.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{club.numeric_code}</p>
                  </div>
                </div>
                {submitted === club.id ? (
                  <div className="flex items-center gap-1.5 text-sm text-green-600 shrink-0">
                    <CheckCircle className="w-4 h-4" />
                    Enviada
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleRequest(club.id)}
                    disabled={submitting === club.id || submitted !== null}
                    className="shrink-0"
                  >
                    {submitting === club.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Solicitar"
                    )}
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}

        {!isSearching &&
          results.length === 0 &&
          (tab === "name" ? nameQuery.trim().length >= 2 : codeQuery.length === 6) && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No se encontraron clubes con esa búsqueda.
            </p>
          )}
      </div>
    </div>
  )
}
