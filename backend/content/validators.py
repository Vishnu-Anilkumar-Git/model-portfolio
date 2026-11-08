"""Upload validators shared by every model that accepts a file.

Django's ``ImageField`` already asks Pillow to parse the file, but it does not
cap size and it lets any Pillow-supported format through. A résumé ``FileField``
performs no content check at all, which on a host that serves ``/media/`` from
the API origin would let an administrator accidentally publish an HTML or SVG
document from that origin. These validators close both gaps.
"""

from __future__ import annotations

import io
from pathlib import Path
from typing import Any

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import UploadedFile

MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_AVATAR_BYTES = 2 * 1024 * 1024
MAX_BADGE_BYTES = 2 * 1024 * 1024
MAX_SEO_BYTES = 5 * 1024 * 1024
MAX_RESUME_BYTES = 5 * 1024 * 1024

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
IMAGE_FORMATS = {"JPEG", "PNG", "WEBP", "GIF", "AVIF"}
IMAGE_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
}


def _extension(name: str | None) -> str:
    return Path(name or "").suffix.lower()


def _describe_megabytes(limit: int) -> str:
    return f"{limit // (1024 * 1024)} MB"


def validate_image_size(file: UploadedFile, limit: int) -> None:
    if file.size and file.size > limit:
        raise ValidationError(
            f"File is too large ({file.size / (1024 * 1024):.1f} MB). "
            f"Maximum size is {_describe_megabytes(limit)}.",
            code="file_too_large",
        )


def _validate_image(file: Any, limit: int, label: str) -> None:
    if not isinstance(file, UploadedFile):
        # Existing stored file being re-validated by a serializer.
        return

    validate_image_size(file, limit)

    if _extension(file.name) not in IMAGE_EXTENSIONS:
        raise ValidationError(
            f"{label} must be a JPEG, PNG, WebP, GIF or AVIF image.",
            code="invalid_extension",
        )

    content_type = (getattr(file, "content_type", "") or "").lower()
    if content_type and content_type not in IMAGE_CONTENT_TYPES:
        raise ValidationError(
            f"{label} has an unexpected content type ({content_type}).",
            code="invalid_content_type",
        )

    data = file.read()
    file.seek(0)
    if not data:
        raise ValidationError(f"{label} is empty.", code="empty_file")

    # Parse from memory so Pillow never closes Django's upload handle.
    from PIL import Image, UnidentifiedImageError

    try:
        with Image.open(io.BytesIO(data)) as image:
            image.verify()
            image_format = image.format
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        SyntaxError,
        Image.DecompressionBombError,
    ) as exc:
        raise ValidationError(
            f"{label} is not a valid image file.", code="invalid_image"
        ) from exc

    if image_format not in IMAGE_FORMATS:
        raise ValidationError(
            f"{label} uses an unsupported image format.", code="unsupported_format"
        )


def validate_avatar_image(file: Any) -> None:
    _validate_image(file, MAX_AVATAR_BYTES, "Avatar")


def validate_project_image(file: Any) -> None:
    _validate_image(file, MAX_IMAGE_BYTES, "Project image")


def validate_badge_image(file: Any) -> None:
    _validate_image(file, MAX_BADGE_BYTES, "Badge image")


def validate_seo_image(file: Any) -> None:
    _validate_image(file, MAX_SEO_BYTES, "Social share image")


def validate_resume_pdf(file: Any) -> None:
    """Only real PDFs, capped in size, so /media/ cannot serve active content."""
    if not isinstance(file, UploadedFile):
        return

    if file.size and file.size > MAX_RESUME_BYTES:
        raise ValidationError(
            f"Résumé is too large ({file.size / (1024 * 1024):.1f} MB). "
            f"Maximum size is {_describe_megabytes(MAX_RESUME_BYTES)}.",
            code="file_too_large",
        )

    if _extension(file.name) != ".pdf":
        raise ValidationError(
            "Résumé must be a PDF file.", code="invalid_extension"
        )

    content_type = (getattr(file, "content_type", "") or "").lower()
    if content_type and content_type not in {
        "application/pdf",
        "application/octet-stream",
    }:
        raise ValidationError(
            "Résumé must be uploaded as application/pdf.",
            code="invalid_content_type",
        )

    header = file.read(5)
    file.seek(0)
    if header != b"%PDF-":
        raise ValidationError(
            "That file is not a valid PDF document.", code="invalid_pdf"
        )
