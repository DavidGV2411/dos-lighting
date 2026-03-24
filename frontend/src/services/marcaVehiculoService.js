import { apiRequestV1 } from "./http";

export async function getMarcasVehiculoCrud() {
  return apiRequestV1("/marcas-vehiculo");
}

export async function createMarcaVehiculo(payload) {
  return apiRequestV1("/marcas-vehiculo", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateMarcaVehiculo(id, payload) {
  return apiRequestV1(`/marcas-vehiculo/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function deleteMarcaVehiculo(id) {
  return apiRequestV1(`/marcas-vehiculo/${id}`, {
    method: "DELETE"
  });
}
