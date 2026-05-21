import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../common/error/api-error.js";
import { parseOrThrow } from "../../common/validation.js";
import { DecideOpticalSystemUseCase } from "../application/decide-optical-system-use-case.js";
import { ResolveRecommendationUseCase } from "../application/resolve-recommendation-use-case.js";
import { RecommendationError } from "../domain/errors.js";
import { PostgresRecommendationRepository } from "../infrastructure/postgres-recommendation-repository.js";
import {
  decisionSistemaOpticoQuerySchema,
  resolveRecommendationRequestSchema
} from "./recommendation-schemas.js";

const repository = new PostgresRecommendationRepository();
const resolveRecommendationUseCase = new ResolveRecommendationUseCase(repository);
const decideOpticalSystemUseCase = new DecideOpticalSystemUseCase(repository);

const mapRecommendationError = (error: unknown): unknown => {
  if (error instanceof RecommendationError) {
    return new AppError(error.status, error.code, error.message);
  }
  return error;
};

export const recomendacionRoutes = Router();

recomendacionRoutes.post("/api/recomendaciones/resolver", async (req, res, next) => {
  try {
    const request = parseOrThrow(resolveRecommendationRequestSchema, req.body);
    const result = await resolveRecommendationUseCase.execute(request);
    res.json(result);
  } catch (error) {
    next(mapRecommendationError(error));
  }
});

recomendacionRoutes.get("/api/v1/modelos-vehiculo/:modeloId/decision-sistema-optico", async (req, res, next) => {
  try {
    const modeloId = z.coerce.number().int().min(1, "modeloId invalido").parse(req.params.modeloId);
    const { anioVehiculo } = parseOrThrow(decisionSistemaOpticoQuerySchema, req.query);
    const result = await decideOpticalSystemUseCase.execute(modeloId, anioVehiculo);
    res.json(result);
  } catch (error) {
    next(mapRecommendationError(error));
  }
});
