from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models import BadgeType


# ──── OCR ─────────────────────────────────────────────────────────────────────
class OCRResponse(BaseModel):
    student_id: str


# ──── Auth ────────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    student_id: str = Field(min_length=1, max_length=3)
    email: EmailStr
    password: str
    name: str
    college: str
    stream: str
    year: str

    @field_validator("student_id")
    @classmethod
    def validate_student_id(cls, value: str) -> str:
        if not value.isdigit() or not 1 <= int(value) <= 100:
            raise ValueError("Student ID must be a number from 1 to 100")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# ──── Badge ───────────────────────────────────────────────────────────────────
class BadgeOut(BaseModel):
    id: int
    badge_type: BadgeType
    unlocked_at: datetime

    model_config = {"from_attributes": True}


# ──── User ────────────────────────────────────────────────────────────────────
class UserOut(BaseModel):
    id: int
    student_id: str
    email: str
    name: str
    college: str
    stream: str
    year: str
    total_uploads: int
    total_downloads: int
    current_streak: int
    last_upload_date: Optional[date]
    created_at: datetime
    badges: List[BadgeOut] = []

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


# ──── Notes ───────────────────────────────────────────────────────────────────
class NoteOut(BaseModel):
    id: int
    subject_code: str
    subject_name: str
    professor: str
    tag: str
    upload_date: date
    uploader_name: str

    model_config = {"from_attributes": True}


class NoteFolder(BaseModel):
    subject_code: str
    subject_name: str
    notes: List[NoteOut]


class UploadResponse(BaseModel):
    note: NoteOut
    new_badges: List[BadgeOut] = []
    streak: int
    message: str


# ──── WebSocket Messages ───────────────────────────────────────────────────────
class WSMessage(BaseModel):
    type: str          # "upload_success" | "badge_unlocked" | "streak_update"
    payload: dict
