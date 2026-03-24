from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any

from app.session_store import ChatSession
from app.tools import ToolContextUpdate, ToolExecutionResult, ToolRunner

RECOMMENDATION_REQUIRED_FIELDS = [
    "marcaId",
    "modeloId",
    "anioVehiculo",
    "horarioManejoPerfilId",
    "zonaManejoPerfilId",
    "usoVehiculoPerfilId",
    "tipoPolarizadoId",
]

OPTICAL_SYSTEM_IDS = {
    "lupa_proyector": 1,
    "reflector_abierto": 2,
}

STARTER_QUICK_REPLIES = [
    "Ayudame a elegir luces para mi carro",
    "Que significa gama premium?",
    "Que datos necesitas para recomendarme?",
]

HORARIO_SYNONYMS = {
    "diurno": ["diurno", "de dia", "dia", "solo dia", "mayormente de dia"],
    "mixto": ["mixto", "dia y noche", "de dia y de noche", "ambos"],
    "nocturno": ["nocturno", "de noche", "noche", "mayormente de noche"],
}

ZONA_SYNONYMS = {
    "urbano": ["urbano", "ciudad"],
    "carretera": ["carretera", "autopista", "ruta"],
    "rural": ["rural", "campo", "vereda", "trocha"],
    "mixto": ["mixto", "ciudad y carretera", "ciudad y campo", "de todo"],
}

USO_SYNONYMS = {
    "uso_personal": ["uso personal", "personal", "diario", "familia"],
    "trabajo": ["trabajo", "laboral", "taxi", "uber", "reparto"],
    "offroad": ["offroad", "off road", "4x4", "montana", "aventura"],
}


@dataclass
class FallbackAssistantResponse:
    reply_text: str
    quick_replies: list[str] = field(default_factory=list)
    context_update: ToolContextUpdate = field(default_factory=ToolContextUpdate)


class FallbackAssistant:
    def __init__(self, tool_runner: ToolRunner) -> None:
        self._tool_runner = tool_runner

    async def respond(
        self, session: ChatSession, user_message: str
    ) -> FallbackAssistantResponse:
        raw_text = user_message.strip()
        normalized_text = self._normalize_text(raw_text)

        if self._is_data_question(normalized_text):
            return FallbackAssistantResponse(
                reply_text=(
                    "Para recomendarte bien necesito marca, modelo, anio, horario de "
                    "manejo, zona donde conduces, uso del vehiculo y nivel de polarizado. "
                    "Si tu modelo tiene versiones con y sin proyector, tambien te preguntare "
                    "por el sistema optico."
                ),
                quick_replies=[
                    "Ayudame a elegir luces para mi carro",
                    "Que significa gama premium?",
                    "Empecemos por la marca",
                ],
                context_update=ToolContextUpdate(
                    last_missing_fields=list(RECOMMENDATION_REQUIRED_FIELDS)
                ),
            )

        if self._is_confidence_question(normalized_text) and session.metadata.last_recommendation:
            confidence = str(
                session.metadata.last_recommendation.get("nivelConfianza") or "media"
            ).lower()
            explanation = {
                "alta": (
                    "La confianza alta significa que hubo coincidencia precisa entre tu "
                    "vehiculo, el anio y las compatibilidades registradas."
                ),
                "media": (
                    "La confianza media significa que la recomendacion es util, pero parte "
                    "de la compatibilidad se resolvio por rango o con menos detalle."
                ),
                "baja": (
                    "La confianza baja significa que hubo compatibilidad parcial o datos "
                    "faltantes, asi que conviene validar la instalacion antes de comprar."
                ),
            }.get(
                confidence,
                "Ese nivel indica cuan exacta fue la coincidencia entre tu vehiculo y las compatibilidades disponibles.",
            )
            return FallbackAssistantResponse(
                reply_text=explanation,
                quick_replies=[
                    "Cual producto top me conviene mas?",
                    "Que diferencia hay entre gama media y premium?",
                ],
            )

        if self._is_top_product_question(normalized_text) and session.metadata.last_recommendation:
            top_product = self._get_top_product(session.metadata.last_recommendation)
            if top_product:
                product_id = top_product.get("productoId")
                details_text = ""
                if isinstance(product_id, int):
                    try:
                        payload, _ = await self._execute_tool(
                            "get_product_detail", {"producto_id": product_id}
                        )
                        details_text = self._format_product_detail(payload)
                    except Exception:
                        details_text = ""
                if not details_text:
                    details_text = (
                        f"El top recomendado es {top_product.get('modelo', 'ese producto')}, "
                        f"gama {top_product.get('gama') or 'no especificada'}, "
                        f"casquillo {top_product.get('casquilloCodigo') or 'N/D'}."
                    )
                return FallbackAssistantResponse(
                    reply_text=details_text,
                    quick_replies=[
                        "Que significa el nivel de confianza?",
                        "Que diferencia hay entre gama media y premium?",
                    ],
                )

        if self._is_gamas_question(normalized_text):
            try:
                payload, _ = await self._execute_tool("get_gamas_luz", {})
                return FallbackAssistantResponse(
                    reply_text=self._format_gamas_response(payload),
                    quick_replies=[
                        "Ayudame a elegir luces para mi carro",
                        "Que datos necesitas para recomendarme?",
                    ],
                )
            except Exception:
                return FallbackAssistantResponse(
                    reply_text=(
                        "Ahora mismo no pude consultar las gamas en tiempo real. "
                        "Si quieres, seguimos con la recomendacion guiada y te muestro el mejor resultado disponible."
                    ),
                    quick_replies=[
                        "Ayudame a elegir luces para mi carro",
                        "Que datos necesitas para recomendarme?",
                    ],
                )

        return await self._handle_recommendation_flow(session, raw_text, normalized_text)

    async def _handle_recommendation_flow(
        self, session: ChatSession, raw_text: str, normalized_text: str
    ) -> FallbackAssistantResponse:
        try:
            catalogs, catalogs_context = await self._execute_tool("get_survey_catalogs", {})
        except Exception:
            return FallbackAssistantResponse(
                reply_text=(
                    "Ahora mismo no pude conectarme al catalogo del sistema. "
                    "Puedes seguir con la encuesta normal mientras restablecemos ese servicio."
                ),
                quick_replies=STARTER_QUICK_REPLIES,
            )

        known_values = dict(session.metadata.known_values)
        context_update = ToolContextUpdate(
            known_values={},
            last_missing_fields=list(session.metadata.last_missing_fields),
            last_recommendation=None,
            catalogs_loaded=catalogs_context.catalogs_loaded,
        )

        parsed_updates = self._extract_known_values(raw_text, normalized_text, known_values, catalogs)
        if parsed_updates:
            self._merge_context_update(
                context_update,
                ToolContextUpdate(known_values=parsed_updates),
            )
            known_values.update(parsed_updates)

        decision = await self._ensure_optical_decision(known_values, context_update)
        if decision is not None:
            known_values.update(decision)
            context_update.known_values.update(decision)

        missing_fields = self._compute_missing_fields(known_values)
        if missing_fields:
            context_update.last_missing_fields = missing_fields
            reply_text, quick_replies = self._build_missing_field_prompt(
                missing_fields[0], known_values, catalogs
            )
            return FallbackAssistantResponse(
                reply_text=reply_text,
                quick_replies=quick_replies,
                context_update=context_update,
            )

        try:
            recommendation_payload, recommendation_context = await self._execute_tool(
                "resolve_led_recommendation",
                {
                    "marca_id": int(known_values["marcaId"]),
                    "modelo_id": int(known_values["modeloId"]),
                    "anio_vehiculo": int(known_values["anioVehiculo"]),
                    "horario_manejo_perfil_id": int(known_values["horarioManejoPerfilId"]),
                    "zona_manejo_perfil_id": int(known_values["zonaManejoPerfilId"]),
                    "uso_vehiculo_perfil_id": int(known_values["usoVehiculoPerfilId"]),
                    "tipo_polarizado_id": int(known_values["tipoPolarizadoId"]),
                    "tipo_sistema_optico_id": known_values.get("tipoSistemaOpticoId"),
                },
            )
        except Exception:
            return FallbackAssistantResponse(
                reply_text=(
                    "Reuni los datos, pero no pude resolver la recomendacion ahora mismo. "
                    "Puedes seguir con la encuesta normal mientras recuperamos el servicio."
                ),
                quick_replies=STARTER_QUICK_REPLIES,
                context_update=context_update,
            )

        self._merge_context_update(context_update, recommendation_context)

        if recommendation_payload.get("status") == "error":
            context_update.last_missing_fields = (
                recommendation_payload.get("missingFields")
                or recommendation_context.last_missing_fields
            )
            next_field = context_update.last_missing_fields[0] if context_update.last_missing_fields else ""
            reply_text, quick_replies = self._build_missing_field_prompt(
                next_field, known_values, catalogs
            )
            return FallbackAssistantResponse(
                reply_text=reply_text,
                quick_replies=quick_replies,
                context_update=context_update,
            )

        recommendation = recommendation_payload.get("recommendation") or {}
        context_update.last_recommendation = recommendation
        context_update.last_missing_fields = []
        reply_text = self._build_recommendation_summary(recommendation)

        return FallbackAssistantResponse(
            reply_text=reply_text,
            quick_replies=[
                "Que significa el nivel de confianza?",
                "Cual producto top me conviene mas?",
                "Que diferencia hay entre gama media y premium?",
            ],
            context_update=context_update,
        )

    async def _ensure_optical_decision(
        self, known_values: dict[str, Any], context_update: ToolContextUpdate
    ) -> dict[str, Any] | None:
        modelo_id = known_values.get("modeloId")
        anio = known_values.get("anioVehiculo")
        if not modelo_id or not anio:
            return None

        if known_values.get("tipoSistemaOpticoDecisionChecked"):
            return None

        payload, decision_context = await self._execute_tool(
            "get_optical_system_decision",
            {"modelo_id": int(modelo_id), "anio_vehiculo": int(anio)},
        )
        self._merge_context_update(context_update, decision_context)

        if payload.get("requiresQuestion"):
            return {
                "tipoSistemaOpticoDecisionChecked": True,
                "tipoSistemaOpticoRequiresQuestion": True,
            }

        return {
            "tipoSistemaOpticoDecisionChecked": True,
            "tipoSistemaOpticoRequiresQuestion": False,
            "tipoSistemaOpticoId": None,
            "tipoSistemaOpticoCodigo": payload.get("resolvedTipoSistemaOptico"),
        }

    def _extract_known_values(
        self,
        raw_text: str,
        normalized_text: str,
        current_known: dict[str, Any],
        catalogs: dict[str, Any],
    ) -> dict[str, Any]:
        updates: dict[str, Any] = {}

        brands = catalogs.get("marcas") or []
        matched_brand = self._match_catalog_item(normalized_text, brands, "nombre")
        if matched_brand:
            updates["marcaId"] = matched_brand["id"]
            updates["marcaNombre"] = matched_brand["nombre"]

            if current_known.get("marcaId") not in {None, matched_brand["id"]}:
                updates.update(
                    {
                        "modeloId": None,
                        "modeloNombre": None,
                        "anioVehiculo": None,
                        "tipoSistemaOpticoId": None,
                        "tipoSistemaOpticoCodigo": None,
                        "tipoSistemaOpticoDecisionChecked": None,
                        "tipoSistemaOpticoRequiresQuestion": None,
                    }
                )

        models = catalogs.get("modelos") or []
        active_brand_id = updates.get("marcaId") or current_known.get("marcaId")
        filtered_models = [
            model for model in models if not active_brand_id or model.get("idMarca") == active_brand_id
        ]
        matched_model = self._match_catalog_item(normalized_text, filtered_models, "nombre")
        if matched_model:
            updates["modeloId"] = matched_model["id"]
            updates["modeloNombre"] = matched_model["nombre"]
            updates["marcaId"] = matched_model.get("idMarca")
            matched_brand_from_model = next(
                (brand for brand in brands if brand.get("id") == matched_model.get("idMarca")),
                None,
            )
            if matched_brand_from_model:
                updates["marcaNombre"] = matched_brand_from_model["nombre"]

            if current_known.get("modeloId") not in {None, matched_model["id"]}:
                updates.update(
                    {
                        "anioVehiculo": None,
                        "tipoSistemaOpticoId": None,
                        "tipoSistemaOpticoCodigo": None,
                        "tipoSistemaOpticoDecisionChecked": None,
                        "tipoSistemaOpticoRequiresQuestion": None,
                    }
                )

        parsed_year = self._extract_year(raw_text)
        if parsed_year is not None:
            selected_model = self._find_model_by_id(
                catalogs,
                updates.get("modeloId") or current_known.get("modeloId"),
            )
            if selected_model and not self._year_in_model_range(parsed_year, selected_model):
                updates["anioVehiculo"] = None
            else:
                updates["anioVehiculo"] = parsed_year

        profiles = catalogs.get("perfilesUso") or {}

        horario = self._match_profile_option(
            normalized_text,
            profiles.get("horario_manejo") or [],
            HORARIO_SYNONYMS,
        )
        if horario:
            updates["horarioManejoPerfilId"] = horario["id"]
            updates["horarioManejoValor"] = horario["valor"]

        zona = self._match_profile_option(
            normalized_text,
            profiles.get("zona_manejo") or [],
            ZONA_SYNONYMS,
        )
        if zona:
            updates["zonaManejoPerfilId"] = zona["id"]
            updates["zonaManejoValor"] = zona["valor"]

        uso = self._match_profile_option(
            normalized_text,
            profiles.get("uso_vehiculo") or [],
            USO_SYNONYMS,
        )
        if uso:
            updates["usoVehiculoPerfilId"] = uso["id"]
            updates["usoVehiculoValor"] = uso["valor"]

        polarizado = self._match_polarizado(raw_text, catalogs.get("tiposPolarizado") or [])
        if polarizado:
            updates["tipoPolarizadoId"] = polarizado["id"]
            updates["tipoPolarizadoCodigo"] = polarizado["codigo"]

        optical = self._match_optical_system(normalized_text)
        if optical:
            updates["tipoSistemaOpticoId"] = optical["id"]
            updates["tipoSistemaOpticoCodigo"] = optical["code"]
            updates["tipoSistemaOpticoDecisionChecked"] = True
            updates["tipoSistemaOpticoRequiresQuestion"] = True

        return updates

    def _compute_missing_fields(self, known_values: dict[str, Any]) -> list[str]:
        missing_fields = [
            field
            for field in RECOMMENDATION_REQUIRED_FIELDS
            if known_values.get(field) in {None, ""}
        ]

        if (
            known_values.get("tipoSistemaOpticoRequiresQuestion")
            and "tipoSistemaOpticoId" not in missing_fields
            and known_values.get("tipoSistemaOpticoId") in {None, ""}
        ):
            missing_fields.append("tipoSistemaOpticoId")

        return missing_fields

    def _build_missing_field_prompt(
        self, field_name: str, known_values: dict[str, Any], catalogs: dict[str, Any]
    ) -> tuple[str, list[str]]:
        if field_name == "marcaId":
            brands = catalogs.get("marcas") or []
            return (
                "Empecemos por la marca de tu vehiculo. Puedes escribirla o elegir una opcion.",
                [brand["nombre"] for brand in brands[:6]],
            )

        if field_name == "modeloId":
            models = catalogs.get("modelos") or []
            selected_brand_id = known_values.get("marcaId")
            filtered_models = [
                model for model in models if model.get("idMarca") == selected_brand_id
            ]
            brand_name = known_values.get("marcaNombre") or "esa marca"
            return (
                f"Perfecto. Ahora dime el modelo de {brand_name}.",
                [model["nombre"] for model in filtered_models[:6]],
            )

        if field_name == "anioVehiculo":
            model = self._find_model_by_id(catalogs, known_values.get("modeloId"))
            if model:
                anio_desde = model.get("anioDesde")
                anio_hasta = model.get("anioHasta") or "actual"
                return (
                    f"Ahora dime el anio de tu {model.get('nombre')}. El rango que tengo es {anio_desde}-{anio_hasta}.",
                    [],
                )
            return ("Ahora dime el anio de tu vehiculo.", [])

        if field_name == "tipoSistemaOpticoId":
            return (
                "Para ese modelo necesito confirmar el sistema optico. Tus faros tienen lupa o proyector, o son reflector abierto?",
                ["Tiene lupa/proyector", "Es reflector abierto"],
            )

        if field_name == "horarioManejoPerfilId":
            return (
                "En que horario manejas mas?",
                self._profile_quick_replies(catalogs, "horario_manejo"),
            )

        if field_name == "zonaManejoPerfilId":
            return (
                "Donde conduces la mayor parte del tiempo?",
                self._profile_quick_replies(catalogs, "zona_manejo"),
            )

        if field_name == "usoVehiculoPerfilId":
            return (
                "Cual es el uso principal del vehiculo?",
                self._profile_quick_replies(catalogs, "uso_vehiculo"),
            )

        if field_name == "tipoPolarizadoId":
            return (
                "Que nivel de polarizado tiene tu vehiculo?",
                self._polarizado_quick_replies(catalogs),
            )

        return (
            "Cuentame un poco mas de tu vehiculo para continuar con la recomendacion.",
            STARTER_QUICK_REPLIES,
        )

    def _profile_quick_replies(
        self, catalogs: dict[str, Any], category_key: str
    ) -> list[str]:
        labels = []
        for item in (catalogs.get("perfilesUso") or {}).get(category_key) or []:
            label = str(item.get("valor") or "").replace("_", " ").strip().title()
            if label:
                labels.append(label)
        return labels

    def _polarizado_quick_replies(self, catalogs: dict[str, Any]) -> list[str]:
        preferred_order = ["sin polarizado", "70%", "50%", "35%", "20%", "5%"]
        available = {
            str(item.get("codigo") or "").lower(): str(item.get("codigo") or "")
            for item in catalogs.get("tiposPolarizado") or []
        }
        ordered = [available[key] for key in preferred_order if key in available]
        return ordered or ["Sin polarizado", "50%", "35%", "20%", "5%"]

    def _build_recommendation_summary(self, recommendation: dict[str, Any]) -> str:
        confidence = recommendation.get("nivelConfianza") or "media"
        total_results = sum(
            len(group.get("productos") or [])
            for group in recommendation.get("resultados") or []
        )
        message = recommendation.get("mensaje") or "Ya tengo una recomendacion lista."
        return (
            f"{message} Nivel de confianza: {confidence}. "
            f"Te muestro {total_results} opciones priorizadas para tu vehiculo."
        )

    def _format_gamas_response(self, payload: dict[str, Any]) -> str:
        gamas = payload.get("gamas") or []
        if not gamas:
            return "No encontre gamas activas en este momento."

        summary_parts = []
        for item in gamas:
            nombre = item.get("nombre") or "Sin nombre"
            watts_min = item.get("potenciaWattsMin")
            watts_max = item.get("potenciaWattsMax")
            description = item.get("descripcion") or "Sin descripcion"
            range_text = (
                f"{watts_min}-{watts_max}W"
                if watts_min is not None and watts_max is not None
                else "potencia variable"
            )
            summary_parts.append(f"{nombre}: {range_text}, {description}")

        return (
            "Las gamas activas del catalogo son: " + "; ".join(summary_parts) + ". "
            "Si quieres, ahora mismo pasamos a la recomendacion para tu carro."
        )

    def _format_product_detail(self, payload: dict[str, Any]) -> str:
        model = payload.get("modelo") or "ese producto"
        gama = payload.get("idGamaLuz")
        price = payload.get("precio")
        power = payload.get("potenciaWatts")
        casquillo = payload.get("idCasquillo")

        parts = [f"El producto {model}"]
        if power is not None:
            parts.append(f"trabaja con {power}W")
        if casquillo is not None:
            parts.append(f"usa casquillo {casquillo}")
        if gama is not None:
            parts.append(f"y pertenece a la gama {gama}")
        if price is not None:
            parts.append(f"con precio de referencia {price}")
        return ", ".join(parts) + "."

    def _get_top_product(self, recommendation: dict[str, Any]) -> dict[str, Any] | None:
        groups = recommendation.get("resultados") or []
        ranked_products: list[dict[str, Any]] = []
        for group in groups:
            ranked_products.extend(group.get("productos") or [])
        if not ranked_products:
            return None
        return sorted(
            ranked_products,
            key=lambda item: (
                -int(item.get("puntajeTotal") or 0),
                int(item.get("rank") or 999),
            ),
        )[0]

    def _is_data_question(self, normalized_text: str) -> bool:
        return any(
            phrase in normalized_text
            for phrase in (
                "que datos",
                "que informacion",
                "que necesitas",
                "datos necesitas",
            )
        )

    def _is_gamas_question(self, normalized_text: str) -> bool:
        return "gama" in normalized_text or "premium" in normalized_text

    def _is_confidence_question(self, normalized_text: str) -> bool:
        return "confianza" in normalized_text

    def _is_top_product_question(self, normalized_text: str) -> bool:
        return any(
            phrase in normalized_text
            for phrase in ("top", "producto", "conviene mas", "me conviene")
        )

    async def _execute_tool(
        self, name: str, arguments: dict[str, Any]
    ) -> tuple[dict[str, Any], ToolContextUpdate]:
        result = await self._tool_runner.execute(name, arguments)
        payload = self._parse_output(result)
        return payload, result.context

    def _parse_output(self, result: ToolExecutionResult) -> dict[str, Any]:
        payload = json.loads(result.output_text)
        if isinstance(payload, dict):
            return payload
        return {"items": payload}

    def _match_catalog_item(
        self, normalized_text: str, items: list[dict[str, Any]], label_key: str
    ) -> dict[str, Any] | None:
        exact_matches = []
        for item in items:
            label = str(item.get(label_key) or "")
            if not label:
                continue
            normalized_label = self._normalize_text(label)
            if normalized_label and self._contains_phrase(normalized_text, normalized_label):
                exact_matches.append((len(normalized_label), item))

        if exact_matches:
            exact_matches.sort(key=lambda item: item[0], reverse=True)
            return exact_matches[0][1]

        fuzzy_matches = []
        user_tokens = {
            token
            for token in normalized_text.split()
            if len(token) >= 3 and not token.isdigit()
        }
        for item in items:
            label = str(item.get(label_key) or "")
            normalized_label = self._normalize_text(label)
            label_tokens = {
                token
                for token in normalized_label.split()
                if len(token) >= 3 and not token.isdigit()
            }
            overlap = user_tokens.intersection(label_tokens)
            if overlap:
                fuzzy_matches.append((len(overlap), len(normalized_label), item))

        fuzzy_matches.sort(key=lambda item: (item[0], item[1]), reverse=True)
        return fuzzy_matches[0][2] if fuzzy_matches else None

    def _match_profile_option(
        self,
        normalized_text: str,
        options: list[dict[str, Any]],
        synonyms_by_value: dict[str, list[str]],
    ) -> dict[str, Any] | None:
        for option in options:
            value = str(option.get("valor") or "")
            normalized_value = self._normalize_text(value)
            candidates = [normalized_value]
            candidates.extend(
                self._normalize_text(term)
                for term in synonyms_by_value.get(value, [])
            )
            description = self._normalize_text(str(option.get("descripcion") or ""))
            if description:
                candidates.append(description)

            if any(
                candidate and self._contains_phrase(normalized_text, candidate)
                for candidate in candidates
            ):
                return option
        return None

    def _match_polarizado(
        self, raw_text: str, options: list[dict[str, Any]]
    ) -> dict[str, Any] | None:
        normalized_text = self._normalize_text(raw_text)
        if any(
            phrase in normalized_text
            for phrase in ("sin polarizado", "no tiene polarizado", "no tengo polarizado")
        ):
            return next(
                (
                    item
                    for item in options
                    if str(item.get("codigo") or "").lower() == "sin polarizado"
                ),
                None,
            )

        match = re.search(r"(?<!\d)(5|20|35|50|70)\s*%", raw_text)
        if not match:
            return None

        percentage = f"{match.group(1)}%"
        return next(
            (item for item in options if str(item.get("codigo") or "") == percentage),
            None,
        )

    def _match_optical_system(self, normalized_text: str) -> dict[str, Any] | None:
        if any(
            phrase in normalized_text
            for phrase in ("lupa", "proyector", "lupa proyector", "tiene lupa")
        ):
            return {"id": OPTICAL_SYSTEM_IDS["lupa_proyector"], "code": "lupa_proyector"}

        if any(
            phrase in normalized_text
            for phrase in ("reflector", "reflector abierto", "sin lupa")
        ):
            return {
                "id": OPTICAL_SYSTEM_IDS["reflector_abierto"],
                "code": "reflector_abierto",
            }

        return None

    def _find_model_by_id(
        self, catalogs: dict[str, Any], model_id: Any
    ) -> dict[str, Any] | None:
        for model in catalogs.get("modelos") or []:
            if model.get("id") == model_id:
                return model
        return None

    def _year_in_model_range(self, year: int, model: dict[str, Any]) -> bool:
        anio_desde = int(model.get("anioDesde") or 0)
        anio_hasta = model.get("anioHasta")
        if year < anio_desde:
            return False
        if anio_hasta is not None and year > int(anio_hasta):
            return False
        return True

    def _extract_year(self, raw_text: str) -> int | None:
        match = re.search(r"\b(19\d{2}|20\d{2}|2100)\b", raw_text)
        if not match:
            return None
        return int(match.group(1))

    def _merge_context_update(
        self, current: ToolContextUpdate, new: ToolContextUpdate
    ) -> None:
        current.known_values.update(new.known_values)
        current.catalogs_loaded = current.catalogs_loaded or new.catalogs_loaded
        if new.last_missing_fields:
            current.last_missing_fields = list(new.last_missing_fields)
        if new.last_recommendation is not None:
            current.last_recommendation = new.last_recommendation
            current.last_missing_fields = []

    @staticmethod
    def _normalize_text(value: str) -> str:
        normalized = unicodedata.normalize("NFKD", value or "")
        ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
        return re.sub(r"\s+", " ", re.sub(r"[^a-zA-Z0-9%]+", " ", ascii_text.lower())).strip()

    @staticmethod
    def _contains_phrase(normalized_text: str, normalized_phrase: str) -> bool:
        haystack = f" {normalized_text} "
        needle = f" {normalized_phrase} "
        return needle in haystack
