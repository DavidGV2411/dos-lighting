import cron from "node-cron";
import { config } from "../config.js";
import { pool } from "../db/pool.js";

const toIsoMinusDays = (days: number): string =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const runRetentionPolicy = async (): Promise<void> => {
  const fechaAnonimizar = toIsoMinusDays(config.retention.diasAnonimizar);
  const fechaEliminarRecomendaciones = toIsoMinusDays(config.retention.diasEliminarRecomendaciones);
  const fechaEliminarConsultas = toIsoMinusDays(config.retention.diasEliminarConsultas);

  const anonimizadas = await pool.query(
    `
    UPDATE consultas
    SET nombre_cliente = CASE WHEN nombre_cliente IS NULL THEN NULL ELSE $2 END,
        telefono_cliente = CASE WHEN telefono_cliente IS NULL THEN NULL ELSE $3 END
    WHERE fecha < $1
      AND (nombre_cliente IS NOT NULL OR telefono_cliente IS NOT NULL)
      AND (
        nombre_cliente IS DISTINCT FROM $2
        OR telefono_cliente IS DISTINCT FROM $3
      )
    `,
    [fechaAnonimizar, config.retention.nombreAnonimo, config.retention.telefonoAnonimo]
  );

  const metricasActualizadas = await pool.query(
    `
    INSERT INTO metricas_recomendacion_diaria (
      fecha,
      total_consultas,
      top_producto_led_id,
      top_producto_recomendado_cantidad,
      updated_at
    )
    WITH base AS (
      SELECT CAST(DATE(c.fecha) AS DATE) AS fecha, COUNT(*) AS total_consultas
      FROM consultas c
      GROUP BY CAST(DATE(c.fecha) AS DATE)
    ),
    top_prod AS (
      SELECT
        t.fecha,
        t.id_producto_led,
        t.total_recomendaciones,
        ROW_NUMBER() OVER (
          PARTITION BY t.fecha
          ORDER BY t.total_recomendaciones DESC, t.id_producto_led ASC
        ) AS rn
      FROM (
        SELECT
          CAST(DATE(c.fecha) AS DATE) AS fecha,
          cr.id_producto_led,
          COUNT(*) AS total_recomendaciones
        FROM consultas c
        INNER JOIN consulta_recomendaciones cr ON cr.id_consulta = c.id
        WHERE cr.rank_posicion = 1
        GROUP BY CAST(DATE(c.fecha) AS DATE), cr.id_producto_led
      ) t
    )
    SELECT
      b.fecha,
      b.total_consultas,
      tp.id_producto_led,
      COALESCE(tp.total_recomendaciones, 0),
      NOW()
    FROM base b
    LEFT JOIN top_prod tp
      ON tp.fecha = b.fecha
     AND tp.rn = 1
    ON CONFLICT (fecha) DO UPDATE
    SET total_consultas = EXCLUDED.total_consultas,
        top_producto_led_id = EXCLUDED.top_producto_led_id,
        top_producto_recomendado_cantidad = EXCLUDED.top_producto_recomendado_cantidad,
        updated_at = NOW()
    `
  );

  const recomendacionesEliminadas = await pool.query(
    `
    DELETE FROM consulta_recomendaciones cr
    USING consultas c
    WHERE cr.id_consulta = c.id
      AND c.fecha < $1
    `,
    [fechaEliminarRecomendaciones]
  );

  const consultasEliminadas = await pool.query(
    `DELETE FROM consultas WHERE fecha < $1`,
    [fechaEliminarConsultas]
  );

  console.log(
    "Retencion ejecutada:",
    `anonimizadas=${anonimizadas.rowCount ?? 0},`,
    `metricasActualizadas=${metricasActualizadas.rowCount ?? 0},`,
    `recomendacionesEliminadas=${recomendacionesEliminadas.rowCount ?? 0},`,
    `consultasEliminadas=${consultasEliminadas.rowCount ?? 0}`
  );
};

export const startRetentionScheduler = (): void => {
  if (!config.retention.enabled) {
    return;
  }

  cron.schedule(config.retention.cron, () => {
    runRetentionPolicy().catch((error) => {
      console.error("Fallo al ejecutar retencion:", error);
    });
  });
};

