import logging
import re
from typing import Optional

import cv2
import numpy as np
import pytesseract
from PIL import Image

logger = logging.getLogger(__name__)


def preprocess_image(img_array: np.ndarray) -> np.ndarray:
    """
    Apply OpenCV preprocessing pipeline:
    1. Convert to grayscale
    2. Denoise
    3. Increase contrast via CLAHE
    4. Adaptive threshold (binarization)
    """
    gray = cv2.cvtColor(img_array, cv2.COLOR_BGR2GRAY)
    denoised = cv2.fastNlMeansDenoising(gray, h=10)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(denoised)
    thresh = cv2.adaptiveThreshold(
        enhanced, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 11, 2
    )
    return thresh


def extract_student_id(image_bytes: bytes) -> Optional[str]:
    """
    Run the full OCR pipeline on raw image bytes.
    Returns the best candidate alphanumeric student ID, or None.
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        logger.error("Could not decode image bytes")
        return None

    processed = preprocess_image(img)

    # Run Tesseract with two PSM modes and combine results
    config_options = [
        r"--oem 3 --psm 6",   # uniform block of text
        r"--oem 3 --psm 11",  # sparse text
    ]
    combined_text = ""
    for cfg in config_options:
        try:
            text = pytesseract.image_to_string(processed, config=cfg)
            combined_text += " " + text
        except Exception as exc:
            logger.warning("Tesseract error with config %s: %s", cfg, exc)

    logger.debug("Raw OCR text: %s", combined_text)

    # Extract alphanumeric IDs: 1–15 chars, mix of digits and uppercase letters
    candidates = re.findall(r"\b[A-Z0-9]{1,15}\b", combined_text.upper())

    # Prefer candidates that contain both letters and digits (typical student IDs)
    mixed = [c for c in candidates if re.search(r"[A-Z]", c) and re.search(r"[0-9]", c)]
    if mixed:
        return mixed[0]
    if candidates:
        return candidates[0]

    return None
