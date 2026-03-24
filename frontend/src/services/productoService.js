import { apiRequestV1 } from "./http";
import { buildQueryString } from "../utils/format";

export async function getProductosLed(params = {}) {
  const query = buildQueryString(params);
  return apiRequestV1(`/productos-led${query}`);
}

export async function getProductoLedById(id) {
  return apiRequestV1(`/productos-led/${id}`);
}

export async function createProductoLed(payload) {
  return apiRequestV1("/productos-led", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateProductoLed(id, payload) {
  return apiRequestV1(`/productos-led/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function deleteProductoLed(id) {
  return apiRequestV1(`/productos-led/${id}`, {
    method: "DELETE"
  });
}
