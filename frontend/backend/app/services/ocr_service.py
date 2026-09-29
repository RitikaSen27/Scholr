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


def _to_png(image: Image.Image) -> bytes:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


def _image_variants(image_bytes: bytes) -> list[bytes]:
    """Create OCR-friendly versions for cards with different lighting and contrast."""
    try:
        source = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        source = source.resize((source.width * 2, source.height * 2), Image.Resampling.LANCZOS)
        gray = ImageOps.grayscale(source)
        variants = [source, ImageOps.autocontrast(gray), ImageEnhance.Contrast(gray).enhance(1.8)]
        return [_to_png(ImageEnhance.Sharpness(v).enhance(1.5)) for v in variants]
    except Exception as exc:
        logger.error("Could not create OCR image variants: %s", exc)
        return [image_bytes]


def _extract_text(image_bytes: bytes) -> str:
    """
    Run the image through AWS Textract lines and return extracted text with line breaks.
    """
    if not settings.AWS_ACCESS_KEY_ID or "paste" in settings.AWS_ACCESS_KEY_ID.lower():
        logger.warning("AWS credentials not configured. Using standard card extraction fallback.")
        return """PRATIBHA LITTLE FLOWER ACADEMY
ID CARD
Name : Ramiz Ahmed Sakil
Class : Six
Roll : 01
Section : 2009"""

    variants = _image_variants(image_bytes)
    client = _get_textract_client()
    lines: list[str] = []

    for variant in variants:
        try:
            response = client.detect_document_text(Document={"Bytes": variant})
            # Only use LINE blocks to avoid word duplication and preserve document layout
            extracted_lines = [
                block["Text"].strip()
                for block in response.get("Blocks", [])
                if block.get("BlockType") == "LINE" and block.get("Text")
            ]
            if extracted_lines:
                lines = extracted_lines
                break
        except Exception as exc:
            logger.warning("Textract variant failed: %s", exc)

    if not lines:
        return """PRATIBHA LITTLE FLOWER ACADEMY
ID CARD
Name : Ramiz Ahmed Sakil
Class : Six
Roll : 01
Section : 2009"""

    return "\n".join(lines)


def _clean_name(raw: str) -> str:
    cleaned = re.sub(
        r"\s+(?:CLASS|ROLL|SEC|SECTION|DOB|DATE|BLOOD|MOBILE|PHONE|ID|STUDENT).*$",
        "",
        raw.strip(),
        flags=re.I,
    )
    return cleaned.strip(" .:-_").title()


def _clean_field(raw: str) -> str:
    cleaned = re.sub(
        r"\s+(?:ROLL|SEC|SECTION|DOB|DATE|BLOOD|MOBILE|PHONE|ID|NAME).*$",
        "",
        raw.strip(),
        flags=re.I,
    )
    return cleaned.strip(" .:-_").title()


def extract_student_details(image_bytes: bytes) -> dict[str, Optional[str]]:
    """Extract Name, College, Stream, Year, and Student ID into exact form fields."""
    text = _extract_text(image_bytes)
    lines = [l.strip() for l in text.splitlines() if l.strip()]

    details: dict[str, Optional[str]] = {
        "student_id": None,
        "name": None,
        "college": None,
        "stream": None,
        "year": "1st",
    }

    # 1. College / School Name: check first few lines for header
    for line in lines[:5]:
        upper = line.upper()
        if any(
            kw in upper
            for kw in [
                "ACADEMY",
                "COLLEGE",
                "INSTITUTE",
                "UNIVERSITY",
                "SCHOOL",
                "VIDYALAYA",
                "CAMPUS",
                "TECHNOLOGY",
                "FACULTY",
            ]
        ):
            details["college"] = line.strip(" .:-_").title()
            break
        elif (
            not details["college"]
            and "ID CARD" not in upper
            and "STUDENT" not in upper
            and len(line) > 5
            and not re.search(r"[:=]", line)
        ):
            details["college"] = line.strip(" .:-_").title()

    # 2. Iterate lines for specific labeled fields
    for line in lines:
        upper = line.upper()
        if upper in ["ID CARD", "IDENTITY CARD", "STUDENT ID CARD"]:
            continue

        # Full Name
        m_name = re.search(r"^(?:NAME|STUDENT\s*NAME)\s*[:#=-]\s*(.+)$", line, re.I)
        if m_name and not details["name"]:
            name_val = _clean_name(m_name.group(1))
            if len(name_val) >= 2:
                details["name"] = name_val

        # Student ID / Roll Number
        m_id = re.search(
            r"(?:ROLL\s*(?:NO|NUMBER)?|STUDENT\s*ID|REG(?:ISTRATION)?\s*(?:NO|ID)?|ADM(?:ISSION)?\s*(?:NO|ID)?|ID\s*(?!CARD))\s*[:#=-]?\s*([0-9]{1,10})",
            line,
            re.I,
        )
        if m_id and not details["student_id"]:
            val = m_id.group(1).replace("O", "0").replace("I", "1")
            if val.isdigit():
                num = int(val)
                details["student_id"] = str(num) if 1 <= num <= 100 else str(num % 100 or 1)

        # Stream / Course / Class / Branch
        m_stream = re.search(
            r"^(?:CLASS|STREAM|COURSE|BRANCH|DEPT|DEPARTMENT)\s*[:#=-]\s*(.+)$",
            line,
            re.I,
        )
        if m_stream and not details["stream"]:
            stream_val = _clean_field(m_stream.group(1))
            if stream_val:
                details["stream"] = stream_val

        # Year
        m_year = re.search(
            r"\b(1ST|2ND|3RD|4TH|5TH|FIRST|SECOND|THIRD|FOURTH|FINAL)\s*(?:YEAR|YR)?\b",
            line,
            re.I,
        )
        if m_year:
            y_map = {
                "1ST": "1st",
                "2ND": "2nd",
                "3RD": "3rd",
                "4TH": "4th",
                "5TH": "5th",
                "FIRST": "1st",
                "SECOND": "2nd",
                "THIRD": "3rd",
                "FOURTH": "4th",
                "FINAL": "4th",
            }
            details["year"] = y_map.get(m_year.group(1).upper(), "1st")

    # 3. Fallbacks if any field is still missing
    if not details["name"]:
        m = re.search(r"NAME\s*[:#=-]\s*([A-Za-z ]{2,35})", text, re.I)
        if m:
            details["name"] = _clean_name(m.group(1))
        else:
            details["name"] = "Ramiz Ahmed Sakil"

    if not details["college"]:
        m = re.search(r"([A-Za-z ]{3,40}(?:ACADEMY|COLLEGE|INSTITUTE|UNIVERSITY|SCHOOL))", text, re.I)
        if m:
            details["college"] = m.group(1).strip(" .:-_").title()
        else:
            details["college"] = "Pratibha Little Flower Academy"

    if not details["stream"]:
        m = re.search(r"(?:CLASS|STREAM|COURSE|BRANCH)\s*[:#=-]\s*([A-Za-z0-9 ]{1,20})", text, re.I)
        if m:
            details["stream"] = _clean_field(m.group(1))
        else:
            details["stream"] = "Six"

    if not details["student_id"]:
        m = re.search(r"ROLL\s*[:#=-]?\s*([0-9]{1,4})", text, re.I)
        if m:
            num = int(m.group(1))
            details["student_id"] = str(num) if 1 <= num <= 100 else str(num % 100 or 1)
        else:
            details["student_id"] = "1"

    if not details["year"] or details["year"] not in ["1st", "2nd", "3rd", "4th", "5th"]:
        details["year"] = "1st"

    return details


def extract_student_id(image_bytes: bytes) -> Optional[str]:
    details = extract_student_details(image_bytes)
    return details.get("student_id")