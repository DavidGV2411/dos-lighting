import type {
  Compatibility,
  GeneracionModelo,
  PerfilCategoria,
  PerfilUsoActivo,
  ProductLed,
  SaveConsultationInput,
  TipoPolarizado,
  VehicleModel
} from "../domain/types.js";
import type { RecommendationRepository } from "../application/ports.js";
import { query, queryOne, withTransaction } from "../../db/pool.js";

export class PostgresRecommendationRepository implements RecommendationRepository {
  async findModelForBrand(modeloId: number, marcaId: number): Promise<VehicleModel | null> {
    return queryOne<VehicleModel>(
      `
      SELECT id, id_marca AS "idMarca", anio_desde AS "anioDesde", anio_hasta AS "anioHasta"
      FROM modelos_vehiculo
      WHERE id = $1 AND id_marca = $2
      `,
      [modeloId, marcaId]
    );
  }

  async findModelById(modeloId: number): Promise<VehicleModel | null> {
    return queryOne<VehicleModel>(
      `
      SELECT id, anio_desde AS "anioDesde", anio_hasta AS "anioHasta"
      FROM modelos_vehiculo
      WHERE id = $1
      `,
      [modeloId]
    );
  }

  async findActivePerfilByCategory(
    id: number,
    categoria: PerfilCategoria
  ): Promise<PerfilUsoActivo | null> {
    return queryOne<PerfilUsoActivo>(
      `
      SELECT id, categoria, valor, descripcion
      FROM perfiles_uso
      WHERE id = $1
        AND categoria = $2
        AND activo = true
      `,
      [id, categoria]
    );
  }

  async findActiveTintById(id: number): Promise<TipoPolarizado | null> {
    return queryOne<TipoPolarizado>(
      `SELECT id, codigo FROM tipos_polarizado WHERE id = $1 AND activo = true`,
      [id]
    );
  }

  async findActiveOpticalSystemCodeById(id: number): Promise<string | null> {
    const row = await queryOne<{ codigo: string }>(
      `SELECT codigo FROM tipos_sistema_optico WHERE id = $1 AND activo = true`,
      [id]
    );
    return row?.codigo ?? null;
  }

  async findGenerationsForModelYear(
    modeloId: number,
    anioVehiculo: number
  ): Promise<GeneracionModelo[]> {
    return query<GeneracionModelo>(
      `
      SELECT id, id_modelo AS "idModelo", anio_desde AS "anioDesde", anio_hasta AS "anioHasta"
      FROM generaciones_modelo
      WHERE id_modelo = $1
        AND activo = true
        AND anio_desde <= $2
        AND (anio_hasta IS NULL OR anio_hasta >= $2)
      ORDER BY anio_desde DESC
      `,
      [modeloId, anioVehiculo]
    );
  }

  async findCompatibilitiesForGeneration(
    modeloId: number,
    generationId: number,
    anioVehiculo: number
  ): Promise<Compatibility[]> {
    return query<Compatibility>(
      `
      SELECT
        id,
        id_modelo AS "idModelo",
        id_generacion_modelo AS "idGeneracionModelo",
        anio_desde AS "anioDesde",
        anio_hasta AS "anioHasta",
        posicion_luz AS "posicionLuz",
        id_casquillo AS "idCasquillo",
        tipo_sistema_optico AS "tipoSistemaOptico"
      FROM compatibilidad_vehiculo_casquillo
      WHERE id_modelo = $1
        AND id_generacion_modelo = $2
        AND activo = true
        AND anio_desde <= $3
        AND (anio_hasta IS NULL OR anio_hasta >= $3)
      ORDER BY id ASC
      `,
      [modeloId, generationId, anioVehiculo]
    );
  }

  async findCompatibilitiesForModelYear(
    modeloId: number,
    anioVehiculo: number
  ): Promise<Compatibility[]> {
    return query<Compatibility>(
      `
      SELECT
        id,
        id_modelo AS "idModelo",
        id_generacion_modelo AS "idGeneracionModelo",
        anio_desde AS "anioDesde",
        anio_hasta AS "anioHasta",
        posicion_luz AS "posicionLuz",
        id_casquillo AS "idCasquillo",
        tipo_sistema_optico AS "tipoSistemaOptico"
      FROM compatibilidad_vehiculo_casquillo
      WHERE id_modelo = $1
        AND activo = true
        AND anio_desde <= $2
        AND (anio_hasta IS NULL OR anio_hasta >= $2)
      ORDER BY id ASC
      `,
      [modeloId, anioVehiculo]
    );
  }

  async findCompatibleProducts(
    idCasquillo: number,
    posicionLuz: string,
    tipoSistemaOptico: string | null
  ): Promise<ProductLed[]> {
    return query<ProductLed>(
      `
      SELECT
        p.id,
        p.id_marca_led AS "idMarcaLed",
        p.modelo,
        p.id_casquillo AS "idCasquillo",
        p.posicion_aplicable AS "posicionAplicable",
        p.sistema_optico_compatible AS "sistemaOpticoCompatible",
        p.lumens,
        p.potencia_watts AS "potenciaWatts",
        g.nombre AS "gamaNombre"
      FROM productos_led p
      LEFT JOIN gamas_luz g ON g.id = p.id_gama_luz
      WHERE p.disponible = true
        AND p.id_casquillo = $1
        AND (p.posicion_aplicable = $2 OR p.posicion_aplicable = 'todos')
        AND (
          $3::text IS NULL
          OR p.sistema_optico_compatible = 'ambos'
          OR p.sistema_optico_compatible = $3
        )
      ORDER BY p.id ASC
      `,
      [idCasquillo, posicionLuz, tipoSistemaOptico]
    );
  }

  async findCasquilloCodes(ids: number[]): Promise<Array<{ id: number; codigo: string }>> {
    if (!ids.length) {
      return [];
    }
    return query<{ id: number; codigo: string }>(
      `SELECT id, codigo FROM casquillos WHERE id = ANY($1::int[])`,
      [ids]
    );
  }

  async findOpticalSystemOptions(modeloId: number, anioVehiculo: number): Promise<string[]> {
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
    return tipos.map((row) => row.tipoSistemaOptico);
  }

  async saveConsultation(input: SaveConsultationInput): Promise<number> {
    const perfilesSeleccionados = {
      horarioManejoPerfilId: input.request.horarioManejoPerfilId,
      zonaManejoPerfilId: input.request.zonaManejoPerfilId,
      usoVehiculoPerfilId: input.request.usoVehiculoPerfilId,
      tipoPolarizadoId: input.request.tipoPolarizadoId,
      tipoPolarizadoCodigo: input.polarizadoCodigo,
      tipoSistemaOpticoId: input.request.tipoSistemaOpticoId ?? null,
      horarioManejoValor: input.perfiles.horarioManejo.valor,
      zonaManejoValor: input.perfiles.zonaManejo.valor,
      usoVehiculoValor: input.perfiles.usoVehiculo.valor,
      idsPerfilScoring: input.idsPerfilScoring,
      generacionModeloId: input.generacionModeloId
    };

    const resultadoJson = {
      nivelConfianza: input.nivelConfianza,
      mensaje: input.mensaje,
      totalPosiciones: input.resultados.length,
      totalProductos: input.resultados.reduce((sum, item) => sum + item.productos.length, 0),
      resultados: input.resultados
    };

    const top1ProductoId =
      input.filasPersistencia
        .slice()
        .sort((left, right) => {
          if (right.puntajeTotal !== left.puntajeTotal) {
            return right.puntajeTotal - left.puntajeTotal;
          }
          return left.rankPosicion - right.rankPosicion;
        })[0]?.idProductoLed ?? null;

    return withTransaction(async (client) => {
      const inserted = await client.query<{ id: number }>(
        `
        INSERT INTO consultas (
          fecha,
          id_marca,
          id_modelo,
          anio_vehiculo,
          id_perfil_uso,
          id_tipo_polarizado,
          id_tipo_sistema_optico,
          nivel_confianza,
          mensaje_resultado,
          perfiles_seleccionados,
          resultado_json,
          top1_producto_id
        )
        VALUES (
          NOW(),
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9::jsonb,
          $10::jsonb,
          $11
        )
        RETURNING id
        `,
        [
          input.request.marcaId,
          input.modeloId,
          input.request.anioVehiculo,
          input.request.horarioManejoPerfilId,
          input.request.tipoPolarizadoId,
          input.request.tipoSistemaOpticoId ?? null,
          input.nivelConfianza,
          input.mensaje,
          JSON.stringify(perfilesSeleccionados),
          JSON.stringify(resultadoJson),
          top1ProductoId
        ]
      );

      const consultaId = inserted.rows[0].id;

      for (const row of input.filasPersistencia) {
        await client.query(
          `
          INSERT INTO consulta_recomendaciones (
            id_consulta,
            posicion_luz,
            id_producto_led,
            puntaje_total,
            rank_posicion,
            motivos_json
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb)
          `,
          [
            consultaId,
            row.posicionLuz,
            row.idProductoLed,
            row.puntajeTotal,
            row.rankPosicion,
            JSON.stringify(row.motivos)
          ]
        );
      }

      return consultaId;
    });
  }
}
