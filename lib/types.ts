export interface Match {
  id: string
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
}

export interface Admin {
  id: string
  email: string
  created_at: string
}

export interface AdminRequest {
  id: string
  email: string
  name: string
  reason?: string
  status: "pending" | "approved" | "rejected"
  created_at: string
}

export interface MatchMedia {
  id: string
  match_id: string
  file_path: string
  file_type: "image" | "video"
  caption?: string
  uploaded_by?: string
  created_at: string
}
