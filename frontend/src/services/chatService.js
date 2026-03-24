import { apiRequestRoot } from "./http";

export async function sendChatMessage(payload) {
  return apiRequestRoot("/chat/message", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getChatHealth() {
  return apiRequestRoot("/chat/health");
}
