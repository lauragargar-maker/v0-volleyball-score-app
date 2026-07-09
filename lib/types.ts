export interface Match {
  id: string
  club_id: string
  created_by?: string | null
  home_team: string
  away_team: string
  status: "in_progress" | "finished" | "cancelled"
  cancellation_reason?: string
  winner?: string
  home_sets_won: number
  away_sets_won: number
  created_at: string
  finished_at?: string
}

export interface Set {
  id: string
  match_id: string
  set_number: number
  home_score: number
  away_score: number
  status: "in_progress" | "finished"
  winner?: string
  created_at: string
  score_version: number
}

export interface MatchMedia {
  id: string
  match_id: string
  club_id: string
  file_path: string
  file_type: "image" | "video"
  caption?: string
  uploaded_by?: string
  created_at: string
}

export type ClubRole = "admin" | "member"

export interface Club {
  id: string
  name: string
  numeric_code: string
  description?: string | null
  created_by?: string | null
  created_at: string
}

export interface ClubMember {
  club_id: string
  user_id: string
  role: ClubRole
  joined_at: string
}

export interface Membership {
  club: Club
  role: ClubRole
}

export type ClubJoinRequestStatus = "pending" | "approved" | "rejected" | "reopened"

export interface ClubJoinRequest {
  id: string
  club_id: string
  user_id: string
  status: ClubJoinRequestStatus
  reason?: string | null
  created_at: string
  decided_at?: string | null
  decided_by?: string | null
}

export interface ActiveScorer {
  match_id: string
  user_id: string
  acquired_at: string
  last_activity: string
  version: number
}
