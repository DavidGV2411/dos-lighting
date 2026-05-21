import { RecommendationError } from "../domain/errors.js";
import type { OpticalSystemDecision } from "../domain/types.js";
import type { RecommendationRepository } from "./ports.js";

export class DecideOpticalSystemUseCase {
  constructor(private readonly repository: RecommendationRepository) {}

  async execute(modeloId: number, anioVehiculo: number): Promise<OpticalSystemDecision> {
    const modelo = await this.repository.findModelById(modeloId);
    if (!modelo) {
      throw new RecommendationError(404, "NOT_FOUND", `No existe modelo con id ${modeloId}`);
    }

    const fueraRangoInferior = anioVehiculo < modelo.anioDesde;
    const fueraRangoSuperior = modelo.anioHasta != null && anioVehiculo > modelo.anioHasta;
    if (fueraRangoInferior || fueraRangoSuperior) {
      throw new RecommendationError(
        422,
        "BUSINESS_RULE_ERROR",
        `anioVehiculo fuera del rango del modelo seleccionado: ${modelo.anioDesde}-${modelo.anioHasta ?? "actual"}`
      );
    }

    const options = await this.repository.findOpticalSystemOptions(modeloId, anioVehiculo);
    return {
      modeloId,
      anioVehiculo,
      requiresQuestion: options.length > 1,
      resolvedTipoSistemaOptico: options.length === 1 ? options[0] : null,
      options
    };
  }
}
