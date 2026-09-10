import io
import logging
import re
from typing import Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from PIL import Image

from app.config import settings

logger = logging.getLogger(__name__)


def _get_textract_client():
    return boto3.client(
        "textract",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )


def _normalize_to_png(image_bytes: bytes) -> Optional[bytes]:
    """
    Textract's synchronous DetectDocumentText only accepts JPEG or PNG.
    Re-encode whatever format we received (webp, bmp, etc.) into PNG so
    the upload restrictions in ocr_router.py can stay as they are.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        # Small ID cards often contain text that is too fine for OCR at its
        # original resolution. Upscaling gives Textract more character detail.
        img = img.resize((img.width * 2, img.height * 2), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    except Exception as exc:
        logger.error("Could not process image before OCR: %s", exc)
        return None


def extract_student_id(image_bytes: bytes) -> Optional[str]:
    """
    Run the image through AWS Textract and return the best candidate
    alphanumeric student ID, or None if nothing usable was found.
    """
    normalized = _normalize_to_png(image_bytes)
    if normalized is None:
        return None

    client = _get_textract_client()
    try:
        response = client.detect_document_text(Document={"Bytes": normalized})
    except (BotoCoreError, ClientError) as exc:
        logger.error("Textract call failed: %s", exc)
        return None

    lines = [
        block["Text"]
        for block in response.get("Blocks", [])
        if block.get("BlockType") == "LINE"
    ]
    combined_text = " ".join(lines)
    logger.debug("Raw Textract text: %s", combined_text)

    normalized_text = combined_text.upper()

    # Prefer the value immediately following an ID-like label, including short IDs.
    labeled_values = re.findall(
        r"(?:STUDENT\s*ID|ID\s*(?:NO|NUMBER)?|ROLL\s*(?:NO|NUMBER)?|REG(?:ISTRATION)?\s*NO|ADMISSION\s*(?:NO|NUMBER)?)\s*[:#-]?\s*([A-Z0-9]{1,15})",
        normalized_text,
    )
    numeric_labeled = [value for value in labeled_values if value.isdigit() and 1 <= int(value) <= 100]
    if numeric_labeled:
        return numeric_labeled[0]

    # Fall back to numeric IDs in the supported range, then mixed alphanumeric IDs.
    numeric_candidates = [
        value for value in re.findall(r"\b\d{1,3}\b", normalized_text)
        if 1 <= int(value) <= 100
    ]
    if numeric_candidates:
        return numeric_candidates[0]

    candidates = re.findall(r"\b[A-Z0-9]{2,15}\b", normalized_text)

    # Prefer candidates that contain both letters and digits (typical student IDs)
    mixed = [c for c in candidates if re.search(r"[A-Z]", c) and re.search(r"[0-9]", c)]
    if mixed:
        return mixed[0]
    if candidates:
        return candidates[0]

    return None