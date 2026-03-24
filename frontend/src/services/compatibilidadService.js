import { apiRequestV1 } from "./http";
import { buildQueryString } from "../utils/format";

export async function getCompatibilidades(params = {}) {
  const query = buildQueryString(params);
  return apiRequestV1(`/compatibilidades-vehiculo-casquillo${query}`);
}

export async function getCompatibilidadById(id) {
  return apiRequestV1(`/compatibilidades-vehiculo-casquillo/${id}`);
}

export async function createCompatibilidad(payload) {
  return apiRequestV1("/compatibilidades-vehiculo-casquillo", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateCompatibilidad(id, payload) {
  return apiRequestV1(`/compatibilidades-vehiculo-casquillo/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function deleteCompatibilidad(id) {
  return apiRequestV1(`/compatibilidades-vehiculo-casquillo/${id}`, {
    method: "DELETE"
  });
}
