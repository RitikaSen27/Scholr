import enum
from datetime import datetime, date

from sqlalchemy import (
    Column, Integer, String, ForeignKey, DateTime, Date,
    Enum as SAEnum, func
)
from sqlalchemy.orm import relationship

from app.database import Base


class BadgeType(str, enum.Enum):
    BEGINNER = "BEGINNER"
    INTERMEDIATE = "INTERMEDIATE"
    SOPHISTICATED = "SOPHISTICATED"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    name = Column(String, nullable=False)
    college = Column(String, nullable=False)
    stream = Column(String, nullable=False)
    year = Column(String, nullable=False)
    total_uploads = Column(Integer, default=0, nullable=False)
    total_downloads = Column(Integer, default=0, nullable=False)
    current_streak = Column(Integer, default=0, nullable=False)
    last_upload_date = Column(Date, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    badges = relationship("Badge", back_populates="user", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="user", cascade="all, delete-orphan")


class Badge(Base):
    __tablename__ = "badges"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    badge_type = Column(SAEnum(BadgeType), nullable=False)
    unlocked_at = Column(DateTime, server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="badges")


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    subject_code = Column(String, nullable=False, index=True)
    subject_name = Column(String, nullable=False)
    professor = Column(String, nullable=False)
    tag = Column(String, nullable=False)
    file_path = Column(String, nullable=False)   # S3 key
    original_filename = Column(String, nullable=False)
    upload_date = Column(Date, nullable=False, default=date.today)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="notes")
