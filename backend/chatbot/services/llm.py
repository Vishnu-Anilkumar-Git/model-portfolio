import json
import logging
from typing import Any

import ollama

from .prompts import SYSTEM_PROMPT

logger = logging.getLogger(__name__)

OLLAMA_MODEL = "llama3.2:3b"


def generate_response(message: str, context: dict[str, Any]) -> str:
    """Generate a grounded response using the local Ollama model."""

    context_str = (
        json.dumps(context, indent=2, ensure_ascii=False)
        if context
        else "No relevant context available."
    )

    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT,
        },
        {
            "role": "system",
            "content": f"Verified Portfolio Context:\n{context_str}",
        },
        {
            "role": "user",
            "content": message,
        },
    ]

    try:
        chat_fn = getattr(ollama, "chat")
        response = chat_fn(
            model=OLLAMA_MODEL,
            messages=messages,
            options={
                "temperature": 0,
            },
        )

        answer = response["message"]["content"]

        if not answer:
            return "I couldn't generate a response right now."

        return answer.strip()

    except Exception as exc:
        logger.exception("Ollama request failed: %s", exc)
        return "I encountered an error while processing your request."