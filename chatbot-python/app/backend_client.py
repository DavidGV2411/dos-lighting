from __future__ import annotations

import asyncio
from typing import Any

import httpx


class BackendServiceError(Exception):
    def __init__(
        self, message: str, status_code: int = 502, payload: dict[str, Any] | None = None
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.payload = payload or {}


class BackendClient:
    def __init__(
        self,
        base_url: str,
        *,
        timeout: float = 15.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=timeout,
            transport=transport,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def healthcheck(self) -> bool:
        try:
            response = await self._client.get("/actuator/health")
            if response.status_code != 200:
                return False
            payload = response.json()
            return payload.get("status") == "UP"
        except Exception:
            return False

    async def get_survey_catalogs(self) -> dict[str, Any]:
        marcas, modelos, perfiles, polarizados = await asyncio.gather(
            self._request_json("GET", "/api/v1/marcas-vehiculo"),
            self._request_json("GET", "/api/v1/modelos-vehiculo"),
            self._request_json("GET", "/api/v1/perfiles-uso"),
            self._request_json("GET", "/api/v1/tipos-polarizado"),
        )

        perfiles_activos = [item for item in perfiles if item.get("activo")]
        polarizados_activos = [item for item in polarizados if item.get("activo")]

        return {
            "marcas": [
                {
                    "id": item["id"],
                    "nombre": item["nombre"],
                    "idTipoVehiculo": item.get("idTipoVehiculo"),
                }
                for item in marcas
            ],
            "modelos": [
                {
                    "id": item["id"],
                    "nombre": item["nombre"],
                    "idMarca": item.get("idMarca"),
                    "anioDesde": item.get("anioDesde"),
                    "anioHasta": item.get("anioHasta"),
                }
                for item in modelos
            ],
            "perfilesUso": {
                "horario_manejo": [
                    item for item in perfiles_activos if item.get("categoria") == "horario_manejo"
                ],
                "zona_manejo": [
                    item for item in perfiles_activos if item.get("categoria") == "zona_manejo"
                ],
                "uso_vehiculo": [
                    item for item in perfiles_activos if item.get("categoria") == "uso_vehiculo"
                ],
            },
            "tiposPolarizado": polarizados_activos,
        }

    async def get_optical_system_decision(
        self, modelo_id: int, anio_vehiculo: int
    ) -> dict[str, Any]:
        return await self._request_json(
            "GET",
            f"/api/v1/modelos-vehiculo/{modelo_id}/decision-sistema-optico",
            params={"anioVehiculo": anio_vehiculo},
        )

    async def resolve_led_recommendation(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._request_json(
            "POST",
            "/api/recomendaciones/resolver",
            json=payload,
        )

    async def get_gamas_luz(self) -> dict[str, Any]:
        gamas = await self._request_json("GET", "/api/v1/gamas-luz")
        return {
            "gamas": [item for item in gamas if item.get("activo")],
        }

    async def get_product_detail(self, producto_id: int) -> dict[str, Any]:
        return await self._request_json("GET", f"/api/v1/productos-led/{producto_id}")

    async def _request_json(
        self, method: str, path: str, **kwargs: Any
    ) -> dict[str, Any] | list[dict[str, Any]]:
        try:
            response = await self._client.request(method, path, **kwargs)
        except httpx.HTTPError as error:
            raise BackendServiceError(
                "No se pudo conectar con el backend principal."
            ) from error

        payload: dict[str, Any] | list[dict[str, Any]] | None
        try:
            payload = response.json()
        except ValueError:
            payload = None

        if not response.is_success:
            message = "El backend principal devolvio un error."
            details: dict[str, Any] = {}
            if isinstance(payload, dict):
                message = (
                    payload.get("message")
                    or payload.get("error", {}).get("message")
                    or payload.get("detail")
                    or message
                )
                details = payload
            raise BackendServiceError(message, response.status_code, details)

        return payload if payload is not None else {}
