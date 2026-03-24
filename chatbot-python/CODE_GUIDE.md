# Chatbot Python DOS Lighting

## Capas
- `app/main.py`: crea la app FastAPI, registra rutas y normaliza errores HTTP para el frontend.
- `app/config.py`: lee configuracion desde el `.env` raiz del proyecto.
- `app/session_store.py`: conserva historial y metadata de cada sesion en memoria con TTL.
- `app/rate_limiter.py`: aplica un limite simple por cliente para evitar abuso.
- `app/backend_client.py`: encapsula todas las llamadas HTTP al backend TypeScript existente.
- `app/tools.py`: define las herramientas visibles para OpenAI y como se ejecuta cada una.
- `app/chat_service.py`: orquesta la conversacion, el loop de function calling y la respuesta final.
- `app/openai_client.py`: encapsula el uso del cliente oficial de OpenAI Responses API.

## Flujo
1. El frontend envia `POST /api/chat/message`.
2. FastAPI valida el payload y obtiene el `ChatService`.
3. `ChatService` recupera o crea la sesion.
4. Se construye el prompt con instrucciones, snapshot de metadata e historial reciente.
5. El modelo responde o solicita una herramienta.
6. `ToolRunner` ejecuta la herramienta contra el backend actual.
7. El resultado vuelve al modelo como `function_call_output`.
8. Cuando ya hay respuesta final, se guarda el turno en memoria y se devuelve el contrato para React.

## Por que esta separado del backend Node
- El backend TypeScript sigue siendo la fuente de verdad de catalogos y recomendaciones.
- El servicio Python se enfoca solo en experiencia conversacional y no toca la base de datos.
- Esto permite evolucionar el chatbot sin duplicar reglas de negocio ni arriesgar el core del sistema.

## Pruebas
- `tests/test_session_store.py`: TTL y recreacion de sesiones.
- `tests/test_chat_service.py`: conversacion, tools, errores y recomendaciones.
- `tests/test_main.py`: smoke tests del contrato HTTP.
