import { apiRequestV1 } from "./http";

export async function getTiposVehiculo() {
  return apiRequestV1("/tipos-vehiculo");
}

export async function getMarcasVehiculo() {
  return apiRequestV1("/marcas-vehiculo");
}

export async function getModelosVehiculo() {
  return apiRequestV1("/modelos-vehiculo");
}

export async function getPerfilesUso() {
  return apiRequestV1("/perfiles-uso");
}

export async function getTiposPolarizado() {
  return apiRequestV1("/tipos-polarizado");
}

export async function getTiposSistemaOptico() {
  return apiRequestV1("/tipos-sistema-optico");
}

export async function getDecisionSistemaOptico(modeloId, anioVehiculo) {
  return apiRequestV1(
    `/modelos-vehiculo/${modeloId}/decision-sistema-optico?anioVehiculo=${encodeURIComponent(anioVehiculo)}`
  );
}

export async function getMarcasLed() {
  return apiRequestV1("/marcas-led");
}

export async function getCasquillos() {
  return apiRequestV1("/casquillos");
}

export async function getGamasLuz() {
  return apiRequestV1("/gamas-luz");
}

export async function getGeneracionesModelo() {
  return apiRequestV1("/generaciones-modelo");
}
