import { apiRequestV1 } from "./http";

export async function getModelosVehiculoCrud() {
  return apiRequestV1("/modelos-vehiculo");
}

export async function createModeloVehiculo(payload) {
  return apiRequestV1("/modelos-vehiculo", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateModeloVehiculo(id, payload) {
  return apiRequestV1(`/modelos-vehiculo/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function deleteModeloVehiculo(id) {
  return apiRequestV1(`/modelos-vehiculo/${id}`, {
    method: "DELETE"
  });
}
