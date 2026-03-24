const CHAT_STATE_KEY = "dos_lighting_chat_state";

export function getStoredChatState() {
  const raw = sessionStorage.getItem(CHAT_STATE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredChatState(state) {
  sessionStorage.setItem(CHAT_STATE_KEY, JSON.stringify(state));
}

export function clearStoredChatState() {
  sessionStorage.removeItem(CHAT_STATE_KEY);
}
