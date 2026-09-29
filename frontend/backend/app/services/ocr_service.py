import io
import logging
import os
import re
from typing import Optional

import boto3
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


def _run_gemini_ocr(image_bytes: bytes) -> str:
    """Use Gemini Vision API if GEMINI_API_KEY is configured."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return ""
    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                "Extract all text lines visible on this student ID card image. Return ONLY line-by-line text."
            ]
        )
        return response.text or ""
    except Exception as exc:
        logger.warning("Gemini OCR failed: %s", exc)
    return ""


def _run_local_rapidocr(image_bytes: bytes) -> str:
    """Run local RapidOCR engine directly on image bytes."""
    try:
        from rapidocr_onnxruntime import RapidOCR
        engine = RapidOCR()
        result, _ = engine(image_bytes)
        if result:
            lines = [item[1].strip() for item in result if item and len(item) > 1 and item[1].strip()]
            return "\n".join(lines)
    except Exception as exc:
        logger.warning("Local RapidOCR failed or not installed: %s", exc)
    return ""


def _extract_text(image_bytes: bytes) -> str:
    """
    Extract text using Gemini, AWS Textract, or local RapidOCR.
    """
    # 1. Try Gemini Vision if API key is provided
    gemini_text = _run_gemini_ocr(image_bytes)
    if gemini_text:
        return gemini_text

    # 2. Try AWS Textract if credentials are provided
    if settings.AWS_ACCESS_KEY_ID and "paste" not in settings.AWS_ACCESS_KEY_ID.lower() and len(settings.AWS_ACCESS_KEY_ID) > 5:
        variants = _image_variants(image_bytes)
        client = _get_textract_client()

        for variant in variants:
            try:
                response = client.detect_document_text(Document={"Bytes": variant})
                extracted_lines = [
                    block["Text"].strip()
                    for block in response.get("Blocks", [])
                    if block.get("BlockType") == "LINE" and block.get("Text")
                ]
                if extracted_lines:
                    return "\n".join(extracted_lines)
            except Exception as exc:
                logger.warning("AWS Textract variant failed: %s", exc)

    # 3. Local RapidOCR Fallback
    local_text = _run_local_rapidocr(image_bytes)
    if local_text:
        return local_text

    return ""


def _clean_name(raw: str) -> str:
    cleaned = re.sub(
        r"\s+\b(?:CLASS|ROLL|SEC|SECTION|DOB|DATE|BLOOD|MOBILE|PHONE|ID|STUDENT|COLLEGE|STREAM|YEAR)\b.*$",
        "",
        raw.strip(),
        flags=re.I,
    )
    return cleaned.strip(" .:-_").title()


def _clean_field(raw: str) -> str:
    cleaned = re.sub(
        r"\s+\b(?:ROLL|SEC|SECTION|DOB|DATE|BLOOD|MOBILE|PHONE|ID|NAME|YEAR)\b.*$",
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

    if not lines:
        return details

    # 1. College / Institution Name: Check top lines first
    header_keywords = [
        "COLLEGE", "UNIVERSITY", "INSTITUTE", "ACADEMY", "SCHOOL",
        "VIDYALAYA", "CAMPUS", "TECHNOLOGY", "FACULTY", "POLYTECHNIC", "ENGINEERING"
    ]
    for line in lines[:5]:
        upper = line.upper()
        if any(kw in upper for kw in header_keywords):
            details["college"] = line.strip(" .:-_").title()
            break
    
    if not details["college"]:
        for line in lines[:3]:
            upper = line.upper()
            if (
                "ID CARD" not in upper
                and "STUDENT" not in upper
                and "IDENTITY" not in upper
                and len(line) > 5
                and not re.search(r"[:=]", line)
            ):
                details["college"] = line.strip(" .:-_").title()
                break

    # 2. Extract fields by searching each line
    for line in lines:
        upper = line.upper()
        if any(h in upper for h in ["ID CARD", "IDENTITY CARD", "STUDENT CARD", "STUDENT IDENTITY"]):
            continue

        # Full Name
        if not details["name"]:
            m_name = re.search(r"^(?:NAME|STUDENT\s*NAME|FULL\s*NAME|STUDENT['’]?S\s*NAME)\s*[:#=-]?\s*(.+)$", line, re.I)
            if m_name:
                name_val = _clean_name(m_name.group(1))
                if len(name_val) >= 2:
                    details["name"] = name_val

        # Student ID / Roll / Reg Number
        if not details["student_id"]:
            m_id = re.search(
                r"(?:ROLL\s*(?:NO|NUMBER)?|STUDENT\s*ID|REG(?:ISTRATION)?\s*(?:NO|ID)?|ADM(?:ISSION)?\s*(?:NO|ID)?|ENROLLMENT\s*(?:NO|ID)?|ID\s*(?!CARD))\s*[:#=-]?\s*([A-Za-z0-9\/-]{1,20})",
                line,
                re.I,
            )
            if m_id:
                val = m_id.group(1).strip()
                if len(val) >= 1 and not any(k in val.upper() for k in ["CARD", "IDENTITY", "STUDENT", "VALID"]):
                    details["student_id"] = val

        # Stream / Course / Class / Branch / Department
        if not details["stream"]:
            m_stream = re.search(
                r"^(?:CLASS|STREAM|COURSE|BRANCH|DEPT|DEPARTMENT|PROGRAM)\s*[:#=-]?\s*(.+)$",
                line,
                re.I,
            )
            if m_stream:
                stream_val = _clean_field(m_stream.group(1))
                if stream_val and not any(k in stream_val.upper() for k in ["CARD", "IDENTITY", "STUDENT"]):
                    details["stream"] = stream_val

        # Year / Semester
        m_year = re.search(
            r"\b(1ST|2ND|3RD|4TH|5TH|FIRST|SECOND|THIRD|FOURTH|FINAL)\s*(?:YEAR|YR|SEM)?\b",
            line,
            re.I,
        )
        if m_year:
            y_map = {
                "1ST": "1st", "2ND": "2nd", "3RD": "3rd", "4TH": "4th", "5TH": "5th",
                "FIRST": "1st", "SECOND": "2nd", "THIRD": "3rd", "FOURTH": "4th", "FINAL": "4th",
            }
            details["year"] = y_map.get(m_year.group(1).upper(), "1st")

    # 3. Smart Unlabeled Name Fallback
    if not details["name"]:
        # Search lines that look like candidate names (2-4 capitalized words, no numbers or keywords)
        exclude_words = {
            "ID", "CARD", "STUDENT", "IDENTITY", "COLLEGE", "UNIVERSITY", "SCHOOL",
            "ACADEMY", "INSTITUTE", "DOB", "DATE", "BLOOD", "MOBILE", "PHONE", "ROLL",
            "REGISTRATION", "ADDRESS", "VALID", "UPTO", "PRINCIPAL", "SIGNATURE"
        }
        for line in lines[1:6]:
            words = line.split()
            if 2 <= len(words) <= 4 and not any(char.isdigit() for char in line):
                upper_words = [w.upper() for w in words]
                if not any(w in exclude_words for w in upper_words):
                    details["name"] = line.strip(" .:-_").title()
                    break

    # 4. Smart Stream Keyword Search if missing
    if not details["stream"]:
        stream_keywords = [
            "B.TECH", "BTECH", "B.SC", "BSC", "B.E", "BE", "M.TECH", "MBA", "BBA",
            "B.COM", "BCOM", "COMPUTER SCIENCE", "COMPUTER", "CSE", "ECE", "MECHANICAL", "CIVIL",
            "PHYSICS", "CHEMISTRY", "MATHEMATICS", "SCIENCE", "ARTS", "COMMERCE", "INFORMATION TECHNOLOGY"
        ]
        for line in lines:
            upper = line.upper()
            if any(h in upper for h in ["ID CARD", "IDENTITY", "STUDENT CARD"]):
                continue
            for kw in stream_keywords:
                if re.search(r"\b" + re.escape(kw) + r"\b", upper):
                    details["stream"] = line.strip(" .:-_").title()
                    break
            if details["stream"]:
                break

    # 5. Smart ID Standalone Search if missing
    if not details["student_id"]:
        for line in lines:
            # Look for 3-12 digit sequence or roll number like 21BCE0491
            m = re.search(r"\b([A-Z0-9]{3,14})\b", line)
            if m:
                val = m.group(1)
                if any(c.isdigit() for c in val) and not val.upper() in ["CARD", "STUDENT", "VALID"]:
                    details["student_id"] = val
                    break

    return details


def extract_student_id(image_bytes: bytes) -> Optional[str]:
    details = extract_student_details(image_bytes)
    return details.get("student_id")