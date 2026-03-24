from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any, Callable
from uuid import uuid4


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
class ChatSession:
    session_id: str
    expires_at: datetime
    history: list[SessionMessage] = field(default_factory=list)
    metadata: SessionMetadata = field(default_factory=SessionMetadata)


class SessionStore:
    def __init__(
        self,
        ttl_minutes: int,
        now_provider: Callable[[], datetime] | None = None,
    ) -> None:
        self._ttl = timedelta(minutes=ttl_minutes)
        self._sessions: dict[str, ChatSession] = {}
        self._now_provider = now_provider or (lambda: datetime.now(UTC))

    def _now(self) -> datetime:
        return self._now_provider()

    def _expires_at(self) -> datetime:
        return self._now() + self._ttl

    def _is_expired(self, session: ChatSession) -> bool:
        return session.expires_at <= self._now()

    def cleanup_expired(self) -> None:
        expired_ids = [
            session_id
            for session_id, session in self._sessions.items()
            if self._is_expired(session)
        ]
        for session_id in expired_ids:
            self._sessions.pop(session_id, None)

    def get_or_create(self, session_id: str | None) -> tuple[ChatSession, bool]:
        self.cleanup_expired()

        if session_id:
            current = self._sessions.get(session_id)
            if current and not self._is_expired(current):
                current.expires_at = self._expires_at()
                return current, False

        new_session = ChatSession(
            session_id=str(uuid4()),
            expires_at=self._expires_at(),
        )
        self._sessions[new_session.session_id] = new_session
        return new_session, bool(session_id)

    def append_turn(
        self, session: ChatSession, user_message: str, assistant_message: str
    ) -> None:
        session.history.append(SessionMessage(role="user", content=user_message))
        session.history.append(SessionMessage(role="assistant", content=assistant_message))
        session.expires_at = self._expires_at()

    def reset(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)
