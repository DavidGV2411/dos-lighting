from __future__ import annotations

from typing import Any

from openai import AsyncOpenAI


class OpenAIServiceError(Exception):
    pass


class OpenAIResponsesClient:
    def __init__(self, *, api_key: str, model: str) -> None:
        self._client = AsyncOpenAI(api_key=api_key)
        self._model = model

    async def create_response(
        self, *, input_items: list[dict[str, Any]], tools: list[dict[str, Any]]
    ) -> Any:
        try:
            return await self._client.responses.create(
                model=self._model,
                input=input_items,
                tools=tools,
                store=False,
                parallel_tool_calls=False,
                max_output_tokens=700,
            )
        except Exception as error:
            raise OpenAIServiceError(
                "No se pudo obtener una respuesta del modelo de IA."
            ) from error

    async def aclose(self) -> None:
        await self._client.close()
