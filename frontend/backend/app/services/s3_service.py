import logging
from typing import Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.config import settings

logger = logging.getLogger(__name__)


def _get_client():
    kwargs = {
        "aws_access_key_id": settings.AWS_ACCESS_KEY_ID,
        "aws_secret_access_key": settings.AWS_SECRET_ACCESS_KEY,
        "region_name": settings.AWS_REGION,
    }
    if settings.AWS_ENDPOINT_URL:
        kwargs["endpoint_url"] = settings.AWS_ENDPOINT_URL
        
    return boto3.client("s3", **kwargs)


def upload_file(file_bytes: bytes, s3_key: str, content_type: str = "application/octet-stream") -> str:
    """
    Upload file bytes to S3.
    Returns the S3 key on success.
    Raises RuntimeError on failure.
    """
    client = _get_client()
    try:
        client.put_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=s3_key,
            Body=file_bytes,
            ContentType=content_type,
        )
        logger.info("Uploaded %s to S3 bucket %s", s3_key, settings.S3_BUCKET_NAME)
        return s3_key
    except (BotoCoreError, ClientError) as exc:
        logger.error("S3 upload failed for key %s: %s", s3_key, exc)
        raise RuntimeError(f"S3 upload failed: {exc}") from exc


def generate_presigned_url(s3_key: str, expiry_seconds: int = 3600) -> Optional[str]:
    """
    Generate a presigned URL for downloading a file from S3.
    Returns the URL string, or None on error.
    """
    client = _get_client()
    try:
        url = client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.S3_BUCKET_NAME, "Key": s3_key},
            ExpiresIn=expiry_seconds,
        )
        return url
    except (BotoCoreError, ClientError) as exc:
        logger.error("Could not generate presigned URL for %s: %s", s3_key, exc)
        return None


def delete_file(s3_key: str) -> None:
    """Delete an object from S3."""
    client = _get_client()
    try:
        client.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
        logger.info("Deleted S3 object %s", s3_key)
    except (BotoCoreError, ClientError) as exc:
        logger.warning("S3 delete failed for key %s: %s", s3_key, exc)
