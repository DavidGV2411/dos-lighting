from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

import pytest

from app.chat_service import ChatService
from app.openai_client import OpenAIServiceError
from app.rate_limiter import RateLimiter
from app.session_store import SessionStore
from app.tools import ToolRunner


@dataclass
class FakeItem:
    type: str
    name: str | None = None
    arguments: str | None = None
    call_id: str | None = None
    content: list[dict] | None = None

    def model_dump(self, exclude_none: bool = False):
        payload = {
            "type": self.type,
            "name": self.name,
            "arguments": self.arguments,
            "call_id": self.call_id,
            "content": self.content,
        }
        if exclude_none:
            return {key: value for key, value in payload.items() if value is not None}
        return payload


@dataclass
class FakeResponse:
    output: list[FakeItem]
    output_text: str = ""


class FakeOpenAIClient:
    def __init__(self, responses=None, error: Exception | None = None):
        self.responses = list(responses or [])
        self.error = error
        self.calls: list[list[dict]] = []

    async def create_response(self, *, input_items, tools):
        self.calls.append(input_items)
        if self.error:
            raise self.error
        return self.responses.pop(0)


class FakeBackendClient:
    def __init__(self):
        self.calls: list[tuple[str, dict | None]] = []

    async def get_survey_catalogs(self):
        self.calls.append(("get_survey_catalogs", None))
        return {
            "marcas": [{"id": 1, "nombre": "Chevrolet"}],
            "modelos": [
                {
                    "id": 2,
                    "nombre": "Onix",
                    "idMarca": 1,
                    "anioDesde": 2018,
                    "anioHasta": None,
                }
            ],
            "perfilesUso": {
                "horario_manejo": [
                    {
                        "id": 3,
                        "categoria": "horario_manejo",
                        "valor": "nocturno",
                        "descripcion": "Mayormente de noche",
                    }
                ],
                "zona_manejo": [
                    {
                        "id": 4,
                        "categoria": "zona_manejo",
                        "valor": "carretera",
                        "descripcion": "Principalmente carretera",
                    }
                ],
                "uso_vehiculo": [
                    {
                        "id": 5,
                        "categoria": "uso_vehiculo",
                        "valor": "trabajo",
                        "descripcion": "Uso laboral frecuente",
                    }
                ],
            },
            "tiposPolarizado": [
                {"id": 6, "codigo": "35%", "descripcion": "35% medio"}
            ],
        }

    async def get_optical_system_decision(self, modelo_id: int, anio_vehiculo: int):
        self.calls.append(
            (
                "get_optical_system_decision",
                {"modelo_id": modelo_id, "anio_vehiculo": anio_vehiculo},
            )
        )
        return {
            "modeloId": modelo_id,
            "anioVehiculo": anio_vehiculo,
            "requiresQuestion": True,
            "resolvedTipoSistemaOptico": None,
            "options": ["lupa_proyector", "reflector_abierto"],
        }

    async def resolve_led_recommendation(self, payload):
        self.calls.append(("resolve_led_recommendation", payload))
        return {
            "consultaId": 10,
            "nivelConfianza": "alta",
            "mensaje": "Recomendacion lista.",
            "resultados": [
                {
                    "posicionLuz": "cruce",
                    "productos": [
                        {
                            "rank": 1,
                            "productoId": 3,
                            "modelo": "Nebula X",
                            "gama": "premium",
                            "casquilloCodigo": "H4",
                            "puntajeTotal": 18,
                            "motivos": ["Mayor visibilidad nocturna"],
                        }
                    ],
                }
            ],
        }

    async def get_gamas_luz(self):
        self.calls.append(("get_gamas_luz", None))
        return {"gamas": [{"id": 1, "nombre": "premium"}]}

    async def get_product_detail(self, producto_id: int):
        self.calls.append(("get_product_detail", {"producto_id": producto_id}))
        return {"id": producto_id, "modelo": "Nebula X"}


def build_service(openai_client, backend_client=None):
    backend = backend_client or FakeBackendClient()
    return ChatService(
        openai_client=openai_client,
        tool_runner=ToolRunner(backend),
        session_store=SessionStore(
            ttl_minutes=30,
            now_provider=lambda: datetime(2026, 3, 18, 19, 0, tzinfo=UTC),
        ),
        rate_limiter=RateLimiter(max_requests=20, window_seconds=60),
        max_tool_rounds=4,
    ), backend


@pytest.mark.asyncio
async def test_creates_session_when_no_session_id_is_sent():
    service, _ = build_service(
        FakeOpenAIClient(
            responses=[FakeResponse(output=[], output_text="Hola, cuentame de tu vehiculo.")]
        )
    )

    response = await service.handle_message(
        session_id=None,
        user_message="Necesito una recomendacion",
        client_key="127.0.0.1",
    )

    assert response.session_id
    assert response.reply_text == "Hola, cuentame de tu vehiculo."
    assert response.reset_session is False
    assert response.quick_replies


@pytest.mark.asyncio
async def test_reuses_previous_conversation_history_in_follow_up_turn():
    openai_client = FakeOpenAIClient(
        responses=[
            FakeResponse(output=[], output_text="Hola, cual es la marca?"),
            FakeResponse(output=[], output_text="Perfecto, ahora dime el modelo."),
        ]
    )
    service, _ = build_service(openai_client)

    first = await service.handle_message(
        session_id=None,
        user_message="Quiero luces",
        client_key="127.0.0.1",
    )
    await service.handle_message(
        session_id=first.session_id,
        user_message="Es Chevrolet",
        client_key="127.0.0.1",
    )

    second_call_input = openai_client.calls[1]
    contents = [
        item.get("content")
        for item in second_call_input
        if item.get("role") in {"user", "assistant"}
    ]

    assert "Quiero luces" in contents
    assert "Hola, cual es la marca?" in contents
    assert "Es Chevrolet" in contents


@pytest.mark.asyncio
async def test_executes_catalog_tool_when_model_requests_it():
    openai_client = FakeOpenAIClient(
        responses=[
            FakeResponse(
                output=[
                    FakeItem(
                        type="function_call",
                        name="get_survey_catalogs",
                        arguments="{}",
                        call_id="call_1",
                    )
                ]
            ),
            FakeResponse(
                output=[],
                output_text="Te ayudo. Ya tengo las opciones del catalogo.",
            ),
        ]
    )
    service, backend = build_service(openai_client)

    response = await service.handle_message(
        session_id=None,
        user_message="Ayudame a elegir luces",
        client_key="127.0.0.1",
    )

    assert response.reply_text == "Te ayudo. Ya tengo las opciones del catalogo."
    assert ("get_survey_catalogs", None) in backend.calls


@pytest.mark.asyncio
async def test_executes_optical_decision_tool_when_requested():
    openai_client = FakeOpenAIClient(
        responses=[
            FakeResponse(
                output=[
                    FakeItem(
                        type="function_call",
                        name="get_optical_system_decision",
                        arguments='{"modelo_id": 7, "anio_vehiculo": 2019}',
                        call_id="call_2",
                    )
                ]
            ),
            FakeResponse(
                output=[],
                output_text="Para ese modelo necesito confirmar si tus faros tienen lupa o proyector.",
            ),
        ]
    )
    service, backend = build_service(openai_client)

    response = await service.handle_message(
        session_id=None,
        user_message="Es un Onix 2019",
        client_key="127.0.0.1",
    )

    assert response.missing_fields == ["tipoSistemaOpticoId"]
    assert (
        "get_optical_system_decision",
        {"modelo_id": 7, "anio_vehiculo": 2019},
    ) in backend.calls


@pytest.mark.asyncio
async def test_returns_recommendation_only_when_tool_result_exists():
    openai_client = FakeOpenAIClient(
        responses=[
            FakeResponse(
                output=[
                    FakeItem(
                        type="function_call",
                        name="resolve_led_recommendation",
                        arguments='{"marca_id":1,"modelo_id":2,"anio_vehiculo":2019,"horario_manejo_perfil_id":3,"zona_manejo_perfil_id":4,"uso_vehiculo_perfil_id":5,"tipo_polarizado_id":6,"tipo_sistema_optico_id":1}',
                        call_id="call_3",
                    )
                ]
            ),
            FakeResponse(
                output=[],
                output_text="Ya tengo una recomendacion premium para tu carro.",
            ),
        ]
    )
    service, backend = build_service(openai_client)

    response = await service.handle_message(
        session_id=None,
        user_message="Dame la recomendacion completa",
        client_key="127.0.0.1",
    )

    assert response.recommendation is not None
    assert response.recommendation["nivelConfianza"] == "alta"
    assert any(name == "resolve_led_recommendation" for name, _ in backend.calls)


@pytest.mark.asyncio
async def test_falls_back_to_guided_mode_when_openai_fails():
    service, _ = build_service(
        FakeOpenAIClient(error=OpenAIServiceError("Fallo OpenAI"))
    )

    response = await service.handle_message(
        session_id=None,
        user_message="Hola",
        client_key="127.0.0.1",
    )

    assert "marca" in response.reply_text.lower()
    assert "Chevrolet" in response.quick_replies


@pytest.mark.asyncio
async def test_uses_fallback_when_api_key_is_missing():
    service, _ = build_service(openai_client=None)

    response = await service.handle_message(
        session_id=None,
        user_message="Hola",
        client_key="127.0.0.1",
    )

    assert response.session_id
    assert "marca" in response.reply_text.lower()
    assert "Chevrolet" in response.quick_replies


@pytest.mark.asyncio
async def test_fallback_can_explain_gamas_without_openai():
    service, backend = build_service(openai_client=None)

    response = await service.handle_message(
        session_id=None,
        user_message="Que significa gama premium?",
        client_key="127.0.0.1",
    )

    assert "gamas activas" in response.reply_text.lower()
    assert ("get_gamas_luz", None) in backend.calls
