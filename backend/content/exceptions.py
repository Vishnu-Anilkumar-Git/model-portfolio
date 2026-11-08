from typing import Any

from rest_framework.exceptions import Throttled
from rest_framework.response import Response
from rest_framework.views import exception_handler


def api_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    """Keep field validation errors, collapse everything else to {"error": ...}."""
    response = exception_handler(exc, context)
    if response is None:
        return None

    if isinstance(exc, Throttled):
        retry_after = int(exc.wait) if exc.wait else 60
        response.data = {
            "error": "Too many requests. Please wait a moment and try again.",
            "retry_after": retry_after,
        }
        response["Retry-After"] = str(retry_after)
        return response

    data = response.data
    if isinstance(data, dict) and set(data.keys()) == {"detail"}:
        response.data = {"error": str(data["detail"])}

    return response
