import io
import logging
import re
from typing import Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from PIL import Image, ImageEnhance, ImageOps

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
        img = img.resize((img.width * 3, img.height * 3), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    except Exception as exc:
        logger.error("Could not process image before OCR: %s", exc)
        return None


def _image_variants(image_bytes: bytes) -> list[bytes]:
    """Create OCR-friendly versions for cards with different lighting and contrast."""
    try:
        source = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        source = source.resize((source.width * 3, source.height * 3), Image.Resampling.LANCZOS)
        gray = ImageOps.grayscale(source)
        variants = [source, ImageOps.autocontrast(gray), ImageEnhance.Contrast(gray).enhance(1.8)]
        return [
            _to_png(ImageEnhance.Sharpness(variant).enhance(1.5))
            for variant in variants
        ]
    except Exception as exc:
        logger.error("Could not create OCR image variants: %s", exc)
        normalized = _normalize_to_png(image_bytes)
        return [normalized] if normalized else []


def _to_png(image: Image.Image) -> bytes:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


def _pick_student_id(text: str) -> Optional[str]:
    normalized_text = re.sub(r"\s+", " ", text.upper())
    label_pattern = (
        r"(?:STUDENT\s*[.:-]?\s*(?:ID|NO|NUMBER)|"
        r"(?:ID|IDENTIFICATION)\s*[.:-]?\s*(?:NO|NUMBER|CODE)?|"
        r"ROLL\s*[.:-]?\s*(?:NO|NUMBER)?|"
        r"(?:REG|REGD|REGISTRATION|ENROL(?:L)?MENT|ADMISSION|ADMN)\s*"
        r"[.:-]?\s*(?:ID|NO|NUMBER|CODE)?)\s*[:#=-]?\s*([A-Z0-9]{1,15})"
    )

    labeled_values = re.findall(label_pattern, normalized_text)
    numeric_labeled = []
    for value in labeled_values:
        cleaned_value = value.replace("O", "0").replace("I", "1")
        if cleaned_value.isdigit() and 1 <= int(cleaned_value) <= 100:
            numeric_labeled.append(str(int(cleaned_value)))
    if numeric_labeled:
        return numeric_labeled[0]

    # Some cards print only the ID value without a label. Ignore likely years,
    # dates, and long phone numbers before accepting a standalone number.
    numeric_candidates = []
    for value in re.findall(r"\b\d{1,15}\b", normalized_text):
        if 1 <= int(value) <= 100 and not re.search(r"(?:19|20)\d{2}", value):
            numeric_candidates.append(str(int(value)))
    if numeric_candidates:
        return numeric_candidates[0]

    candidates = re.findall(r"\b[A-Z0-9]{2,15}\b", normalized_text)
    mixed = [candidate for candidate in candidates if re.search(r"[A-Z]", candidate) and re.search(r"[0-9]", candidate)]
    return mixed[0] if mixed else (candidates[0] if candidates else None)


def _extract_text(image_bytes: bytes) -> Optional[str]:
    """
    Run the image through AWS Textract and return the best candidate
    alphanumeric student ID, or None if nothing usable was found.
    """
    variants = _image_variants(image_bytes)
    if not variants:
        return None

    client = _get_textract_client()
    all_text: list[str] = []
    for variant in variants:
        try:
            response = client.detect_document_text(Document={"Bytes": variant})
            all_text.extend(
                block["Text"]
                for block in response.get("Blocks", [])
                if block.get("BlockType") in {"LINE", "WORD"} and block.get("Text")
            )
        except (BotoCoreError, ClientError) as exc:
            logger.warning("Textract variant failed: %s", exc)

    combined_text = " ".join(all_text)
    logger.debug("Raw Textract text from %d variants: %s", len(variants), combined_text)
    return combined_text or None


def extract_student_id(image_bytes: bytes) -> Optional[str]:
    text = _extract_text(image_bytes)
    return _pick_student_id(text) if text else None


def extract_student_details(image_bytes: bytes) -> dict[str, Optional[str]]:
    """Extract the ID and common profile fields when cards include those labels."""
    text = _extract_text(image_bytes)
    if not text:
        return {"student_id": None, "name": None, "college": None, "stream": None, "year": None}

    normalized = re.sub(r"\s+", " ", text.upper())

    def labeled_value(labels: str) -> Optional[str]:
        match = re.search(rf"(?:{labels})\s*[.:-]?\s*([A-Z][A-Z .'-]{{1,50}})", normalized)
        return match.group(1).strip(" .:-") if match else None

    year_match = re.search(r"\b(1ST|2ND|3RD|4TH|5TH|19\d{2}|20\d{2})\s*(?:YEAR|YR)?\b", normalized)
    return {
        "student_id": _pick_student_id(text),
        "name": labeled_value(r"NAME|STUDENT\s*NAME"),
        "college": labeled_value(r"COLLEGE|INSTITUTE|SCHOOL|UNIVERSITY"),
        "stream": labeled_value(r"COURSE|BRANCH|STREAM|CLASS"),
        "year": year_match.group(1) if year_match else None,
    }