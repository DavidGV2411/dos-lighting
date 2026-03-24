import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChatWidget from "./ChatWidget";

vi.mock("../services/chatService", () => ({
  sendChatMessage: vi.fn()
}));

const { sendChatMessage } = await import("../services/chatService");

function buildRecommendation() {
  return {
    nivelConfianza: "alta",
    mensaje: "Recomendacion lista.",
    resultados: [
      {
        posicionLuz: "cruce",
        productos: [
          {
            rank: 1,
            productoId: 1,
            modelo: "Nebula X",
            gama: "premium",
            casquilloCodigo: "H4",
            puntajeTotal: 18,
            motivos: ["Mejor visibilidad nocturna"]
          }
        ]
      }
    ]
  };
}

describe("ChatWidget", () => {
  beforeEach(() => {
    sessionStorage.clear();
    sendChatMessage.mockReset();
  });

  it("abre y cierra el panel", () => {
    render(<ChatWidget show />);

    fireEvent.click(screen.getByRole("button", { name: /abrir chatbot/i }));
    expect(screen.getByLabelText(/asesor virtual dos lighting/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /minimizar chat/i }));
    expect(screen.queryByLabelText(/asesor virtual dos lighting/i)).not.toBeInTheDocument();
  });

  it("envia mensaje y muestra la respuesta", async () => {
    sendChatMessage.mockResolvedValue({
      sessionId: "abc",
      replyText: "Necesito la marca de tu vehiculo.",
      quickReplies: []
    });

    render(<ChatWidget show />);
    fireEvent.click(screen.getByRole("button", { name: /abrir chatbot/i }));
    fireEvent.change(screen.getByPlaceholderText(/escribe tu duda/i), {
      target: { value: "Quiero una recomendacion" }
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));

    await waitFor(() => {
      expect(sendChatMessage).toHaveBeenCalledWith({
        sessionId: null,
        message: "Quiero una recomendacion"
      });
    });

    expect(
      await screen.findByText("Necesito la marca de tu vehiculo.")
    ).toBeInTheDocument();
  });

  it("restaura el transcript desde sessionStorage", () => {
    sessionStorage.setItem(
      "dos_lighting_chat_state",
      JSON.stringify({
        isOpen: true,
        sessionId: "saved-session",
        messages: [
          {
            id: "1",
            role: "assistant",
            text: "Bienvenido otra vez",
            quickReplies: [],
            recommendation: null
          }
        ]
      })
    );

    render(<ChatWidget show />);
    expect(screen.getByText("Bienvenido otra vez")).toBeInTheDocument();
  });

  it("muestra error amigable si el servicio falla", async () => {
    sendChatMessage.mockRejectedValue(new Error("Servicio caido"));

    render(<ChatWidget show />);
    fireEvent.click(screen.getByRole("button", { name: /abrir chatbot/i }));
    fireEvent.change(screen.getByPlaceholderText(/escribe tu duda/i), {
      target: { value: "Hola" }
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));

    expect(await screen.findByText(/servicio caido/i)).toBeInTheDocument();
    expect(
      await screen.findByText(/puedes seguir con la encuesta normal/i)
    ).toBeInTheDocument();
  });

  it("renderiza recomendacion estructurada cuando llega del backend", async () => {
    sendChatMessage.mockResolvedValue({
      sessionId: "abc",
      replyText: "Ya tengo una recomendacion para ti.",
      recommendation: buildRecommendation(),
      quickReplies: []
    });

    render(<ChatWidget show />);
    fireEvent.click(screen.getByRole("button", { name: /abrir chatbot/i }));
    fireEvent.change(screen.getByPlaceholderText(/escribe tu duda/i), {
      target: { value: "Dame la recomendacion" }
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));

    expect(await screen.findByText("Nebula X")).toBeInTheDocument();
    expect(screen.getByText(/confianza: alta/i)).toBeInTheDocument();
  });
});
