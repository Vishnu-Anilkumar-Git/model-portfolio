"""Static-site rebuild hook.

The public site is pre-rendered, so a content edit only reaches visitors after
the host rebuilds it. Admin writes therefore request one build through a hosting
deploy hook (Vercel Deploy Hook URL in ``SITE_REBUILD_HOOK_URL``).

Three rules keep this safe for the API process:

* the request is scheduled with ``transaction.on_commit``, so a rolled-back edit
  never publishes;
* one claim per 60 seconds is stored in the database, because the API runs a
  single Gunicorn worker today but must stay correct if that changes;
* the HTTP call runs on a daemon thread with a short timeout, so an admin save
  never waits for the hosting provider and a hook failure never surfaces.
"""

from __future__ import annotations

import logging
import sys
import threading
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import timedelta
from typing import Iterator
from urllib import error, request

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import SiteRebuild

logger = logging.getLogger("content.rebuild")

DEBOUNCE_SECONDS = 60
HOOK_TIMEOUT_SECONDS = 10
HOOK_ATTEMPTS = 2  # the first call plus one retry on a network failure

# Commands that write content in bulk. The deploy running them rebuilds the site
# anyway, so a hook call from inside one would start a rebuild loop.
SUPPRESSED_COMMANDS = frozenset(
    {"migrate", "makemigrations", "flush", "loaddata", "seed_portfolio"}
)

_suppress_depth = 0
_configuration_logged = False


@dataclass(frozen=True)
class RebuildResult:
    requested: bool
    configured: bool
    reason: str


@contextmanager
def suppress_site_rebuilds() -> Iterator[None]:
    """Keep signal-driven rebuilds quiet during bulk content writes."""
    global _suppress_depth
    _suppress_depth += 1
    try:
        yield
    finally:
        _suppress_depth -= 1


def _in_suppressed_command() -> bool:
    if _suppress_depth:
        return True
    # e.g. ``manage.py migrate`` or ``manage.py seed_portfolio``.
    return any(argument in SUPPRESSED_COMMANDS for argument in sys.argv[:3])


def _hook_url() -> str:
    return (getattr(settings, "SITE_REBUILD_HOOK_URL", "") or "").strip()


def log_configuration() -> None:
    """State once, at startup, whether content changes publish the site."""
    global _configuration_logged
    if _configuration_logged:
        return
    _configuration_logged = True

    if _hook_url():
        logger.info("auto-publish enabled: content changes request a site rebuild")
    else:
        logger.info(
            "auto-publish disabled: SITE_REBUILD_HOOK_URL is not set, so content "
            "changes do not rebuild the public site"
        )


def _post_to_hook(url: str) -> None:
    """POST to the deploy hook, retrying a network failure once.

    The URL is a secret: only the status code or the exception type is logged.
    """
    for attempt in range(1, HOOK_ATTEMPTS + 1):
        try:
            hook_request = request.Request(
                url,
                data=b"",
                method="POST",
                headers={"User-Agent": "portfolio-site-rebuild/1.0"},
            )
            with request.urlopen(
                hook_request, timeout=HOOK_TIMEOUT_SECONDS
            ) as response:
                logger.info(
                    "site_rebuild hook succeeded status=%s",
                    getattr(response, "status", "unknown"),
                )
            return
        except error.HTTPError as exc:
            # The host answered, so this is not a network failure: do not retry.
            logger.warning("site_rebuild hook failed status=%s", exc.code)
            return
        except Exception as exc:  # noqa: BLE001 - a hook must never reach the admin
            # urllib exceptions can embed the request URL, so log only the type.
            logger.warning(
                "site_rebuild hook failed error=%s attempt=%d/%d",
                type(exc).__name__,
                attempt,
                HOOK_ATTEMPTS,
            )


def _dispatch(url: str) -> None:
    threading.Thread(
        target=_post_to_hook,
        args=(url,),
        name="site-rebuild-hook",
        daemon=True,
    ).start()


def _claim(force: bool) -> bool:
    """Take the 60-second slot; False when an earlier edit already took it."""
    SiteRebuild.objects.get_or_create(pk=1)
    now = timezone.now()
    cutoff = now - timedelta(seconds=DEBOUNCE_SECONDS)

    claimed = SiteRebuild.objects.filter(pk=1)
    if not force:
        claimed = claimed.filter(
            Q(last_requested_at__isnull=True) | Q(last_requested_at__lte=cutoff)
        )
    return bool(claimed.update(last_requested_at=now))


def _trigger(url: str, reason: str, force: bool) -> RebuildResult:
    try:
        if not _claim(force):
            logger.info("site_rebuild debounced reason=%s", reason)
            return RebuildResult(requested=False, configured=True, reason="debounced")
    except Exception as exc:  # noqa: BLE001 - signal callbacks must be safe
        logger.warning("site_rebuild claim failed error=%s", type(exc).__name__)
        return RebuildResult(requested=False, configured=True, reason="error")

    try:
        _dispatch(url)
    except Exception as exc:  # noqa: BLE001 - thread start can fail at shutdown
        logger.warning("site_rebuild dispatch failed error=%s", type(exc).__name__)
        return RebuildResult(requested=False, configured=True, reason="error")

    logger.info("site_rebuild requested reason=%s", reason)
    return RebuildResult(requested=True, configured=True, reason="requested")


def request_site_rebuild(
    reason: str = "content_change", *, force: bool = False
) -> RebuildResult:
    """Ask the host for one build of the public site.

    Signal callers go through ``transaction.on_commit``: a rolled-back edit never
    publishes, and the caller is never blocked by the hosting provider. The
    dashboard's **Publish site** button passes ``force=True`` — it is a deliberate
    human action outside any content write, and it reports the outcome back.
    """
    url = _hook_url()
    if not url:
        return RebuildResult(requested=False, configured=False, reason="unset")

    if _in_suppressed_command():
        logger.info("site_rebuild skipped reason=%s during a bulk command", reason)
        return RebuildResult(requested=False, configured=True, reason="suppressed")

    if force:
        return _trigger(url, reason, force=True)

    outcome: list[RebuildResult] = []

    def trigger() -> None:
        outcome.append(_trigger(url, reason, force=False))

    try:
        transaction.on_commit(trigger)
    except Exception as exc:  # noqa: BLE001 - publishing is best effort
        logger.warning("site_rebuild scheduling failed error=%s", type(exc).__name__)
        return RebuildResult(requested=False, configured=True, reason="error")

    if outcome:
        return outcome[0]
    # Still inside the surrounding transaction: the claim happens on commit.
    return RebuildResult(requested=True, configured=True, reason="queued")


def rebuild_status() -> dict[str, object]:
    """Safe dashboard fields; never returns the hook URL."""
    state = SiteRebuild.objects.filter(pk=1).only("last_requested_at").first()
    last_requested = state.last_requested_at if state else None
    return {
        "configured": bool(_hook_url()),
        "last_requested_at": last_requested.isoformat() if last_requested else None,
    }
