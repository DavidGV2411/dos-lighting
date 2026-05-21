export type PerfilCategoria = "horario_manejo" | "zona_manejo" | "uso_vehiculo";
export type GamaKey = "baja" | "media" | "alta" | "premium" | "super premium";

export type ResolveRecommendationRequest = {
  marcaId: number;
  modeloId: number;
  anioVehiculo: number;
  horarioManejoPerfilId: number;
  zonaManejoPerfilId: number;
  usoVehiculoPerfilId: number;
  tipoPolarizadoId: number;
  tipoSistemaOpticoId?: number | null;
};

export type VehicleModel = {
  id: number;
  idMarca?: number;
  anioDesde: number;
  anioHasta: number | null;
};

export type Compatibility = {
  id: number;
  idModelo: number;
  idGeneracionModelo: number | null;
  anioDesde: number;
  anioHasta: number | null;
  posicionLuz: string;
  idCasquillo: number;
  tipoSistemaOptico: string;
};

export type ProductLed = {
  id: number;
  idMarcaLed: number;
  modelo: string;
  idCasquillo: number;
  posicionAplicable: string;
  sistemaOpticoCompatible: string;
  lumens: number;
  potenciaWatts: number;
  gamaNombre: string | null;
};

export type ProductCandidate = {
  posicionLuz: string;
  idCasquillo: number;
  producto: ProductLed;
};

export type ProductResult = {
  rank: number;
  productoId: number;
  marcaLedId: number;
  modelo: string;
  gama: string | null;
  casquilloId: number;
  casquilloCodigo: string;
  puntajeTotal: number;
  motivos: string[];
};

export type PositionResult = {
  posicionLuz: string;
  productos: ProductResult[];
};

export type RecommendationResult = {
  consultaId: number;
  nivelConfianza: string;
  mensaje: string;
  marcaId: number;
  modeloId: number;
  generacionModeloId: number | null;
  anioVehiculo: number;
  resultados: PositionResult[];
};

export type ConsultationRecommendationRow = {
  posicionLuz: string;
  idProductoLed: number;
  puntajeTotal: number;
  rankPosicion: number;
  motivos: string[];
};

export type ProductAccumulated = {
  posicionLuz: string;
  idCasquillo: number;
  casquilloCodigo: string;
  producto: ProductLed;
  puntajeTotal: number;
  motivos: string[];
};

export type PerfilUsoActivo = {
  id: number;
  categoria: PerfilCategoria;
  valor: string;
  descripcion: string;
};

export type TipoPolarizado = {
  id: number;
  codigo: string;
};

export type GeneracionModelo = {
  id: number;
  idModelo: number;
  anioDesde: number;
  anioHasta: number | null;
};

export type SaveConsultationInput = {
  request: ResolveRecommendationRequest;
  modeloId: number;
  generacionModeloId: number | null;
  nivelConfianza: string;
  mensaje: string;
  perfiles: {
    horarioManejo: PerfilUsoActivo;
    zonaManejo: PerfilUsoActivo;
    usoVehiculo: PerfilUsoActivo;
  };
  polarizadoCodigo: string;
  idsPerfilScoring: number[];
  resultados: PositionResult[];
  filasPersistencia: ConsultationRecommendationRow[];
};

export type OpticalSystemDecision = {
  modeloId: number;
  anioVehiculo: number;
  requiresQuestion: boolean;
  resolvedTipoSistemaOptico: string | null;
  options: string[];
};
