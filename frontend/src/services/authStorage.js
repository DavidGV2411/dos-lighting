const AUTH_TOKEN_KEY = "luces_led_admin_token";
const AUTH_USER_KEY = "luces_led_admin_user";

export function getAuthToken() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function getAuthUser() {
  const raw = sessionStorage.getItem(AUTH_USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setAuthSession(token, user) {
  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user || null));
}

export function clearAuthSession() {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_USER_KEY);
}
