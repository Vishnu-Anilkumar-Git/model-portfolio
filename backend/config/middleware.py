"""Small, dependency-free security middleware.

The public React site is served by a separate host, so its CSP belongs there;
these headers protect this service, uploaded media and the Django admin that
ships with it.
"""

from __future__ import annotations

import logging
from collections.abc import Callable

from django.core.cache import cache
from django.http import HttpRequest, HttpResponse

logger = logging.getLogger("content.security")

DEFAULT_CSP = (
    "default-src 'self'; "
    "img-src 'self' data: blob:; "
    "media-src 'self'; "
    "style-src 'self' 'unsafe-inline'; "
    "script-src 'self' 'unsafe-inline'; "
    "font-src 'self' data:; "
    "connect-src 'self'; "
    "object-src 'none'; "
    "base-uri 'self'; "
    "form-action 'self'; "
    "frame-ancestors 'none'"
)

MEDIA_CSP = "default-src 'none'; img-src 'self' data:; sandbox"

ADMIN_LOGIN_PATHS = {"/admin/login/", "/admin/login"}
ADMIN_LOGIN_LIMIT = 10
ADMIN_LOGIN_WINDOW_SECONDS = 300


class SecurityHeadersMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        response = self.get_response(request)

        if request.path.startswith("/media/"):
            # Never let an uploaded document execute as a page on the API origin.
            response.headers.setdefault("Content-Security-Policy", MEDIA_CSP)
            response.headers.setdefault(
                "Cross-Origin-Resource-Policy", "cross-origin"
            )
        else:
            # Do not overwrite a more specific policy set elsewhere (e.g. a proxy).
            response.headers.setdefault("Content-Security-Policy", DEFAULT_CSP)

        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
        )
        response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        response.headers.setdefault("X-Permitted-Cross-Domain-Policies", "none")

        if request.path.startswith("/api/"):
            response.headers.setdefault("Cache-Control", "no-store, max-age=0")

        return response


class AdminLoginThrottleMiddleware:
    """Rate-limit the Django admin sign-in form, which Django does not throttle.

    The custom admin panel already goes through the throttled JWT endpoint; this
    closes the second, older door. IP addresses are read from ``REMOTE_ADDR``
    because trusting ``X-Forwarded-For`` here would let an attacker rotate the
    header to bypass the limit.
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        if request.method == "POST" and request.path.rstrip("/") + "/" in ADMIN_LOGIN_PATHS:
            if self._is_limited(request):
                logger.warning(
                    "admin_login_blocked ip=%s", request.META.get("REMOTE_ADDR", "?")
                )
                return HttpResponse(
                    "Too many sign-in attempts. Try again in a few minutes.",
                    status=429,
                    content_type="text/plain; charset=utf-8",
                )
        return self.get_response(request)

    def _is_limited(self, request: HttpRequest) -> bool:
        ip = request.META.get("REMOTE_ADDR", "unknown")
        key = f"admin-login:{ip}"
        try:
            attempts = cache.get(key, 0)
            if attempts >= ADMIN_LOGIN_LIMIT:
                return True
            if attempts == 0:
                cache.set(key, 1, ADMIN_LOGIN_WINDOW_SECONDS)
            else:
                cache.incr(key)
        except Exception:  # a cache outage must not lock the owner out
            logger.warning("admin_login_throttle_unavailable")
        return False
