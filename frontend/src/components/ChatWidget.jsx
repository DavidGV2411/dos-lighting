import { useEffect, useRef, useState } from "react";
import RecommendationResults from "./RecommendationResults";
import { sendChatMessage } from "../services/chatService";
import {
  clearStoredChatState,
  getStoredChatState,
  setStoredChatState
} from "../services/chatStorage";

const STARTER_QUICK_REPLIES = [
  "Ayudame a elegir luces para mi carro",
  "Que significa gama premium?",
  "Que datos necesitas para recomendarme?"
];

function createMessage(role, text, extras = {}) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    quickReplies: extras.quickReplies || [],
    recommendation: extras.recommendation || null
  };
}

function createWelcomeMessage() {
  return createMessage(
    "assistant",
    "Hola, soy el asesor virtual de DOS Lighting. Puedo ayudarte a entender las gamas y a llegar a la mejor recomendacion para tu vehiculo.",
    { quickReplies: STARTER_QUICK_REPLIES }
  );
}

function getInitialState() {
  const stored = getStoredChatState();
  if (stored?.messages?.length) {
    return {
      isOpen: Boolean(stored.isOpen),
      sessionId: stored.sessionId || null,
      messages: stored.messages
    };
  }

  return {
    isOpen: false,
    sessionId: null,
    messages: [createWelcomeMessage()]
  };
}

function ChatWidget({ show = true }) {
  const initialState = getInitialState();
  const [isOpen, setIsOpen] = useState(initialState.isOpen);
  const [sessionId, setSessionId] = useState(initialState.sessionId);
  const [messages, setMessages] = useState(initialState.messages);
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    setStoredChatState({
      isOpen,
      sessionId,
      messages
    });
  }, [isOpen, sessionId, messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen, isSubmitting]);

  if (!show) {
    return null;
  }

  async function handleSendMessage(rawText) {
    const text = String(rawText || inputValue).trim();
    if (!text || isSubmitting) {
      return;
    }

    const userMessage = createMessage("user", text);
    setMessages((current) => [...current, userMessage]);
    setInputValue("");
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await sendChatMessage({
        sessionId,
        message: text
      });

      setSessionId(response.sessionId || null);
      setMessages((current) => [
        ...current,
        createMessage("assistant", response.replyText || "Listo.", {
          quickReplies: response.quickReplies || [],
          recommendation: response.recommendation || null
        })
      ]);
    } catch (error) {
      const message =
        error?.message ||
        "Ahora mismo no pude continuar el chat. Puedes seguir con la encuesta normal.";
      setErrorMessage(message);
      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          "Ahora mismo no pude continuar el chat. Puedes seguir con la encuesta normal mientras restablecemos el servicio.",
          { quickReplies: STARTER_QUICK_REPLIES }
        )
      ]);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    clearStoredChatState();
    setSessionId(null);
    setErrorMessage("");
    setInputValue("");
    setMessages([createWelcomeMessage()]);
  }

  return (
    <div className={`chatbot-shell${isOpen ? " open" : ""}`}>
      {isOpen ? (
        <section className="chatbot-panel" aria-label="Asesor virtual DOS Lighting">
          <header className="chatbot-header">
            <div>
              <p className="chatbot-kicker">Asesor virtual</p>
              <h3>DOS Lighting</h3>
              <p className="chatbot-subtitle">
                Usa la misma base de recomendacion del sistema principal.
              </p>
            </div>
            <div className="chatbot-header-actions">
              <button
                type="button"
                className="btn tiny"
                onClick={handleReset}
                disabled={isSubmitting}
              >
                Reiniciar
              </button>
              <button
                type="button"
                className="chatbot-icon-button"
                onClick={() => setIsOpen(false)}
                aria-label="Minimizar chat"
              >
                -
              </button>
            </div>
          </header>

          {errorMessage ? <p className="chatbot-error">{errorMessage}</p> : null}

          <div className="chatbot-messages">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`chatbot-message chatbot-message-${message.role}`}
              >
                <p>{message.text}</p>

                {message.recommendation ? (
                  <RecommendationResults
                    recommendation={message.recommendation}
                    title="Recomendacion del chat"
                    compact
                  />
                ) : null}

                {message.quickReplies?.length ? (
                  <div className="chatbot-quick-replies">
                    {message.quickReplies.map((quickReply) => (
                      <button
                        key={`${message.id}-${quickReply}`}
                        type="button"
                        className="chatbot-chip"
                        onClick={() => handleSendMessage(quickReply)}
                        disabled={isSubmitting}
                      >
                        {quickReply}
                      </button>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}

            {isSubmitting ? (
              <div className="chatbot-loading">
                <span className="loader" aria-hidden="true" />
                <span>El asesor esta pensando...</span>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>

          <form
            className="chatbot-form"
            onSubmit={(event) => {
              event.preventDefault();
              handleSendMessage();
            }}
          >
            <textarea
              rows="3"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="Escribe tu duda o describe tu vehiculo..."
              disabled={isSubmitting}
            />
            <div className="chatbot-form-actions">
              <button className="btn primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        className="chatbot-launcher"
        onClick={() => setIsOpen((current) => !current)}
        aria-label={isOpen ? "Cerrar chatbot" : "Abrir chatbot"}
      >
        <span className="chatbot-launcher-ring" />
        <span>Asesor virtual</span>
      </button>
    </div>
  );
}

export default ChatWidget;
