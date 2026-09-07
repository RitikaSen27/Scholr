from fastapi import APIRouter, File, UploadFile, HTTPException

from app.schemas import OCRResponse
from app.services.ocr_service import extract_student_id

router = APIRouter(prefix="/api/backend/api/ocr", tags=["ocr"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}


@router.post("/extract-id", response_model=OCRResponse)
async def extract_id(file: UploadFile = File(...)):
    """
    Accept a student ID card image, run OCR, and return the extracted student ID.
    """
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported image type: {file.content_type}. Use JPEG, PNG, WebP, or BMP.",
        )

    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:  # 10 MB limit
        raise HTTPException(status_code=413, detail="Image too large (max 10 MB)")

    student_id = extract_student_id(image_bytes)
    if not student_id:
        raise HTTPException(
            status_code=422,
            detail="Could not extract a student ID from the image. Please ensure the card is clearly visible.",
        )

    return OCRResponse(student_id=student_id)
