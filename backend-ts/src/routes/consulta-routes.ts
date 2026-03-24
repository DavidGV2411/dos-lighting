import { Router } from "express";
import { z } from "zod";
import { getPagination } from "../common/pagination.js";
import { AppError } from "../common/error/api-error.js";
import { toPageResponse } from "../common/api/page-response.js";
import { parseOrThrow } from "../common/validation.js";
import { query, queryOne } from "../db/pool.js";

const toNumber = (value: unknown): unknown => {
  if (value === "" || value == null) {
    return undefined;
  }
  return Number(value);
};

const historialQuerySchema = z.object({
  modeloId: z.preprocess(
    toNumber,
    z.number().int("modeloId debe ser entero").min(1, "modeloId debe ser mayor a 0").optional()
  ),
  fechaDesde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "fechaDesde debe tener formato YYYY-MM-DD")
    .optional(),
  fechaHasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "fechaHasta debe tener formato YYYY-MM-DD")
    .optional()
});

const metricasQuerySchema = z.object({
  dias: z.coerce.number().int("dias debe ser entero").min(1, "dias debe ser mayor a 0").max(3650, "dias excede el maximo"),
  topLimit: z.coerce
    .number()
    .int("topLimit debe ser entero")
    .min(1, "topLimit debe ser mayor a 0")
    .max(50, "topLimit excede el maximo")
});

const toUtcStart = (dateIso: string): Date => new Date(`${dateIso}T00:00:00.000Z`);

export const consultaRoutes = Router();

consultaRoutes.get("/api/v1/consultas/historial", async (req, res, next) => {
  try {
    const parsed = parseOrThrow(historialQuerySchema, req.query);
    const fechaDesdeDate = parsed.fechaDesde ? toUtcStart(parsed.fechaDesde) : null;
    const fechaHastaDate = parsed.fechaHasta ? toUtcStart(parsed.fechaHasta) : null;

    if (fechaDesdeDate && fechaHastaDate && fechaHastaDate < fechaDesdeDate) {
      throw new AppError(422, "BUSINESS_RULE_ERROR", "fechaHasta no puede ser menor que fechaDesde");
    }

    const fechaHastaExclusive = fechaHastaDate
      ? new Date(fechaHastaDate.getTime() + 24 * 60 * 60 * 1000)
      : null;

    const pagination = getPagination(req, {
      defaultSize: 20,
      maxSize: 200,
      defaultSortField: "fecha",
      defaultSortDirection: "DESC",
      sortFields: {
        fecha: "c.fecha",
        id: "c.id"
      }
    });

    const totalRow = await queryOne<{ total: number }>(
      `
      SELECT COUNT(*)::int AS total
      FROM consultas c
      WHERE ($1::int IS NULL OR c.id_modelo = $1)
        AND ($2::timestamptz IS NULL OR c.fecha >= $2)
        AND ($3::timestamptz IS NULL OR c.fecha < $3)
      `,
      [
        parsed.modeloId ?? null,
        fechaDesdeDate ? fechaDesdeDate.toISOString() : null,
        fechaHastaExclusive ? fechaHastaExclusive.toISOString() : null
      ]
    );

    const rows = await query<Record<string, unknown>>(
      `
      SELECT
        c.id AS "consultaId",
        c.fecha,
        c.id_marca AS "marcaId",
        c.id_modelo AS "modeloId",
        c.anio_vehiculo AS "anioVehiculo",
        c.id_perfil_uso AS "perfilUsoId",
        c.id_tipo_polarizado AS "tipoPolarizadoId",
        c.id_tipo_sistema_optico AS "tipoSistemaOpticoId",
        c.nivel_confianza AS "nivelConfianza",
        c.mensaje_resultado AS "mensajeResultado",
        c.top1_producto_id AS "top1ProductoId",
        c.nombre_cliente AS "nombreCliente",
        c.telefono_cliente AS "telefonoCliente"
      FROM consultas c
      WHERE ($1::int IS NULL OR c.id_modelo = $1)
        AND ($2::timestamptz IS NULL OR c.fecha >= $2)
        AND ($3::timestamptz IS NULL OR c.fecha < $3)
      ORDER BY ${pagination.sortColumn} ${pagination.sortDirection}
      LIMIT $4 OFFSET $5
      `,
      [
        parsed.modeloId ?? null,
        fechaDesdeDate ? fechaDesdeDate.toISOString() : null,
        fechaHastaExclusive ? fechaHastaExclusive.toISOString() : null,
        pagination.size,
        pagination.offset
      ]
    );

    res.json(
      toPageResponse(
        rows,
        pagination.page,
        pagination.size,
        Number(totalRow?.total ?? 0)
      )
    );
  } catch (error) {
    next(error);
  }
});

consultaRoutes.get("/api/v1/consultas/metricas-basicas", async (req, res, next) => {
  try {
    const queryInput = {
      dias: req.query.dias ?? 30,
      topLimit: req.query.topLimit ?? 5
    };
    const parsed = parseOrThrow(metricasQuerySchema, queryInput);
    const fechaDesde = new Date(Date.now() - parsed.dias * 24 * 60 * 60 * 1000);

    const consultasPorDia = await query<{
      fecha: string;
      totalConsultas: string | number;
    }>(
      `
      SELECT CAST(DATE(c.fecha) AS DATE) AS fecha, COUNT(*) AS "totalConsultas"
      FROM consultas c
      WHERE c.fecha >= $1
      GROUP BY CAST(DATE(c.fecha) AS DATE)
      ORDER BY fecha ASC
      `,
      [fechaDesde.toISOString()]
    );

    const topProductos = await query<{
      productoId: number;
      productoModelo: string;
      marcaLedId: number;
      totalRecomendaciones: string | number;
    }>(
      `
      SELECT
        cr.id_producto_led AS "productoId",
        p.modelo AS "productoModelo",
        p.id_marca_led AS "marcaLedId",
        COUNT(*) AS "totalRecomendaciones"
      FROM consulta_recomendaciones cr
      INNER JOIN consultas c ON c.id = cr.id_consulta
      INNER JOIN productos_led p ON p.id = cr.id_producto_led
      WHERE cr.rank_posicion = 1
        AND c.fecha >= $1
      GROUP BY cr.id_producto_led, p.modelo, p.id_marca_led
      ORDER BY "totalRecomendaciones" DESC, cr.id_producto_led ASC
      LIMIT $2
      `,
      [fechaDesde.toISOString(), parsed.topLimit]
    );

    res.json({
      rangoDias: parsed.dias,
      consultasPorDia: consultasPorDia.map((row) => ({
        fecha: row.fecha,
        totalConsultas: Number(row.totalConsultas)
      })),
      topProductosRecomendados: topProductos.map((row) => ({
        productoId: row.productoId,
        productoModelo: row.productoModelo,
        marcaLedId: row.marcaLedId,
        totalRecomendaciones: Number(row.totalRecomendaciones)
      }))
    });
  } catch (error) {
    next(error);
  }
});
