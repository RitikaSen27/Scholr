import uuid
from collections import defaultdict
from datetime import date
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
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
    )

    badge_outs = [schemas.BadgeOut.model_validate(b) for b in new_badges]

    return schemas.UploadResponse(
        note=note_out,
        new_badges=badge_outs,
        streak=new_streak,
        message=f"Note uploaded successfully! Streak: {new_streak} days.",
    )


@router.get("/list", response_model=List[schemas.NoteFolder])
def list_notes(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    """
    Return all notes grouped by subject_code, sorted by upload_date descending.
    Filenames are masked — only upload_date and tag are exposed.
    """
    notes = (
        db.query(models.Note, models.User.name)
        .join(models.User, models.Note.user_id == models.User.id)
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
        folders[code].notes.append(
            schemas.NoteOut(
                id=note.id,
                subject_code=note.subject_code,
                subject_name=note.subject_name,
                professor=note.professor,
                tag=note.tag,
                upload_date=note.upload_date,
                uploader_name=uploader_name,
            )
        )

    return list(folders.values())


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
    note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    url = generate_presigned_url(note.file_path, expiry_seconds=300)
    if not url:
        raise HTTPException(status_code=500, detail="Could not generate download link")

    # Increment download counter for the requesting user
    current_user.total_downloads += 1
    db.commit()

    return {"download_url": url, "expires_in": 300}
