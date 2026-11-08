from __future__ import annotations

import json
import logging
import time
from collections.abc import Iterator
from typing import Any

from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from content.models import Profile, SuggestedQuestion

from .serializers import ChatRequestSerializer
from .services.chat import (
    generate_answer,
    log_non_stream,
    prepare_chat,
    stream_answer,
)

logger = logging.getLogger(__name__)


def _sse(event: str, payload: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _history_from(data: dict[str, Any]) -> list[dict[str, str]]:
    return [
        {"role": turn["role"], "content": turn["content"]}
        for turn in data.get("history", [])
    ]


class ChatView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "chat"

    def post(self, request: Any) -> Response:
        serializer = ChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        started = time.monotonic()
        prepared = prepare_chat(
            message=data["message"],
            history=_history_from(data),
            session_id=data.get("session_id", ""),
        )
        answer, provider = generate_answer(prepared)
        latency_ms = int((time.monotonic() - started) * 1000)

        log_non_stream(prepared, answer, provider, latency_ms)

        return Response(
            {
                "answer": answer,
                "sources": prepared.sources,
                "provider": provider,
                "session_id": prepared.session_id,
                "latency_ms": latency_ms,
                "flagged": prepared.flagged,
            },
            status=status.HTTP_200_OK,
        )


class ChatStreamView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "chat"

    def perform_content_negotiation(self, request: Any, force: bool = False):
        # The response is a raw text/event-stream, not a DRF-rendered payload.
        # Negotiating against JSON keeps an `Accept: text/event-stream` request
        # from being rejected with 406 before the generator runs.
        return JSONRenderer(), "application/json"

    def post(self, request: Any) -> StreamingHttpResponse:
        serializer = ChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        prepared = prepare_chat(
            message=data["message"],
            history=_history_from(data),
            session_id=data.get("session_id", ""),
        )

        response = StreamingHttpResponse(
            self._events(prepared),
            content_type="text/event-stream; charset=utf-8",
        )
        response["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response["X-Accel-Buffering"] = "no"
        return response

    def _events(self, prepared: Any) -> Iterator[str]:
        started = time.monotonic()
        yield _sse(
            "meta",
            {
                "sources": prepared.sources,
                "session_id": prepared.session_id,
                "flagged": prepared.flagged,
            },
        )

        outcome: dict[str, Any] = {}
        try:
            for chunk in stream_answer(prepared, outcome):
                yield _sse("delta", {"text": chunk})
        except GeneratorExit:
            logger.info("Chat stream closed by the client early.")
            raise
        except Exception:
            logger.exception("Chat stream failed")
            yield _sse(
                "error",
                {"message": "The assistant hit an error. Please try again."},
            )
            return

        yield _sse(
            "done",
            {
                "provider": outcome.get("provider", "extractive"),
                "latency_ms": int((time.monotonic() - started) * 1000),
                "flagged": prepared.flagged,
            },
        )


class ChatSuggestionsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request: Any) -> Response:
        profile = Profile.load()
        suggestions = [
            question.text
            for question in SuggestedQuestion.objects.filter(visible=True).order_by(
                "order", "pk"
            )
        ]
        return Response(
            {
                "greeting": profile.chatbot_greeting,
                "suggestions": suggestions,
                "time": timezone.now().isoformat(),
            }
        )
