import { Router } from "express";
import { z } from "zod";
import { AppError } from "../common/error/api-error.js";
import { parseOrThrow } from "../common/validation.js";
import { query, queryOne } from "../db/pool.js";

export const catalogRoutes = Router();

catalogRoutes.get("/api/v1/tipos-vehiculo", async (_req, res, next) => {
  try {
    const rows = await query<{ id: number; nombre: string; descripcion: string | null }>(
      `
      SELECT id, nombre, descripcion
      FROM tipos_vehiculo
      ORDER BY nombre ASC
      `
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

catalogRoutes.get("/api/v1/posiciones-luz", (_req, res) => {
  res.json([
    { code: "cruce", description: "Luz de cruce" },
    { code: "largo", description: "Luz larga" },
    { code: "cruce_y_largo", description: "Luz de cruce y larga" },
    { code: "antiniebla", description: "Luz antiniebla" },
    { code: "todos", description: "Aplica a todas las posiciones" }
  ]);
});

catalogRoutes.get("/api/v1/tipos-sistema-optico", (_req, res) => {
  res.json([
    { code: "lupa_proyector", description: "Lupa o proyector" },
    { code: "reflector_abierto", description: "Reflector abierto" },
    { code: "ambos", description: "Compatible con ambos" }
  ]);
});

const decisionSistemaOpticoQuerySchema = z.object({
  anioVehiculo: z.coerce.number().int().min(1900, "anioVehiculo invalido").max(2100, "anioVehiculo invalido")
});

catalogRoutes.get("/api/v1/modelos-vehiculo/:modeloId/decision-sistema-optico", async (req, res, next) => {
  try {
    const modeloId = z.coerce.number().int().min(1, "modeloId invalido").parse(req.params.modeloId);
    const { anioVehiculo } = parseOrThrow(decisionSistemaOpticoQuerySchema, req.query);

    const modelo = await queryOne<{ id: number; anioDesde: number; anioHasta: number | null }>(
      `
      SELECT id, anio_desde AS "anioDesde", anio_hasta AS "anioHasta"
      FROM modelos_vehiculo
      WHERE id = $1
      `,
      [modeloId]
    );

    if (!modelo) {
      throw new AppError(404, "NOT_FOUND", `No existe modelo con id ${modeloId}`);
    }

    const fueraRangoInferior = anioVehiculo < modelo.anioDesde;
    const fueraRangoSuperior = modelo.anioHasta != null && anioVehiculo > modelo.anioHasta;
    if (fueraRangoInferior || fueraRangoSuperior) {
      throw new AppError(
        422,
        "BUSINESS_RULE_ERROR",
        `anioVehiculo fuera del rango del modelo seleccionado: ${modelo.anioDesde}-${modelo.anioHasta ?? "actual"}`
      );
    }

    const tipos = await query<{ tipoSistemaOptico: string }>(
      `
      SELECT DISTINCT tipo_sistema_optico AS "tipoSistemaOptico"
      FROM compatibilidad_vehiculo_casquillo
      WHERE id_modelo = $1
        AND activo = true
        AND anio_desde <= $2
        AND (anio_hasta IS NULL OR anio_hasta >= $2)
      ORDER BY tipo_sistema_optico ASC
      `,
      [modeloId, anioVehiculo]
    );

    const opciones = tipos.map((row) => row.tipoSistemaOptico);
    const requiresQuestion = opciones.length > 1;
    const resolvedTipoSistemaOptico = opciones.length === 1 ? opciones[0] : null;

    res.json({
      modeloId,
      anioVehiculo,
      requiresQuestion,
      resolvedTipoSistemaOptico,
      options: opciones
    });
  } catch (error) {
    next(error);
  }
});
