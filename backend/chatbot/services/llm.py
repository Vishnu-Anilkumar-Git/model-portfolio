import json
from django.conf import settings
from openai import OpenAI

from .prompts import SYSTEM_PROMPT

def generate_response(message: str, context: dict) -> str:
    # Use OpenAI provider
    api_key = getattr(settings, 'OPENAI_API_KEY', None)
    if not api_key:
        return "I am currently undergoing maintenance. (OpenAI API key not configured)"

    client = OpenAI(api_key=api_key)

    context_str = json.dumps(context, indent=2) if context else "No relevant context available."
    
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "system", "content": f"Verified Portfolio Context:\n{context_str}"},
        {"role": "user", "content": message}
    ]

    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=messages,
            temperature=0.0,
            max_tokens=256,
            timeout=10.0
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        # Do not expose full stack traces
        return "I encountered an error while processing your request."
