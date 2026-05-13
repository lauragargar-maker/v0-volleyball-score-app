// Names that cannot be used as club names to prevent squatting and impersonation.
// All comparisons are done case-insensitively and after trimming.
export const RESERVED_CLUB_NAMES: string[] = [
  // Federations
  "rfevb",
  "real federación española de voleibol",
  "federación española de voleibol",
  "cev",
  "confédération européenne de volleyball",
  "fivb",
  "federación internacional de voleibol",
  // Generic system terms
  "admin",
  "administrador",
  "administradora",
  "soporte",
  "support",
  "sistema",
  "staff",
  "test",
  "prueba",
  "demo",
  // App identity
  "volleyscore",
  "volley score",
]

export function isReservedClubName(name: string): boolean {
  const normalized = name.trim().toLowerCase()
  return RESERVED_CLUB_NAMES.some((r) => r === normalized)
}
