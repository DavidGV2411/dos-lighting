import { apiRequestRoot } from "./http";

export async function resolverRecomendaciones(payload) {
  return apiRequestRoot("/recomendaciones/resolver", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
