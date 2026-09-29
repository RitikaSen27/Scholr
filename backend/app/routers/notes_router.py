import uuid
from datetime import date
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Query
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import get_current_user
from app.database import get_db
from app.services import badge_service, streak_service
from app.services.s3_service import generate_presigned_url, upload_file
from app.websocket_manager import manager

router = APIRouter(prefix="/api/notes", tags=["notes"])

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
CONTENT_TYPE_EXT = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}

REPORT_THRESHOLD = 3  # auto-remove a note when it hits this many reports


# ──── Helper ──────────────────────────────────────────────────────────────────
def _build_note_out(
    note: models.Note,
    uploader_name: str,
    current_user_id: int,
) -> schemas.NoteOut:
    reported_by_me = any(r.user_id == current_user_id for r in note.reports)
    return schemas.NoteOut(
        id=note.id,
        subject_code=note.subject_code,
        subject_name=note.subject_name,
        professor=note.professor,
        tag=note.tag,
        upload_date=note.upload_date,
        uploader_name=uploader_name,
        report_count=note.report_count,
        reported_by_me=reported_by_me,
    )


# ──── Upload ──────────────────────────────────────────────────────────────────
@router.post("/upload", response_model=schemas.UploadResponse, status_code=201)
async def upload_note(
    subject_code: str = Form(...),
    subject_name: str = Form(...),
    professor: str = Form(...),
    tag: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Validate file type
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Only .pdf, .doc, and .docx files are allowed.",
        )

    file_bytes = await file.read()
    if len(file_bytes) > 50 * 1024 * 1024:  # 50 MB
        raise HTTPException(status_code=413, detail="File too large (max 50 MB)")

    # Build a unique S3 key
    ext = CONTENT_TYPE_EXT.get(file.content_type, ".bin")
    s3_key = f"notes/{current_user.id}/{subject_code}/{uuid.uuid4().hex}{ext}"

    # Upload to S3
    upload_file(file_bytes, s3_key, file.content_type)

    # Persist Note record
    note = models.Note(
        user_id=current_user.id,
        subject_code=subject_code.upper().strip(),
        subject_name=subject_name.strip(),
        professor=professor.strip(),
        tag=tag.strip(),
        file_path=s3_key,
        original_filename=file.filename or f"note{ext}",
        upload_date=date.today(),
    )
    db.add(note)

    # Update counters
    current_user.total_uploads += 1

    # Update streak (must happen before badge check)
    new_streak = streak_service.update_streak(current_user, db)

    # Check and award badges
    new_badges = badge_service.check_and_award_badges(current_user, db)

    db.commit()
    db.refresh(note)
    db.refresh(current_user)

    # Build WebSocket notifications
    await manager.send_to_user(
        current_user.id,
        {
            "type": "upload_success",
            "payload": {
                "note_id": note.id,
                "subject_code": note.subject_code,
                "tag": note.tag,
                "upload_date": str(note.upload_date),
            },
        },
    )

    for badge in new_badges:
        await manager.send_to_user(
            current_user.id,
            {
                "type": "badge_unlocked",
                "payload": {"badge_type": badge.badge_type.value},
            },
        )

    await manager.send_to_user(
        current_user.id,
        {
            "type": "streak_update",
            "payload": {"streak": new_streak},
        },
    )

    note_out = schemas.NoteOut(
        id=note.id,
        subject_code=note.subject_code,
        subject_name=note.subject_name,
        professor=note.professor,
        tag=note.tag,
        upload_date=note.upload_date,
        uploader_name=current_user.name,
        report_count=0,
        reported_by_me=False,
    )

    badge_outs = [schemas.BadgeOut.model_validate(b) for b in new_badges]

    return schemas.UploadResponse(
        note=note_out,
        new_badges=badge_outs,
        streak=new_streak,
        message=f"Note uploaded successfully! Streak: {new_streak} days.",
    )


# ──── List (all subjects, grouped) ───────────────────────────────────────────
@router.get("/list", response_model=List[schemas.NoteFolder])
def list_notes(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Return all active notes grouped by subject_code, sorted by upload_date descending.
    Notes that have been auto-removed (report_count >= 3) are excluded.
    """
    notes = (
        db.query(models.Note, models.User.name)
        .join(models.User, models.Note.user_id == models.User.id)
        .filter(models.Note.is_removed == False)  # noqa: E712
        .order_by(models.Note.subject_code, models.Note.created_at.desc())
        .all()
    )

    folders: dict[str, schemas.NoteFolder] = {}
    for note, uploader_name in notes:
        code = note.subject_code
        if code not in folders:
            folders[code] = schemas.NoteFolder(
                subject_code=code,
                subject_name=note.subject_name,
                notes=[],
            )
        folders[code].notes.append(_build_note_out(note, uploader_name, current_user.id))

    return list(folders.values())


# ──── Search (microfilter) ────────────────────────────────────────────────────
@router.get("/search", response_model=List[schemas.SubjectSearchResult])
def search_subjects(
    q: str = Query(..., min_length=1, description="Search by paper code"),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    """
    Microfilter: search active notes by paper code (subject_code) only.
    Results are grouped by paper code, so each code appears exactly once even
    if uploaders typed the subject name differently. The displayed name is the
    one from the most recently uploaded note under that code.
    """
    term = q.strip()
    if not term:
        return []

    # Escape LIKE wildcards so "_" or "%" typed by the user match literally
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

    rows = (
        db.query(models.Note.subject_code, models.Note.subject_name)
        .filter(models.Note.is_removed == False)  # noqa: E712
        .filter(models.Note.subject_code.ilike(f"%{escaped}%", escape="\\"))
        .order_by(models.Note.created_at.desc())
        .all()
    )

    grouped: dict[str, schemas.SubjectSearchResult] = {}
    for code, name in rows:  # newest first, so the first name seen is the latest
        if code not in grouped:
            grouped[code] = schemas.SubjectSearchResult(
                subject_code=code, subject_name=name, note_count=0
            )
        grouped[code].note_count += 1

    return sorted(grouped.values(), key=lambda r: r.subject_code)


# ──── Notes for a specific subject ───────────────────────────────────────────
@router.get("/subject/{subject_code}", response_model=schemas.NoteFolder)
def get_subject_notes(
    subject_code: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return all active notes for a given subject code."""
    code = subject_code.upper().strip()
    notes = (
        db.query(models.Note, models.User.name)
        .join(models.User, models.Note.user_id == models.User.id)
        .filter(models.Note.subject_code == code)
        .filter(models.Note.is_removed == False)  # noqa: E712
        .order_by(models.Note.created_at.desc())
        .all()
    )

    if not notes:
        raise HTTPException(status_code=404, detail="Subject not found or has no active notes")

    folder = schemas.NoteFolder(
        subject_code=code,
        subject_name=notes[0][0].subject_name,
        notes=[_build_note_out(note, uploader_name, current_user.id) for note, uploader_name in notes],
    )
    return folder


# ──── Download ────────────────────────────────────────────────────────────────
@router.get("/download/{note_id}")
def download_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Generate a presigned S3 URL for the requested note.
    Increments the downloader's total_downloads counter.
    """
    note = (
        db.query(models.Note)
        .filter(models.Note.id == note_id, models.Note.is_removed == False)  # noqa: E712
        .first()
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    url = generate_presigned_url(note.file_path, expiry_seconds=300)
    if not url:
        raise HTTPException(status_code=500, detail="Could not generate download link")

    # Increment download counter for the requesting user
    current_user.total_downloads += 1
    db.commit()

    return {"download_url": url, "expires_in": 300}


# ──── Report ──────────────────────────────────────────────────────────────────
@router.post("/{note_id}/report", response_model=schemas.ReportResponse)
def report_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Report a note as incorrect or mis-categorised.
    Each student may report a note only once.
    When report_count reaches REPORT_THRESHOLD the note is auto-removed.
    """
    note = (
        db.query(models.Note)
        .filter(models.Note.id == note_id, models.Note.is_removed == False)  # noqa: E712
        .first()
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found or already removed")

    # Prevent self-reporting
    if note.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot report your own note")

    # Insert report row — unique constraint prevents duplicates
    report = models.NoteReport(note_id=note_id, user_id=current_user.id)
    db.add(report)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="You have already reported this note")

    # Increment report count
    note.report_count += 1

    # Auto-remove if threshold reached
    if note.report_count >= REPORT_THRESHOLD:
        note.is_removed = True

    db.commit()

    return schemas.ReportResponse(
        message=(
            "Note has been removed due to too many reports."
            if note.is_removed
            else "Note reported successfully. Thank you for your feedback."
        ),
        report_count=note.report_count,
    )
