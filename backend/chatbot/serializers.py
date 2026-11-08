from __future__ import annotations

from typing import Any

from rest_framework import serializers

MAX_MESSAGE_LENGTH = 500
MAX_TOTAL_HISTORY_CHARS = 3000


class ChatTurnSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=["user", "assistant"])
    content = serializers.CharField(max_length=MAX_MESSAGE_LENGTH)


class ChatRequestSerializer(serializers.Serializer):
    message = serializers.CharField(
        min_length=1, max_length=MAX_MESSAGE_LENGTH, trim_whitespace=True
    )
    history = ChatTurnSerializer(many=True, required=False, max_length=6)
    session_id = serializers.CharField(
        max_length=64, required=False, allow_blank=True
    )

    def validate_history(
        self, value: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        if sum(len(turn["content"]) for turn in value) > MAX_TOTAL_HISTORY_CHARS:
            raise serializers.ValidationError("Conversation history is too long.")
        return value

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        message = attrs["message"].strip()
        if not message:
            raise serializers.ValidationError({"message": "Message cannot be empty."})
        attrs["message"] = message
        return attrs
