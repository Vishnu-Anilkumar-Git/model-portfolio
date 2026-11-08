"""Chat orchestration: guardrail -> retrieval -> provider -> grounded fallback."""

from __future__ import annotations

import logging
import re
import time
import uuid
from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import Any

from content.models import ChatLog, Project

from .prompts import build_messages
from .providers import ChatProviderError, get_provider
from .retrieval import Document, retrieve_context, tokenize

logger = logging.getLogger(__name__)

UNKNOWN_ANSWER = (
    "I don't have that information in Vishnu's portfolio. Try asking about his "
    "projects, skills, certifications, education or how to contact him."
)

REFUSAL_ANSWER = (
    "I can't help with that. I can only answer questions about Vishnu's "
    "background, projects, skills and experience."
)

GREETING_ANSWER = (
    "Hi — I'm Vishnu's portfolio assistant. Ask me about his projects, skills, "
    "certifications, education or how to get in touch."
)

ATTACK_PATTERNS = [
    re.compile(
        r"ignore\s+(all\s+|any\s+)?(previous|prior|above|earlier)\s+"
        r"(instructions|rules|prompts|messages)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(reveal|show|print|repeat|expose|leak|tell\s+me)\b.{0,40}"
        r"(system\s+prompt|prompt\s+you|hidden\s+(rules|instructions)|"
        r"initial\s+instructions|internal\s+instructions)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(what|which|show|give|tell)\b.{0,30}(api\s+key|secret\s+key|"
        r"environment\s+variables?|server\s+config)",
        re.IGNORECASE,
    ),
    re.compile(r"act\s+as\s+(the\s+)?(developer|admin|system|root)", re.IGNORECASE),
    re.compile(r"(jailbreak|DAN\s+mode|developer\s+mode\s+enabled)", re.IGNORECASE),
    re.compile(r"ignore\s+the\s+portfolio", re.IGNORECASE),
    re.compile(
        r"(forget|disregard|override|bypass)\s+(all\s+|any\s+|your\s+|the\s+){1,2}"
        r"(rules|instructions|guidelines|restrictions|prompt)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(you\s+are|you're|from\s+now\s+on)\b.{0,30}"
        r"(unrestricted|jailbroken|free\s+from\s+(all\s+)?rules|not\s+bound)",
        re.IGNORECASE,
    ),
    re.compile(
        r"repeat\s+(everything|the\s+text|the\s+words|your\s+instructions)"
        r"\s+(above|before|you\s+were\s+given)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(translate|encode|decode|summari[sz]e|output)\s+(your|the)\s+"
        r"(system\s+)?(prompt|instructions|rules)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(what|which)\s+(were|are)\s+you\s+(told|instructed|programmed)",
        re.IGNORECASE,
    ),
    re.compile(
        r"pretend\s+(to\s+be|you\s+are)\s+(the\s+)?"
        r"(developer|admin|system|root|unrestricted)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(decode|base64)\b.{0,40}(and\s+)?(follow|execute|obey|ignore)",
        re.IGNORECASE,
    ),
]

SOCIAL_TOKENS = {
    "hi", "hello", "hey", "thanks", "thank", "you", "good", "morning",
    "afternoon", "evening", "there", "bye", "ok", "okay",
}

PROJECT_LIST_INTENTS = {
    "completed": {"completed", "complete", "shipped", "finished", "done"},
    "ongoing": {"ongoing", "current", "active", "developing", "working"},
    "upcoming": {"upcoming", "planned", "future", "next", "roadmap"},
}


def is_prompt_attack(message: str) -> bool:
    return any(pattern.search(message) for pattern in ATTACK_PATTERNS)


def history_is_hostile(history: list[dict[str, str]]) -> bool:
    """Client-supplied history is untrusted and must not smuggle instructions."""
    return any(is_prompt_attack(turn.get("content", "")) for turn in history)


def _social_reply(message: str) -> str | None:
    tokens = set(tokenize(message))
    lowered = message.lower().strip(" !?.")
    if tokens and tokens <= SOCIAL_TOKENS:
        if tokens & {"thanks", "thank"}:
            return "You're welcome. Anything else you'd like to know about Vishnu?"
        if tokens & {"bye"}:
            return "Thanks for stopping by."
        return GREETING_ANSWER
    if lowered in {"who are you", "what are you", "what is this"}:
        return GREETING_ANSWER
    return None


@dataclass
class PreparedChat:
    message: str
    session_id: str
    documents: list[Document] = field(default_factory=list)
    sources: list[dict[str, str]] = field(default_factory=list)
    messages: list[dict[str, str]] = field(default_factory=list)
    flagged: bool = False
    direct_answer: str | None = None

    @property
    def has_context(self) -> bool:
        return bool(self.documents)


def prepare_chat(
    message: str,
    history: list[dict[str, str]] | None = None,
    session_id: str = "",
) -> PreparedChat:
    session = re.sub(r"[^a-zA-Z0-9_-]", "", session_id)[:64] or uuid.uuid4().hex
    prepared = PreparedChat(message=message, session_id=session)

    if is_prompt_attack(message) or history_is_hostile(history or []):
        prepared.flagged = True
        prepared.direct_answer = REFUSAL_ANSWER
        return prepared

    social = _social_reply(message)
    if social:
        prepared.direct_answer = social
        return prepared

    result = retrieve_context(message)
    if not result.has_match:
        prepared.direct_answer = UNKNOWN_ANSWER
        return prepared

    prepared.documents = result.documents
    prepared.sources = result.sources
    prepared.messages = build_messages(message, result.documents, history or [])
    return prepared


def _first_sentences(text: str, count: int = 2) -> str:
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    return " ".join(sentences[:count]).strip()


def _status_list_answer(status: str, documents: list[Document]) -> str | None:
    matching = [doc for doc in documents if doc.kind == f"project_{status}"]
    if not matching:
        return None
    titles = [doc.label for doc in matching[:6]]
    if len(titles) == 1:
        return f"Vishnu has one {status} project: {titles[0]}."
    return (
        f"Vishnu's {status} projects are: "
        + ", ".join(titles[:-1])
        + f" and {titles[-1]}."
    )


def extractive_answer(message: str, documents: list[Document]) -> str:
    """Deterministic answer composed from retrieved rows.

    This is the production safety net when no model is configured or the model
    is unreachable, so the widget never shows a generic 500.
    """
    if not documents:
        return UNKNOWN_ANSWER

    query_tokens = set(tokenize(message))

    for status, terms in PROJECT_LIST_INTENTS.items():
        if query_tokens & terms:
            answer = _status_list_answer(status, documents)
            if answer:
                return answer

    # Generic "what projects has he built?" question: summarise every status
    # from the database rather than returning a single retrieved card.
    if query_tokens & {"project"} and not any(
        query_tokens & terms for terms in PROJECT_LIST_INTENTS.values()
    ):
        projects = list(Project.objects.filter(visible=True).order_by("order", "pk"))
        if projects:
            lines = []
            for status, label in (
                (Project.Status.COMPLETED, "Completed"),
                (Project.Status.ONGOING, "Ongoing"),
                (Project.Status.UPCOMING, "Upcoming"),
            ):
                titles = [p.title for p in projects if p.status == status]
                if not titles:
                    continue
                shown = ", ".join(titles[:4])
                suffix = f" and {len(titles) - 4} more" if len(titles) > 4 else ""
                lines.append(f"{label} ({len(titles)}): {shown}{suffix}")
            return "Vishnu's projects by status —\n" + "\n".join(lines)

    top = documents[0]

    if top.kind == "profile" and top.answer:
        return top.answer
    if top.kind == "faq" and top.answer:
        return top.answer
    if top.kind == "certification" and top.answer:
        return top.answer
    if top.kind == "contact":
        emails = re.findall(r"[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}", top.text)
        if emails:
            return (
                f"You can reach Vishnu at {emails[0]}. His GitHub and LinkedIn "
                "links are on the contact section of the portfolio."
            )
    if top.kind.startswith("project") and top.answer:
        tech = ""
        tech_match = re.search(r"Technologies: ([^.]+)\.", top.text)
        if tech_match:
            tech = f" It uses {tech_match.group(1)}."
        status = top.kind.replace("project_", "")
        article = "an" if status in {"ongoing", "upcoming"} else "a"
        return f"{top.label} is {article} {status} project. {top.answer}{tech}"

    if top.kind == "skills":
        skill_docs = [doc for doc in documents if doc.kind == "skills"]
        if (query_tokens == {"skill"} or "strongest" in query_tokens) and len(
            skill_docs
        ) > 1:
            areas = [
                doc.label.removeprefix("Skills — ").strip()
                for doc in skill_docs
            ]
            return (
                f"Vishnu's skills span {len(areas)} areas: "
                + ", ".join(areas[:-1])
                + f" and {areas[-1]}. Ask about any area for the specific tools."
            )
        if top.answer:
            return top.answer
        body = top.text.split(":", 1)[-1].strip()
        return _first_sentences(body, 1)

    return _first_sentences(top.text, 2)


def _sanitize(text: str) -> str:
    cleaned = text.strip()
    if not cleaned:
        return ""
    # Never echo the system prompt or the context header.
    lowered = cleaned.lower()
    leaked_markers = (
        "verified portfolio context",
        "core rules",
        "system prompt",
        "you are vishnu's professional portfolio ai assistant",
    )
    if any(marker in lowered for marker in leaked_markers):
        return REFUSAL_ANSWER
    return cleaned[:1500]


def generate_answer(prepared: PreparedChat) -> tuple[str, str]:
    if prepared.direct_answer:
        return prepared.direct_answer, "guard" if prepared.flagged else "direct"

    if not prepared.has_context:
        return UNKNOWN_ANSWER, "extractive"

    try:
        provider = get_provider()
    except ChatProviderError:
        provider = None

    if provider is None:
        return extractive_answer(prepared.message, prepared.documents), "extractive"

    try:
        answer = _sanitize(provider.complete(prepared.messages))
        if not answer:
            raise ChatProviderError("Empty completion.")
        return answer, provider.name
    except ChatProviderError:
        return extractive_answer(prepared.message, prepared.documents), "extractive"


def stream_answer(
    prepared: PreparedChat, outcome: dict[str, Any]
) -> Iterator[str]:
    """Yield answer chunks and record the final outcome for SSE metadata/logging."""
    start = time.monotonic()
    answer_parts: list[str] = []
    outcome["provider"] = "extractive"

    if prepared.direct_answer:
        outcome["provider"] = "guard" if prepared.flagged else "direct"
        answer_parts.append(prepared.direct_answer)
        yield prepared.direct_answer
        outcome["answer"] = prepared.direct_answer
    elif not prepared.has_context:
        answer_parts.append(UNKNOWN_ANSWER)
        yield UNKNOWN_ANSWER
        outcome["answer"] = UNKNOWN_ANSWER
    else:
        provider = None
        try:
            provider = get_provider()
        except ChatProviderError:
            provider = None

        if provider is None:
            text = extractive_answer(prepared.message, prepared.documents)
            answer_parts.append(text)
            yield text
            outcome["provider"] = "extractive"
        else:
            produced = False
            dropped = False
            try:
                for chunk in provider.stream(prepared.messages):
                    if not chunk:
                        continue
                    produced = True
                    outcome["provider"] = provider.name
                    answer_parts.append(chunk)
                    yield chunk
            except ChatProviderError:
                dropped = produced

            if not produced:
                # No tokens reached the visitor: answer from the database instead.
                text = extractive_answer(prepared.message, prepared.documents)
                answer_parts = [text]
                outcome["provider"] = "extractive"
                yield text
            elif dropped:
                note = "\n\nThe model connection dropped. Please try again."
                answer_parts.append(note)
                yield note

        outcome["answer"] = "".join(answer_parts)

    outcome["latency_ms"] = int((time.monotonic() - start) * 1000)
    _log_chat(prepared, outcome)


def _log_chat(prepared: PreparedChat, outcome: dict[str, Any]) -> None:
    try:
        ChatLog.objects.create(
            question=prepared.message[:1000],
            answer=str(outcome.get("answer", ""))[:4000],
            sources=prepared.sources,
            provider=str(outcome.get("provider", ""))[:40],
            latency_ms=int(outcome.get("latency_ms", 0)),
            session_id=prepared.session_id,
            flagged=prepared.flagged,
        )
    except Exception as exc:  # logging must never break a reply
        logger.warning("Could not write chat log: %s", exc)


def log_non_stream(
    prepared: PreparedChat,
    answer: str,
    provider: str,
    latency_ms: int,
) -> None:
    _log_chat(
        prepared,
        {"answer": answer, "provider": provider, "latency_ms": latency_ms},
    )
