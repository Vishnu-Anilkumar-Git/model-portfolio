"""Static-site rebuild hook.

Admin writes only enqueue one hosting build per minute. The claim is stored in
the database so it is shared by every Gunicorn worker; the HTTP request itself
runs on a daemon thread so an admin save never waits for the host.
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass
from datetime import timedelta
from urllib import error, request

from django.conf import settings
from django.db.models import Q
from django.utils import timezone

from .models import SiteRebuild

logger = logging.getLogger("content.rebuild")

DEBOUNCE_SECONDS = 60
HOOK_TIMEOUT_SECONDS = 10


@dataclass(frozen=True)
class RebuildResult:
    requested: bool
    configured: bool
    reason: str


def _hook_url() -> str:
    return (getattr(settings, "SITE_REBUILD_HOOK_URL", "") or "").strip()


def _post_to_hook(url: str) -> None:
    """POST to the build hook without ever putting the URL in the log."""
    try:
        hook_request = request.Request(
            url,
            data=b"",
            method="POST",
            headers={"User-Agent": "portfolio-site-rebuild/1.0"},
        )
        with request.urlopen(hook_request, timeout=HOOK_TIMEOUT_SECONDS) as response:
            status = getattr(response, "status", "unknown")
        logger.info("site_rebuild hook succeeded status=%s", status)
    except error.HTTPError as exc:
        logger.warning("site_rebuild hook failed status=%s", exc.code)
    except Exception as exc:  # noqa: BLE001 - a hook must never reach the admin
        # Exception messages from urllib can contain the URL, so log only the
        # exception type. The URL itself is a secret.
        logger.warning("site_rebuild hook failed error=%s", type(exc).__name__)


def _dispatch(url: str) -> None:
    threading.Thread(
        target=_post_to_hook,
        args=(url,),
        name="site-rebuild-hook",
        daemon=True,
    ).start()


def request_site_rebuild(*, force: bool = False) -> RebuildResult:
    """Claim the 60-second slot and start the hook in the background.

    ``force`` is reserved for the explicit dashboard button: automatic content
    signals keep the shared debounce, while a human click should act now.
    """
    url = _hook_url()
    if not url:
        return RebuildResult(requested=False, configured=False, reason="unset")

    now = timezone.now()
    cutoff = now - timedelta(seconds=DEBOUNCE_SECONDS)

    try:
        SiteRebuild.objects.get_or_create(pk=1)
        claim_filter = (
            Q(last_requested_at__isnull=True)
            | Q(last_requested_at__lte=cutoff)
        )
        claimed = SiteRebuild.objects.filter(pk=1)
        if not force:
            claimed = claimed.filter(claim_filter)
        claimed = claimed.update(last_requested_at=now)
    except Exception as exc:  # noqa: BLE001 - signal callbacks must be safe
        logger.warning("site_rebuild claim failed error=%s", type(exc).__name__)
        return RebuildResult(requested=False, configured=True, reason="error")

    if not claimed:
        return RebuildResult(requested=False, configured=True, reason="debounced")

    try:
        _dispatch(url)
    except Exception as exc:  # noqa: BLE001 - thread start can fail at shutdown
        logger.warning("site_rebuild dispatch failed error=%s", type(exc).__name__)
        return RebuildResult(requested=False, configured=True, reason="error")

    logger.info("site_rebuild requested")
    return RebuildResult(requested=True, configured=True, reason="requested")


def rebuild_status() -> dict[str, object]:
    """Safe dashboard fields; never returns the hook URL."""
    state = SiteRebuild.objects.filter(pk=1).only("last_requested_at").first()
    last_requested = state.last_requested_at if state else None
    return {
        "configured": bool(_hook_url()),
        "last_requested_at": last_requested.isoformat() if last_requested else None,
    }
