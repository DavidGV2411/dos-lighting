from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from app.backend_client import BackendClient, BackendServiceError

FIELD_NAME_MAP = {
    "marcaId": "marcaId",
    "modeloId": "modeloId",
    "anioVehiculo": "anioVehiculo",
    "horarioManejoPerfilId": "horarioManejoPerfilId",
    "zonaManejoPerfilId": "zonaManejoPerfilId",
    "usoVehiculoPerfilId": "usoVehiculoPerfilId",
    "tipoPolarizadoId": "tipoPolarizadoId",
    "tipoSistemaOpticoId": "tipoSistemaOpticoId",
}

TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "type": "function",
        "name": "get_survey_catalogs",
        "description": (
            "Obtiene las marcas, modelos, perfiles de uso y niveles de polarizado activos. "
            "Usa esta herramienta cuando necesites convertir nombres mencionados por el usuario en IDs reales "
            "o explicar las opciones disponibles dentro del formulario."
        ),
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "get_optical_system_decision",
        "description": (
            "Consulta si para un modelo y anio especificos el sistema puede resolver automaticamente "
            "el tipo de sistema optico o si debes preguntar al usuario si tiene lupa/proyector."
        ),
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {
                "modelo_id": {
                    "type": "integer",
                    "description": "ID real del modelo_vehiculo.",
                },
                "anio_vehiculo": {
                    "type": "integer",
                    "description": "Anio del vehiculo, por ejemplo 2019.",
                },
            },
            "required": ["modelo_id", "anio_vehiculo"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "resolve_led_recommendation",
        "description": (
            "Resuelve la recomendacion final de luces LED. "
            "Solo debe llamarse cuando ya tengas todos los IDs y el anio del vehiculo."
        ),
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {
                "marca_id": {"type": "integer"},
                "modelo_id": {"type": "integer"},
                "anio_vehiculo": {"type": "integer"},
                "horario_manejo_perfil_id": {"type": "integer"},
                "zona_manejo_perfil_id": {"type": "integer"},
                "uso_vehiculo_perfil_id": {"type": "integer"},
                "tipo_polarizado_id": {"type": "integer"},
                "tipo_sistema_optico_id": {"type": ["integer", "null"]},
            },
            "required": [
                "marca_id",
                "modelo_id",
                "anio_vehiculo",
                "horario_manejo_perfil_id",
                "zona_manejo_perfil_id",
                "uso_vehiculo_perfil_id",
                "tipo_polarizado_id",
                "tipo_sistema_optico_id",
            ],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "get_gamas_luz",
        "description": (
            "Explica las gamas de luz disponibles y sus rangos de potencia. "
            "Usa esta herramienta cuando el usuario pregunte por diferencias entre gamas."
        ),
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "get_product_detail",
        "description": (
            "Obtiene el detalle real de un producto LED recomendado por su ID. "
            "Usa esta herramienta cuando el usuario pida mas informacion de un producto concreto."
        ),
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {
                "producto_id": {
                    "type": "integer",
                    "description": "ID real del producto_led.",
                }
            },
            "required": ["producto_id"],
            "additionalProperties": False,
        },
    },
]


@dataclass
class ToolContextUpdate:
    known_values: dict[str, Any] = field(default_factory=dict)
    last_missing_fields: list[str] = field(default_factory=list)
    last_recommendation: dict[str, Any] | None = None
    catalogs_loaded: bool = False


@dataclass
class ToolExecutionResult:
    output_text: str
    context: ToolContextUpdate = field(default_factory=ToolContextUpdate)


def _json_output(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False)


def _extract_missing_fields(payload: dict[str, Any]) -> list[str]:
    details = payload.get("details") or payload.get("error", {}).get("details") or []
    missing_fields: list[str] = []

    for detail in details:
        field = detail.get("field")
        if not field:
            continue
        field_name = str(field).split(".")[-1]
        mapped = FIELD_NAME_MAP.get(field_name)
        if mapped and mapped not in missing_fields:
            missing_fields.append(mapped)

    message = str(payload.get("message") or "").lower()
    if "lupa/proyector" in message and "tipoSistemaOpticoId" not in missing_fields:
        missing_fields.append("tipoSistemaOpticoId")

    return missing_fields


class ToolRunner:
    def __init__(self, backend_client: BackendClient) -> None:
        self._backend_client = backend_client

    @property
    def definitions(self) -> list[dict[str, Any]]:
        return TOOL_DEFINITIONS

    async def execute(self, name: str, arguments: dict[str, Any]) -> ToolExecutionResult:
        if name == "get_survey_catalogs":
            payload = await self._backend_client.get_survey_catalogs()
            return ToolExecutionResult(
                output_text=_json_output(payload),
                context=ToolContextUpdate(catalogs_loaded=True),
            )

        if name == "get_optical_system_decision":
            payload = await self._backend_client.get_optical_system_decision(
                int(arguments["modelo_id"]),
                int(arguments["anio_vehiculo"]),
            )
            missing_fields = ["tipoSistemaOpticoId"] if payload.get("requiresQuestion") else []
            return ToolExecutionResult(
                output_text=_json_output(payload),
                context=ToolContextUpdate(last_missing_fields=missing_fields),
            )

        if name == "resolve_led_recommendation":
            request_payload = {
                "marcaId": int(arguments["marca_id"]),
                "modeloId": int(arguments["modelo_id"]),
                "anioVehiculo": int(arguments["anio_vehiculo"]),
                "horarioManejoPerfilId": int(arguments["horario_manejo_perfil_id"]),
                "zonaManejoPerfilId": int(arguments["zona_manejo_perfil_id"]),
                "usoVehiculoPerfilId": int(arguments["uso_vehiculo_perfil_id"]),
                "tipoPolarizadoId": int(arguments["tipo_polarizado_id"]),
                "tipoSistemaOpticoId": arguments["tipo_sistema_optico_id"],
            }
            try:
                payload = await self._backend_client.resolve_led_recommendation(request_payload)
                return ToolExecutionResult(
                    output_text=_json_output({"status": "ok", "recommendation": payload}),
                    context=ToolContextUpdate(
                        known_values=request_payload,
                        last_missing_fields=[],
                        last_recommendation=payload,
                    ),
                )
            except BackendServiceError as error:
                error_payload = {
                    "status": "error",
                    "statusCode": error.status_code,
                    "message": error.message,
                    "details": error.payload.get("details", []),
                    "missingFields": _extract_missing_fields(error.payload),
                }
                return ToolExecutionResult(
                    output_text=_json_output(error_payload),
                    context=ToolContextUpdate(
                        known_values=request_payload,
                        last_missing_fields=error_payload["missingFields"],
                    ),
                )

        if name == "get_gamas_luz":
            payload = await self._backend_client.get_gamas_luz()
            return ToolExecutionResult(output_text=_json_output(payload))

        if name == "get_product_detail":
            payload = await self._backend_client.get_product_detail(
                int(arguments["producto_id"])
            )
            return ToolExecutionResult(output_text=_json_output(payload))

        raise ValueError(f"Herramienta desconocida: {name}")
