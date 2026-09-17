from typing import Any

from openai import OpenAI

from app.core.config import settings


def is_openai_configured() -> bool:
    return bool(settings.openai_api_key.strip()) and not settings.conversation_use_local


def call_openai_json_chat(
    messages: list[dict[str, str]], schema: dict[str, Any], schema_name: str
) -> str:
    # Credentials stay on the backend; no request/response bodies are logged here.
    with OpenAI(api_key=settings.openai_api_key, timeout=25, max_retries=0) as client:
        response = client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            store=False,
            response_format={
                "type": "json_schema",
                "json_schema": {"name": schema_name, "strict": True, "schema": schema},
            },
        )
        return response.choices[0].message.content or "{}"
