export type BadgeType = "BEGINNER" | "INTERMEDIATE" | "SOPHISTICATED";

export interface Badge {
  id: number;
  badge_type: BadgeType;
  unlocked_at: string;
}

export interface User {
  id: number;
  student_id: string;
  email: string;
  name: string;
  college: string;
  stream: string;
  year: string;
  total_uploads: number;
  total_downloads: number;
  current_streak: number;
  last_upload_date: string | null;
  created_at: string;
  badges: Badge[];
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface Note {
  id: number;
  subject_code: string;
  subject_name: string;
  professor: string;
  tag: string;
  upload_date: string;
  uploader_name: string;
}

export interface NoteFolder {
  subject_code: string;
  subject_name: string;
  notes: Note[];
}

export interface WSMessage {
  type: "upload_success" | "badge_unlocked" | "streak_update";
  payload: Record<string, unknown>;
}

export interface UploadResponse {
  note: Note;
  new_badges: Badge[];
  streak: number;
  message: string;
}
