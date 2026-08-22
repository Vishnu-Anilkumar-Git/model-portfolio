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
        json.dumps(
            context,
            indent=2,
            ensure_ascii=False,
        )
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
            "content": (
                "VERIFIED PORTFOLIO CONTEXT:\n"
                f"{context_str}\n\n"
                "IMPORTANT: Treat the above data as the only authoritative "
                "source for claims about Vishnu."
            ),
        },
        {
            "role": "user",
            "content": message,
        },
    ]

    try:
        response = ollama.chat(
            model=OLLAMA_MODEL,
            messages=messages,
            options={
                "temperature": 0,
                "num_predict": 350,
            },
            keep_alive="10m",
        )

        answer = response["message"]["content"]

        if not answer:
            return "I couldn't generate a response right now."

        return answer.strip()

    except Exception as exc:
        logger.exception("Ollama request failed: %s", exc)
        return "I encountered an error while processing your request."