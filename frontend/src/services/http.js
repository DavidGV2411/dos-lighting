import { API_ROOT_BASE_URL, API_V1_BASE_URL } from "../constants/apiConfig";
import { clearAuthSession, getAuthToken } from "./authStorage";

function normalizeError(errorBody, fallbackMessage) {
  if (!errorBody) {
    return { message: fallbackMessage, details: [] };
  }

  if (typeof errorBody === "string") {
    return { message: errorBody, details: [] };
  }

  const message = errorBody?.message || errorBody?.error?.message || fallbackMessage;
  const details = errorBody?.details || errorBody?.error?.details || [];

  return { message, details };
}

async function parseBody(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  const text = await response.text();
  return text || null;
}

export async function apiRequest(path, options = {}, baseUrl = API_V1_BASE_URL) {
  const url = `${baseUrl}${path}`;

  const method = (options.method || "GET").toUpperCase();

  // Solo agrega Content-Type si realmente vas a enviar body (POST/PUT/PATCH)
  const shouldSendJsonContentType =
    options.body != null && method !== "GET" && method !== "HEAD";

  const mergedHeaders = {
    ...(shouldSendJsonContentType ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {})
  };
  const token = getAuthToken();
  const hasAuthorizationHeader =
    Object.hasOwn(mergedHeaders, "Authorization") || Object.hasOwn(mergedHeaders, "authorization");
  if (token && !hasAuthorizationHeader) {
    mergedHeaders.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: mergedHeaders
    });
  } catch {
    const error = new Error("No se pudo conectar con el servidor.");
    error.status = 0;
    error.details = [];
    throw error;
  }

  const body = await parseBody(response);

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthSession();
    }
    const normalized = normalizeError(body, "Error al procesar la solicitud.");
    const error = new Error(normalized.message);
    error.status = response.status;
    error.details = normalized.details;
    throw error;
  }

  return body;
}

export async function apiRequestV1(path, options = {}) {
  return apiRequest(path, options, API_V1_BASE_URL);
}

export async function apiRequestRoot(path, options = {}) {
  return apiRequest(path, options, API_ROOT_BASE_URL);
}
