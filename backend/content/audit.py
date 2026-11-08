"""Structured audit logging for authenticated content changes.

Logs the actor, the object and the names of changed fields. Values are never
logged: portfolio content can contain private drafts and contact details.
"""

from __future__ import annotations

import logging
from typing import Any, Iterable

logger = logging.getLogger("content.audit")


def client_ip(request: Any) -> str:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def log_admin_action(
    request: Any,
    action: str,
    instance: Any,
    fields: Iterable[str] | None = None,
) -> None:
    user = getattr(request, "user", None)
    username = user.get_username() if user and user.is_authenticated else "anonymous"
    field_list = ",".join(sorted(str(field) for field in (fields or [])))
    logger.info(
        "admin_action action=%s model=%s pk=%s user=%s ip=%s fields=%s",
        action,
        instance._meta.label_lower,
        instance.pk,
        username,
        client_ip(request),
        field_list or "-",
    )
