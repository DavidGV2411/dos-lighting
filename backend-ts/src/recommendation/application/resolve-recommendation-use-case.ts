import { RecommendationError } from "../domain/errors.js";
import {
  SCORE_MATRIX_POLARIZADO,
  buildRankedResults,
  resolveConfidenceLevel
} from "../domain/scoring.js";
import type {
  Compatibility,
  PerfilUsoActivo,
  ProductCandidate,
  RecommendationResult,
  ResolveRecommendationRequest
} from "../domain/types.js";
import type { RecommendationRepository } from "./ports.js";

const validateAnioVehiculo = (
  anioVehiculo: number,
  anioDesde: number,
  anioHasta: number | null
): void => {
  const fueraInferior = anioVehiculo < anioDesde;
  const fueraSuperior = anioHasta != null && anioVehiculo > anioHasta;
  if (fueraInferior || fueraSuperior) {
    throw new RecommendationError(
      422,
      "BUSINESS_RULE_ERROR",
      `anioVehiculo fuera del rango del modelo seleccionado: ${anioDesde}-${anioHasta == null ? "actual" : anioHasta}`
    );
  }
};

const confidenceMessage = (nivelConfianza: string): string =>
  nivelConfianza === "alta"
    ? "Recomendacion resuelta con coincidencia exacta y datos completos."
    : nivelConfianza === "media"
      ? "Recomendacion resuelta por coincidencia de rango/generacion."
      : "Recomendacion resuelta con fallback por datos faltantes o parciales.";

export class ResolveRecommendationUseCase {
  constructor(private readonly repository: RecommendationRepository) {}

  async execute(request: ResolveRecommendationRequest): Promise<RecommendationResult> {
    const modelo = await this.repository.findModelForBrand(request.modeloId, request.marcaId);
    if (!modelo) {
      throw new RecommendationError(
        422,
        "BUSINESS_RULE_ERROR",
        "El modelo no existe o no pertenece a la marca indicada."
      );
    }

    validateAnioVehiculo(request.anioVehiculo, modelo.anioDesde, modelo.anioHasta);

    const perfilHorario = await this.getActivePerfil(
      request.horarioManejoPerfilId,
      "horario_manejo",
      "horarioManejoPerfilId"
    );
    const perfilZona = await this.getActivePerfil(
      request.zonaManejoPerfilId,
      "zona_manejo",
      "zonaManejoPerfilId"
    );
    const perfilUsoVehiculo = await this.getActivePerfil(
      request.usoVehiculoPerfilId,
      "uso_vehiculo",
      "usoVehiculoPerfilId"
    );

    const tipoPolarizado = await this.repository.findActiveTintById(request.tipoPolarizadoId);
    if (!tipoPolarizado) {
      throw new RecommendationError(
        422,
        "BUSINESS_RULE_ERROR",
        `tipoPolarizadoId no existe o esta inactivo: ${request.tipoPolarizadoId}`
      );
    }

    if (!SCORE_MATRIX_POLARIZADO[tipoPolarizado.codigo]) {
      throw new RecommendationError(
        422,
        "BUSINESS_RULE_ERROR",
        `tipoPolarizadoId tiene codigo no soportado para scoring: ${tipoPolarizado.codigo}`
      );
    }

    let fallbackPorDatoClave = false;
    let fallbackPorRango = false;
    let tipoSistemaOpticoCodigo: string | null = null;

    if (request.tipoSistemaOpticoId != null) {
      tipoSistemaOpticoCodigo = await this.repository.findActiveOpticalSystemCodeById(
        request.tipoSistemaOpticoId
      );
      if (!tipoSistemaOpticoCodigo) {
        throw new RecommendationError(
          422,
          "BUSINESS_RULE_ERROR",
          `tipoSistemaOpticoId no existe o esta inactivo: ${request.tipoSistemaOpticoId}`
        );
      }
      if (tipoSistemaOpticoCodigo === "ambos") {
        fallbackPorDatoClave = true;
      }
    } else {
      fallbackPorDatoClave = true;
    }

    const generaciones = await this.repository.findGenerationsForModelYear(
      request.modeloId,
      request.anioVehiculo
    );
    const generacion = generaciones[0] ?? null;
    if (!generacion) {
      fallbackPorRango = true;
    }

    let usedGenerationSpecific = false;
    let compatibilidades: Compatibility[] = [];

    if (generacion) {
      compatibilidades = await this.repository.findCompatibilitiesForGeneration(
        request.modeloId,
        generacion.id,
        request.anioVehiculo
      );
      if (compatibilidades.length > 0) {
        usedGenerationSpecific = true;
      }
    }

    if (compatibilidades.length === 0) {
      if (generacion) {
        fallbackPorRango = true;
      }
      compatibilidades = await this.repository.findCompatibilitiesForModelYear(
        request.modeloId,
        request.anioVehiculo
      );
    }

    const perfiles = {
      horarioManejo: perfilHorario,
      zonaManejo: perfilZona,
      usoVehiculo: perfilUsoVehiculo
    };
    const idsPerfilUnicos = [...new Set([perfilHorario.id, perfilZona.id, perfilUsoVehiculo.id])];

    if (compatibilidades.length === 0) {
      return this.saveAndBuildEmptyResult(
        request,
        modelo.id,
        generacion?.id ?? null,
        "No se encontro compatibilidad activa para el vehiculo y anio indicado.",
        perfiles,
        tipoPolarizado.codigo,
        idsPerfilUnicos
      );
    }

    const tiposOpticosCompatibles = [
      ...new Set(
        compatibilidades
          .map((item) => item.tipoSistemaOptico)
          .filter((value): value is string => Boolean(value && value.trim()))
      )
    ];

    if (tiposOpticosCompatibles.length > 1) {
      if (!tipoSistemaOpticoCodigo || tipoSistemaOpticoCodigo === "ambos") {
        throw new RecommendationError(
          422,
          "BUSINESS_RULE_ERROR",
          "Para este modelo y anio existen versiones con y sin proyector. Indica si tu vehiculo tiene faros con lupa/proyector."
        );
      }

      compatibilidades = compatibilidades.filter(
        (item) => item.tipoSistemaOptico === tipoSistemaOpticoCodigo
      );

      if (compatibilidades.length === 0) {
        throw new RecommendationError(
          422,
          "BUSINESS_RULE_ERROR",
          "El tipo de sistema optico seleccionado no aplica para el modelo y anio indicados."
        );
      }

      fallbackPorDatoClave = false;
    } else if (tiposOpticosCompatibles.length === 1) {
      tipoSistemaOpticoCodigo = tiposOpticosCompatibles[0];
      fallbackPorDatoClave = false;
    }

    const candidates = await this.findCandidates(compatibilidades, tipoSistemaOpticoCodigo);

    if (candidates.length === 0) {
      return this.saveAndBuildEmptyResult(
        request,
        modelo.id,
        generacion?.id ?? null,
        "Se encontro compatibilidad, pero no hay inventario disponible para ese casquillo y sistema optico.",
        perfiles,
        tipoPolarizado.codigo,
        idsPerfilUnicos
      );
    }

    const idsCasquillo = [...new Set(candidates.map((item) => item.idCasquillo))];
    const casquillos = idsCasquillo.length
      ? await this.repository.findCasquilloCodes(idsCasquillo)
      : [];
    const casquilloCodigoPorId = new Map(casquillos.map((item) => [item.id, item.codigo]));

    const ranked = buildRankedResults(
      candidates,
      casquilloCodigoPorId,
      {
        horario: perfilHorario.valor,
        zona: perfilZona.valor,
        uso: perfilUsoVehiculo.valor
      },
      tipoPolarizado.codigo
    );

    fallbackPorDatoClave = fallbackPorDatoClave || ranked.fallbackPorDatoClave;

    const nivelConfianza = resolveConfidenceLevel(
      fallbackPorDatoClave,
      usedGenerationSpecific,
      fallbackPorRango
    );
    const mensaje = confidenceMessage(nivelConfianza);
    const consultaId = await this.repository.saveConsultation({
      request,
      modeloId: modelo.id,
      generacionModeloId: generacion?.id ?? null,
      nivelConfianza,
      mensaje,
      perfiles,
      polarizadoCodigo: tipoPolarizado.codigo,
      idsPerfilScoring: idsPerfilUnicos,
      resultados: ranked.resultados,
      filasPersistencia: ranked.filasPersistencia
    });

    return {
      consultaId,
      nivelConfianza,
      mensaje,
      marcaId: request.marcaId,
      modeloId: request.modeloId,
      generacionModeloId: generacion?.id ?? null,
      anioVehiculo: request.anioVehiculo,
      resultados: ranked.resultados
    };
  }

  private async getActivePerfil(
    id: number,
    categoria: "horario_manejo" | "zona_manejo" | "uso_vehiculo",
    fieldName: string
  ): Promise<PerfilUsoActivo> {
    const perfil = await this.repository.findActivePerfilByCategory(id, categoria);
    if (!perfil) {
      throw new RecommendationError(
        422,
        "BUSINESS_RULE_ERROR",
        `${fieldName} no existe, no pertenece a ${categoria} o esta inactivo: ${id}`
      );
    }
    return perfil;
  }

  private async findCandidates(
    compatibilidades: Compatibility[],
    tipoSistemaOpticoCodigo: string | null
  ): Promise<ProductCandidate[]> {
    const candidates: ProductCandidate[] = [];

    for (const compatibilidad of compatibilidades) {
      let tipoOpticoAplicado = tipoSistemaOpticoCodigo;
      if (!tipoOpticoAplicado || tipoOpticoAplicado.trim() === "") {
        tipoOpticoAplicado = compatibilidad.tipoSistemaOptico;
      }

      if (tipoOpticoAplicado === "ambos") {
        tipoOpticoAplicado = null;
      }

      const productosCompatibles = await this.repository.findCompatibleProducts(
        compatibilidad.idCasquillo,
        compatibilidad.posicionLuz,
        tipoOpticoAplicado
      );

      for (const producto of productosCompatibles) {
        candidates.push({
          posicionLuz: compatibilidad.posicionLuz,
          idCasquillo: compatibilidad.idCasquillo,
          producto
        });
      }
    }

    return candidates;
  }

  private async saveAndBuildEmptyResult(
    request: ResolveRecommendationRequest,
    modeloId: number,
    generacionModeloId: number | null,
    mensaje: string,
    perfiles: {
      horarioManejo: PerfilUsoActivo;
      zonaManejo: PerfilUsoActivo;
      usoVehiculo: PerfilUsoActivo;
    },
    polarizadoCodigo: string,
    idsPerfilScoring: number[]
  ): Promise<RecommendationResult> {
    const nivelConfianza = "baja";
    const consultaId = await this.repository.saveConsultation({
      request,
      modeloId,
      generacionModeloId,
      nivelConfianza,
      mensaje,
      perfiles,
      polarizadoCodigo,
      idsPerfilScoring,
      resultados: [],
      filasPersistencia: []
    });

    return {
      consultaId,
      nivelConfianza,
      mensaje,
      marcaId: request.marcaId,
      modeloId: request.modeloId,
      generacionModeloId,
      anioVehiculo: request.anioVehiculo,
      resultados: []
    };
  }
}
