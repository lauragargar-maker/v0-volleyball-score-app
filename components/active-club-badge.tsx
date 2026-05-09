"use client"

import { useClub } from "@/components/club-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown, Check, Users } from "lucide-react"

export function ActiveClubBadge() {
  const { memberships, activeClub, setActiveClub } = useClub()

  if (memberships.length === 0) return null

  if (memberships.length === 1) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        <span className="truncate max-w-[160px]">{memberships[0].club.name}</span>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          <Users className="h-3.5 w-3.5" />
          <span className="truncate max-w-[160px]">{activeClub?.name ?? "Selecciona un club"}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Cambiar de club</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.map((m) => {
          const isActive = m.club.id === activeClub?.id
          return (
            <DropdownMenuItem
              key={m.club.id}
              onClick={() => setActiveClub(m.club.id)}
              className="flex items-center justify-between"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">{m.club.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {m.role === "admin" ? "Admin" : "Miembro"}
                </span>
              </div>
              {isActive && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
