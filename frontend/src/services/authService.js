import { apiRequestRoot } from "./http";
import { clearAuthSession, getAuthToken, getAuthUser, setAuthSession } from "./authStorage";

export function hasAuthSession() {
  return Boolean(getAuthToken());
}

export function getStoredAuthUser() {
  return getAuthUser();
}

export async function loginAdmin({ username, password }) {
  const response = await apiRequestRoot("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });

  setAuthSession(response.accessToken, response.user);
  return response.user;
}

export async function fetchAuthUser() {
  if (!getAuthToken()) {
    return null;
  }

  try {
    const response = await apiRequestRoot("/auth/me");
    if (!response?.user) {
      clearAuthSession();
      return null;
    }
    setAuthSession(getAuthToken(), response.user);
    return response.user;
  } catch {
    clearAuthSession();
    return null;
  }
}

export async function logoutAdmin() {
  if (!getAuthToken()) {
    clearAuthSession();
    return;
  }

  try {
    await apiRequestRoot("/auth/logout", { method: "POST" });
  } catch {
    // Ignora errores de red/estado para cerrar sesion localmente.
  } finally {
    clearAuthSession();
  }
}
