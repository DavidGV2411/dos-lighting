from contextlib import asynccontextmanager

from fastapi.testclient import TestClient

from app.main import create_app


class DummyBackendClient:
    async def healthcheck(self):
        return True

    async def aclose(self):
        return None


class DummyOpenAIClient:
    async def aclose(self):
        return None


class DummyService:
    async def handle_message(self, *, session_id, user_message, client_key):
        return {
            "sessionId": session_id or "new-session",
            "replyText": f"Eco: {user_message}",
            "quickReplies": [],
            "missingFields": [],
            "recommendation": None,
            "resetSession": False,
        }


def build_test_app():
    app = create_app()

    @asynccontextmanager
    async def lifespan(_app):
        _app.state.chat_service = DummyService()
        _app.state.backend_client = DummyBackendClient()
        _app.state.openai_client = DummyOpenAIClient()
        _app.state.settings = type(
            "Settings",
            (),
            {"openai_configured": True},
        )()
        yield

    app.router.lifespan_context = lifespan
    return app


def test_health_endpoint_reports_chat_dependencies():
    with TestClient(build_test_app()) as client:
        response = client.get("/api/chat/health")

    assert response.status_code == 200
    assert response.json()["status"] == "UP"
    assert response.json()["openaiConfigured"] is True


def test_message_endpoint_returns_normalized_shape():
    with TestClient(build_test_app()) as client:
        response = client.post("/api/chat/message", json={"message": "Hola bot"})

    assert response.status_code == 200
    assert response.json()["replyText"] == "Eco: Hola bot"
