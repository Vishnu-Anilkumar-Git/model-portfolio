"""Provider abstraction so the chatbot is not tied to a local Ollama daemon.

Production uses any OpenAI-compatible endpoint (Groq by default); local
development can keep using Ollama. Both expose the same streaming interface.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)


class ChatProviderError(RuntimeError):
    """A provider failed in a way that should trigger the extractive fallback."""


@dataclass(frozen=True)
class ProviderStatus:
    name: str
    model: str
    ready: bool
    detail: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "model": self.model,
            "ready": self.ready,
            "detail": self.detail,
        }


def _groq_configured() -> bool:
    return bool(settings.LLM_API_KEY)


def _is_openai_compatible(url: str) -> bool:
    return bool(settings.LLM_API_KEY)


class BaseProvider:
    name = "base"
    model = ""

    def stream(self, messages: list[dict[str, str]]) -> Iterator[str]:
        raise NotImplementedError

    def complete(self, messages: list[dict[str, str]]) -> str:
        return "".join(self.stream(messages)).strip()


class OpenAICompatibleProvider(BaseProvider):
    """Works with Groq, OpenRouter, Baseten, OpenAI and anything else that
    implements /chat/completions."""

    def __init__(self) -> None:
        if not settings.LLM_API_KEY:
            raise ChatProviderError("No LLM_API_KEY is configured.")

        from openai import OpenAI

        self.name = "groq" if "groq.com" in settings.LLM_BASE_URL else "openai"
        self.model = settings.LLM_MODEL
        self._client = OpenAI(
            api_key=settings.LLM_API_KEY,
            base_url=settings.LLM_BASE_URL,
            timeout=settings.LLM_TIMEOUT_SECONDS,
            max_retries=1,
        )

    def stream(self, messages: list[dict[str, str]]) -> Iterator[str]:
        try:
            response = self._client.chat.completions.create(
                model=self.model,
                messages=messages,  # type: ignore[arg-type]
                temperature=settings.CHATBOT_TEMPERATURE,
                max_tokens=settings.CHATBOT_MAX_TOKENS,
                stream=True,
            )
            for chunk in response:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta
        except Exception as exc:  # provider SDK raises many concrete types
            logger.warning("OpenAI-compatible provider failed: %s", exc)
            raise ChatProviderError("The language model is unavailable.") from exc


class OllamaProvider(BaseProvider):
    name = "ollama"

    def __init__(self) -> None:
        self.model = settings.OLLAMA_MODEL
        try:
            import ollama
        except ImportError as exc:  # pragma: no cover - dependency is declared
            raise ChatProviderError("The ollama package is not installed.") from exc

        self._client = ollama.Client(host=settings.OLLAMA_HOST)

    def stream(self, messages: list[dict[str, str]]) -> Iterator[str]:
        try:
            response = self._client.chat(
                model=self.model,
                messages=messages,  # type: ignore[arg-type]
                stream=True,
                options={
                    "temperature": settings.CHATBOT_TEMPERATURE,
                    "num_predict": settings.CHATBOT_MAX_TOKENS,
                },
                keep_alive="10m",
            )
            for chunk in response:
                content = chunk.get("message", {}).get("content", "")
                if content:
                    yield content
        except Exception as exc:
            logger.warning("Ollama provider failed: %s", exc)
            raise ChatProviderError("The local Ollama model is unavailable.") from exc


def provider_status() -> ProviderStatus:
    configured = settings.CHATBOT_PROVIDER

    if configured == "extractive":
        return ProviderStatus(
            name="extractive",
            model="database extracts",
            ready=True,
            detail="Answers are composed directly from portfolio records.",
        )

    if configured in ("groq", "openai", "openai-compatible"):
        if _is_openai_compatible(settings.LLM_BASE_URL):
            return ProviderStatus(
                name="groq" if "groq.com" in settings.LLM_BASE_URL else "openai",
                model=settings.LLM_MODEL,
                ready=True,
                detail="Hosted OpenAI-compatible provider is configured.",
            )
        return ProviderStatus(
            name=configured,
            model=settings.LLM_MODEL,
            ready=False,
            detail="Set GROQ_API_KEY (or LLM_API_KEY) to enable hosted answers.",
        )

    if configured == "ollama":
        return ProviderStatus(
            name="ollama",
            model=settings.OLLAMA_MODEL,
            ready=True,
            detail="Local Ollama model; falls back to database extracts if offline.",
        )

    # auto
    if _groq_configured():
        return ProviderStatus(
            name="groq" if "groq.com" in settings.LLM_BASE_URL else "openai",
            model=settings.LLM_MODEL,
            ready=True,
            detail="GROQ_API_KEY detected; using the hosted provider.",
        )
    return ProviderStatus(
        name="ollama",
        model=settings.OLLAMA_MODEL,
        ready=True,
        detail=(
            "No hosted API key set; using local Ollama with an automatic "
            "database-extract fallback."
        ),
    )


def get_provider(force: str | None = None) -> BaseProvider | None:
    """Return a provider, or None when the extractive fallback should be used."""
    configured = (force or settings.CHATBOT_PROVIDER).strip().lower()

    if configured == "extractive":
        return None

    if configured == "auto":
        if _groq_configured():
            return OpenAICompatibleProvider()
        return OllamaProvider()

    if configured in ("groq", "openai", "openai-compatible"):
        if not _groq_configured():
            return None
        return OpenAICompatibleProvider()

    if configured == "ollama":
        return OllamaProvider()

    logger.warning("Unknown CHATBOT_PROVIDER %r; using extractive answers.", configured)
    return None
