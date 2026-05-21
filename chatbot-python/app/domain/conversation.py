from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class SessionMessage:
    role: str
    content: str


@dataclass
class SessionMetadata:
    known_values: dict[str, Any] = field(default_factory=dict)
    last_missing_fields: list[str] = field(default_factory=list)
    last_recommendation: dict[str, Any] | None = None
    catalogs_loaded: bool = False

    def to_prompt_payload(self) -> dict[str, Any]:
        recommendation_summary = None
        if self.last_recommendation:
            recommendation_summary = {
                "nivelConfianza": self.last_recommendation.get("nivelConfianza"),
                "mensaje": self.last_recommendation.get("mensaje"),
                "totalResultados": len(self.last_recommendation.get("resultados", [])),
            }
        return {
            "catalogsLoaded": self.catalogs_loaded,
            "knownValues": self.known_values,
            "lastMissingFields": self.last_missing_fields,
            "lastRecommendationSummary": recommendation_summary,
        }


@dataclass
class ConversationState:
    metadata: SessionMetadata = field(default_factory=SessionMetadata)
    history: list[SessionMessage] = field(default_factory=list)


@dataclass
class ChatSession:
    session_id: str
    expires_at: datetime
    history: list[SessionMessage] = field(default_factory=list)
    metadata: SessionMetadata = field(default_factory=SessionMetadata)
