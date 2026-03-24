import { Router } from "express";
import { z } from "zod";
import { AppError } from "../common/error/api-error.js";
import { parseOrThrow } from "../common/validation.js";
import { query, queryOne, withTransaction } from "../db/pool.js";

type Compatibilidad = {
  id: number;
  idModelo: number;
  idGeneracionModelo: number | null;
  anioDesde: number;
  anioHasta: number | null;
  posicionLuz: string;
  idCasquillo: number;
  tipoSistemaOptico: string;
};

type ProductoLed = {
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

type PosicionResultado = {
  posicionLuz: string;
  productos: ProductoResultado[];
};

type ProductoResultado = {
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

type ConsultaRecomendacionRow = {
  posicionLuz: string;
  idProductoLed: number;
  puntajeTotal: number;
  rankPosicion: number;
  motivos: string[];
};

type ProductoAcumulado = {
  posicionLuz: string;
  idCasquillo: number;
  casquilloCodigo: string;
  producto: ProductoLed;
  puntajeTotal: number;
  motivos: string[];
};

const POSICION_ORDEN: Record<string, number> = {
  cruce: 1,
  largo: 2,
  cruce_y_largo: 3,
  antiniebla: 4,
  todos: 5
};

type PerfilCategoria = "horario_manejo" | "zona_manejo" | "uso_vehiculo";
type GamaKey = "baja" | "media" | "alta" | "premium" | "super premium";
type ScoreByGama = Record<GamaKey, number>;
type ScoreMatrixByCategoria = Record<string, ScoreByGama>;
type MotiveByGama = Partial<Record<GamaKey, string>>;
type ClientMotiveByPerfil = Record<string, MotiveByGama>;
const SUPER_PREMIUM_WARNING =
  "Importante: esta gama requiere instalacion por un tecnico especializado. Sin la adaptacion electrica adecuada puede afectar el alternador y la bateria de tu vehiculo.";

const SCORE_MATRIX: Record<PerfilCategoria, ScoreMatrixByCategoria> = {
  horario_manejo: {
    diurno: { baja: 3, media: 2, alta: 0, premium: -2, "super premium": -4 },
    mixto: { baja: 1, media: 3, alta: 3, premium: 1, "super premium": 0 },
    nocturno: { baja: -2, media: 1, alta: 4, premium: 7, "super premium": 8 }
  },
  zona_manejo: {
    urbano: { baja: 3, media: 3, alta: 1, premium: -1, "super premium": -4 },
    carretera: { baja: -1, media: 2, alta: 4, premium: 6, "super premium": 5 },
    rural: { baja: -2, media: 1, alta: 4, premium: 7, "super premium": 6 },
    mixto: { baja: 1, media: 3, alta: 3, premium: 2, "super premium": 1 }
  },
  uso_vehiculo: {
    uso_personal: { baja: 2, media: 3, alta: 2, premium: 0, "super premium": -2 },
    trabajo: { baja: 0, media: 2, alta: 4, premium: 5, "super premium": 3 },
    offroad: { baja: -3, media: 0, alta: 3, premium: 6, "super premium": 8 }
  }
};

const SCORE_MATRIX_POLARIZADO: ScoreMatrixByCategoria = {
  "sin polarizado": { baja: 3, media: 2, alta: 0, premium: -1, "super premium": -3 },
  "70%": { baja: 2, media: 2, alta: 1, premium: -1, "super premium": -3 },
  "50%": { baja: 1, media: 3, alta: 2, premium: 0, "super premium": -2 },
  "35%": { baja: 0, media: 2, alta: 3, premium: 3, "super premium": 1 },
  "20%": { baja: -2, media: 1, alta: 4, premium: 6, "super premium": 7 },
  "5%": { baja: -4, media: -1, alta: 3, premium: 7, "super premium": 10 }
};

const CLIENT_MOTIVES_BY_CATEGORY: Record<PerfilCategoria, ClientMotiveByPerfil> = {
  horario_manejo: {
    nocturno: {
      "super premium":
        "Manejas principalmente de noche; esta gama garantiza maxima visibilidad en oscuridad total.",
      premium:
        "Para conduccion nocturna frecuente, esta potencia ofrece un haz amplio y seguro.",
      alta:
        "Buena opcion para uso nocturno, mejora significativamente la visibilidad frente a una bombilla estandar."
    },
    diurno: {
      baja:
        "Para uso mayormente diurno esta gama es suficiente y eficiente en consumo energetico."
    }
  },
  zona_manejo: {
    rural: {
      "super premium":
        "Las zonas rurales tienen poca o nula iluminacion vial; esta gama te da el alcance necesario para reaccionar a tiempo.",
      premium:
        "Para carreteras rurales sin alumbrado publico, esta potencia cubre distancias largas con seguridad."
    },
    carretera: {
      alta:
        "En autopistas y carreteras esta potencia te permite ver con anticipacion curvas, animales y obstaculos."
    },
    urbano: {
      media:
        "Para conduccion urbana esta gama es ideal; potencia suficiente sin encandilar a otros conductores.",
      baja:
        "En ciudad con alumbrado publico esta gama es mas que suficiente y reduce el consumo electrico del vehiculo."
    }
  },
  uso_vehiculo: {
    offroad: {
      "super premium":
        "En terrenos exigentes sin iluminacion artificial, esta gama es la mas recomendada para tu seguridad.",
      premium:
        "Para uso en caminos destapados y montana, esta potencia mejora considerablemente tu campo visual."
    },
    trabajo: {
      alta:
        "Para vehiculos de uso laboral intensivo, esta gama ofrece durabilidad y rendimiento constante."
    },
    uso_personal: {
      media:
        "Para uso personal diario esta gama ofrece el mejor equilibrio entre rendimiento y precio.",
      baja:
        "Para desplazamientos cotidianos en buenas condiciones de luz, esta gama cubre tus necesidades perfectamente."
    }
  }
};

const CLIENT_MOTIVES_POLARIZADO: ClientMotiveByPerfil = {
  "5%": {
    "super premium":
      "Tu polarizado al 5% bloquea casi toda la luz exterior; necesitas la mayor potencia disponible para compensar esa perdida de visibilidad.",
    premium:
      "Con polarizado oscuro al 5% esta gama compensa efectivamente la reduccion de luz que entra al habitaculo."
  },
  "20%": {
    alta:
      "Tu polarizado al 20% reduce bastante la visibilidad nocturna; esta potencia lo compensa de forma segura."
  },
  "35%": {
    media:
      "Con polarizado medio al 35% esta gama mantiene buena visibilidad sin exceso de potencia."
  },
  "50%": {
    media:
      "Tu polarizado al 50% tiene un impacto leve en la visibilidad; esta gama lo compensa sin necesidad de mayor potencia."
  },
  "70%": {
    baja:
      "Tu polarizado casi transparente al 70% no afecta significativamente la visibilidad, cualquier gama funciona bien."
  },
  "sin polarizado": {
    baja:
      "Sin polarizado tienes visibilidad completa; esta gama es eficiente para tus condiciones de manejo."
  }
};

const requestSchema = z.object({
  marcaId: z.coerce.number().int().min(1, "marcaId debe ser mayor a 0"),
  modeloId: z.coerce.number().int().min(1, "modeloId debe ser mayor a 0"),
  anioVehiculo: z.coerce.number().int().min(1900, "anioVehiculo invalido").max(2100, "anioVehiculo invalido"),
  horarioManejoPerfilId: z.coerce.number().int().min(1, "horarioManejoPerfilId debe ser mayor a 0"),
  zonaManejoPerfilId: z.coerce.number().int().min(1, "zonaManejoPerfilId debe ser mayor a 0"),
  usoVehiculoPerfilId: z.coerce.number().int().min(1, "usoVehiculoPerfilId debe ser mayor a 0"),
  tipoPolarizadoId: z.coerce.number().int().min(1, "tipoPolarizadoId debe ser mayor a 0"),
  tipoSistemaOpticoId: z.coerce.number().int().min(1, "tipoSistemaOpticoId debe ser mayor a 0").optional().nullable()
});

type PerfilUsoActivo = {
  id: number;
  categoria: PerfilCategoria;
  valor: string;
  descripcion: string;
};

const getGamaKey = (gamaNombre: string | null): GamaKey | null => {
  if (!gamaNombre) {
    return null;
  }
  const normalized = gamaNombre.trim().toLowerCase();
  if (
    normalized === "baja" ||
    normalized === "media" ||
    normalized === "alta" ||
    normalized === "premium" ||
    normalized === "super premium"
  ) {
    return normalized;
  }
  return null;
};

const factorFallbackMotivo = (categoria: PerfilCategoria, gamaKey: GamaKey): string => {
  if (categoria === "horario_manejo") {
    return `Segun tu horario de manejo, la gama ${gamaKey} es adecuada para mantener buena visibilidad.`;
  }
  if (categoria === "zona_manejo") {
    return `Segun tu zona de manejo, la gama ${gamaKey} ofrece un rendimiento adecuado.`;
  }
  return `Segun el uso de tu vehiculo, la gama ${gamaKey} es una alternativa coherente.`;
};

const scoreByPerfilFactor = (
  categoria: PerfilCategoria,
  valor: string,
  gamaKey: GamaKey
): { score: number; motivo: string } => {
  const scoreByGama = SCORE_MATRIX[categoria][valor];
  if (!scoreByGama) {
    return {
      score: 0,
      motivo: "Este factor no tiene una regla especifica configurada."
    };
  }
  const customMotivo = CLIENT_MOTIVES_BY_CATEGORY[categoria][valor]?.[gamaKey];
  return {
    score: scoreByGama[gamaKey],
    motivo: customMotivo ?? factorFallbackMotivo(categoria, gamaKey)
  };
};

const scoreByPolarizadoFactor = (
  polarizadoCodigo: string,
  gamaKey: GamaKey
): { score: number; motivo: string } => {
  const scoreByGama = SCORE_MATRIX_POLARIZADO[polarizadoCodigo];
  if (!scoreByGama) {
    return {
      score: 0,
      motivo: "No se encontro una regla especifica para ese nivel de polarizado."
    };
  }
  const customMotivo = CLIENT_MOTIVES_POLARIZADO[polarizadoCodigo]?.[gamaKey];
  return {
    score: scoreByGama[gamaKey],
    motivo:
      customMotivo ??
      `Este nivel de polarizado se compensa de forma adecuada con una gama ${gamaKey}.`
  };
};

const findActivePerfilByCategory = async (
  id: number,
  categoria: PerfilCategoria,
  fieldName: string
): Promise<PerfilUsoActivo> => {
  const perfil = await queryOne<PerfilUsoActivo>(
    `
    SELECT id, categoria, valor, descripcion
    FROM perfiles_uso
    WHERE id = $1
      AND categoria = $2
      AND activo = true
    `,
    [id, categoria]
  );

  if (!perfil) {
    throw new AppError(
      422,
      "BUSINESS_RULE_ERROR",
      `${fieldName} no existe, no pertenece a ${categoria} o esta inactivo: ${id}`
    );
  }

  return perfil;
};

const resolverNivelConfianza = (
  fallbackPorDatoClave: boolean,
  usedGenerationSpecific: boolean,
  fallbackPorRango: boolean
): string => {
  if (fallbackPorDatoClave) {
    return "baja";
  }
  if (usedGenerationSpecific) {
    return "alta";
  }
  if (fallbackPorRango) {
    return "media";
  }
  return "media";
};

const validateAnioVehiculo = (
  anioVehiculo: number,
  anioDesde: number,
  anioHasta: number | null
): void => {
  const fueraInferior = anioVehiculo < anioDesde;
  const fueraSuperior = anioHasta != null && anioVehiculo > anioHasta;
  if (fueraInferior || fueraSuperior) {
    throw new AppError(
      422,
      "BUSINESS_RULE_ERROR",
      `anioVehiculo fuera del rango del modelo seleccionado: ${anioDesde}-${anioHasta == null ? "actual" : anioHasta}`
    );
  }
};

const guardarConsulta = async (
  request: z.infer<typeof requestSchema>,
  modeloId: number,
  generacionModeloId: number | null,
  nivelConfianza: string,
  mensaje: string,
  perfiles: {
    horarioManejo: PerfilUsoActivo;
    zonaManejo: PerfilUsoActivo;
    usoVehiculo: PerfilUsoActivo;
  },
  polarizadoCodigo: string,
  idsPerfilScoring: number[],
  resultados: PosicionResultado[],
  filasPersistencia: ConsultaRecomendacionRow[]
): Promise<number> => {
  const perfilesSeleccionados = {
    horarioManejoPerfilId: request.horarioManejoPerfilId,
    zonaManejoPerfilId: request.zonaManejoPerfilId,
    usoVehiculoPerfilId: request.usoVehiculoPerfilId,
    tipoPolarizadoId: request.tipoPolarizadoId,
    tipoPolarizadoCodigo: polarizadoCodigo,
    tipoSistemaOpticoId: request.tipoSistemaOpticoId ?? null,
    horarioManejoValor: perfiles.horarioManejo.valor,
    zonaManejoValor: perfiles.zonaManejo.valor,
    usoVehiculoValor: perfiles.usoVehiculo.valor,
    idsPerfilScoring,
    generacionModeloId
  };

  const resultadoJson = {
    nivelConfianza,
    mensaje,
    totalPosiciones: resultados.length,
    totalProductos: resultados.reduce((sum, item) => sum + item.productos.length, 0),
    resultados
  };

  const top1ProductoId =
    filasPersistencia
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
        request.marcaId,
        modeloId,
        request.anioVehiculo,
        request.horarioManejoPerfilId,
        request.tipoPolarizadoId,
        request.tipoSistemaOpticoId ?? null,
        nivelConfianza,
        mensaje,
        JSON.stringify(perfilesSeleccionados),
        JSON.stringify(resultadoJson),
        top1ProductoId
      ]
    );

    const consultaId = inserted.rows[0].id;

    for (const row of filasPersistencia) {
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
};

export const recomendacionRoutes = Router();

recomendacionRoutes.post("/api/recomendaciones/resolver", async (req, res, next) => {
  try {
    const request = parseOrThrow(requestSchema, req.body);

    const modelo = await queryOne<{
      id: number;
      idMarca: number;
      anioDesde: number;
      anioHasta: number | null;
    }>(
      `
      SELECT id, id_marca AS "idMarca", anio_desde AS "anioDesde", anio_hasta AS "anioHasta"
      FROM modelos_vehiculo
      WHERE id = $1 AND id_marca = $2
      `,
      [request.modeloId, request.marcaId]
    );

    if (!modelo) {
      throw new AppError(422, "BUSINESS_RULE_ERROR", "El modelo no existe o no pertenece a la marca indicada.");
    }

    validateAnioVehiculo(request.anioVehiculo, modelo.anioDesde, modelo.anioHasta);

    const perfilHorario = await findActivePerfilByCategory(
      request.horarioManejoPerfilId,
      "horario_manejo",
      "horarioManejoPerfilId"
    );
    const perfilZona = await findActivePerfilByCategory(
      request.zonaManejoPerfilId,
      "zona_manejo",
      "zonaManejoPerfilId"
    );
    const perfilUsoVehiculo = await findActivePerfilByCategory(
      request.usoVehiculoPerfilId,
      "uso_vehiculo",
      "usoVehiculoPerfilId"
    );

    const tipoPolarizado = await queryOne<{ id: number; codigo: string }>(
      `SELECT id, codigo FROM tipos_polarizado WHERE id = $1 AND activo = true`,
      [request.tipoPolarizadoId]
    );
    if (!tipoPolarizado) {
      throw new AppError(
        422,
        "BUSINESS_RULE_ERROR",
        `tipoPolarizadoId no existe o esta inactivo: ${request.tipoPolarizadoId}`
      );
    }

    if (!SCORE_MATRIX_POLARIZADO[tipoPolarizado.codigo]) {
      throw new AppError(
        422,
        "BUSINESS_RULE_ERROR",
        `tipoPolarizadoId tiene codigo no soportado para scoring: ${tipoPolarizado.codigo}`
      );
    }

    let fallbackPorDatoClave = false;
    let fallbackPorRango = false;
    let tipoSistemaOpticoCodigo: string | null = null;

    if (request.tipoSistemaOpticoId != null) {
      const tipoSistemaOptico = await queryOne<{ codigo: string }>(
        `SELECT codigo FROM tipos_sistema_optico WHERE id = $1 AND activo = true`,
        [request.tipoSistemaOpticoId]
      );
      if (!tipoSistemaOptico) {
        throw new AppError(
          422,
          "BUSINESS_RULE_ERROR",
          `tipoSistemaOpticoId no existe o esta inactivo: ${request.tipoSistemaOpticoId}`
        );
      }
      tipoSistemaOpticoCodigo = tipoSistemaOptico.codigo;
      if (tipoSistemaOpticoCodigo === "ambos") {
        fallbackPorDatoClave = true;
      }
    } else {
      fallbackPorDatoClave = true;
    }

    const generaciones = await query<{
      id: number;
      idModelo: number;
      anioDesde: number;
      anioHasta: number | null;
    }>(
      `
      SELECT id, id_modelo AS "idModelo", anio_desde AS "anioDesde", anio_hasta AS "anioHasta"
      FROM generaciones_modelo
      WHERE id_modelo = $1
        AND activo = true
        AND anio_desde <= $2
        AND (anio_hasta IS NULL OR anio_hasta >= $2)
      ORDER BY anio_desde DESC
      `,
      [request.modeloId, request.anioVehiculo]
    );

    const generacion = generaciones[0] ?? null;
    if (!generacion) {
      fallbackPorRango = true;
    }

    let usedGenerationSpecific = false;
    let compatibilidades: Compatibilidad[] = [];

    if (generacion) {
      compatibilidades = await query<Compatibilidad>(
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
        [request.modeloId, generacion.id, request.anioVehiculo]
      );
      if (compatibilidades.length > 0) {
        usedGenerationSpecific = true;
      }
    }

    if (compatibilidades.length === 0) {
      if (generacion) {
        fallbackPorRango = true;
      }
      compatibilidades = await query<Compatibilidad>(
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
        [request.modeloId, request.anioVehiculo]
      );
    }

    if (compatibilidades.length === 0) {
      const nivelConfianza = "baja";
      const mensaje = "No se encontro compatibilidad activa para el vehiculo y anio indicado.";
      const consultaId = await guardarConsulta(
        request,
        modelo.id,
        generacion?.id ?? null,
        nivelConfianza,
        mensaje,
        {
          horarioManejo: perfilHorario,
          zonaManejo: perfilZona,
          usoVehiculo: perfilUsoVehiculo
        },
        tipoPolarizado.codigo,
        [...new Set([perfilHorario.id, perfilZona.id, perfilUsoVehiculo.id])],
        [],
        []
      );
      res.json({
        consultaId,
        nivelConfianza,
        mensaje,
        marcaId: request.marcaId,
        modeloId: request.modeloId,
        generacionModeloId: generacion?.id ?? null,
        anioVehiculo: request.anioVehiculo,
        resultados: []
      });
      return;
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
        throw new AppError(
          422,
          "BUSINESS_RULE_ERROR",
          "Para este modelo y anio existen versiones con y sin proyector. Indica si tu vehiculo tiene faros con lupa/proyector."
        );
      }

      compatibilidades = compatibilidades.filter(
        (item) => item.tipoSistemaOptico === tipoSistemaOpticoCodigo
      );

      if (compatibilidades.length === 0) {
        throw new AppError(
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

    const candidatos: Array<{ posicionLuz: string; idCasquillo: number; producto: ProductoLed }> = [];

    for (const compatibilidad of compatibilidades) {
      let tipoOpticoAplicado = tipoSistemaOpticoCodigo;
      if (!tipoOpticoAplicado || tipoOpticoAplicado.trim() === "") {
        tipoOpticoAplicado = compatibilidad.tipoSistemaOptico;
        fallbackPorDatoClave = true;
      }

      if (tipoOpticoAplicado === "ambos") {
        tipoOpticoAplicado = null;
      }

      const productosCompatibles = await query<ProductoLed>(
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
        [compatibilidad.idCasquillo, compatibilidad.posicionLuz, tipoOpticoAplicado]
      );

      for (const producto of productosCompatibles) {
        candidatos.push({
          posicionLuz: compatibilidad.posicionLuz,
          idCasquillo: compatibilidad.idCasquillo,
          producto
        });
      }
    }

    if (candidatos.length === 0) {
      const nivelConfianza = "baja";
      const mensaje =
        "Se encontro compatibilidad, pero no hay inventario disponible para ese casquillo y sistema optico.";
      const consultaId = await guardarConsulta(
        request,
        modelo.id,
        generacion?.id ?? null,
        nivelConfianza,
        mensaje,
        {
          horarioManejo: perfilHorario,
          zonaManejo: perfilZona,
          usoVehiculo: perfilUsoVehiculo
        },
        tipoPolarizado.codigo,
        [...new Set([perfilHorario.id, perfilZona.id, perfilUsoVehiculo.id])],
        [],
        []
      );
      res.json({
        consultaId,
        nivelConfianza,
        mensaje,
        marcaId: request.marcaId,
        modeloId: request.modeloId,
        generacionModeloId: generacion?.id ?? null,
        anioVehiculo: request.anioVehiculo,
        resultados: []
      });
      return;
    }

    const idsPerfilUnicos = [...new Set([perfilHorario.id, perfilZona.id, perfilUsoVehiculo.id])];

    const idsCasquillo = [...new Set(candidatos.map((item) => item.idCasquillo))];
    const casquillos = idsCasquillo.length
      ? await query<{ id: number; codigo: string }>(
          `SELECT id, codigo FROM casquillos WHERE id = ANY($1::int[])`,
          [idsCasquillo]
        )
      : [];
    const casquilloCodigoPorId = new Map<number, string>(casquillos.map((item) => [item.id, item.codigo]));

    const agrupado = new Map<string, Map<number, ProductoAcumulado>>();

    for (const candidato of candidatos) {
      const productoId = candidato.producto.id;
      const gamaKey = getGamaKey(candidato.producto.gamaNombre);
      const motivos: string[] = [];
      let puntaje = 0;

      if (!gamaKey) {
        fallbackPorDatoClave = true;
        motivos.push("Producto sin gama valida para scoring; puntaje base 0.");
      } else {
        const scoreHorario = scoreByPerfilFactor("horario_manejo", perfilHorario.valor, gamaKey);
        const scoreZona = scoreByPerfilFactor("zona_manejo", perfilZona.valor, gamaKey);
        const scoreUso = scoreByPerfilFactor("uso_vehiculo", perfilUsoVehiculo.valor, gamaKey);
        const scorePolarizado = scoreByPolarizadoFactor(tipoPolarizado.codigo, gamaKey);

        puntaje =
          scoreHorario.score + scoreZona.score + scoreUso.score + scorePolarizado.score;
        motivos.push(
          scoreHorario.motivo,
          scoreZona.motivo,
          scoreUso.motivo,
          scorePolarizado.motivo
        );

        if (gamaKey === "super premium" || candidato.producto.potenciaWatts >= 330) {
          motivos.push(SUPER_PREMIUM_WARNING);
        }
      }

      if (!agrupado.has(candidato.posicionLuz)) {
        agrupado.set(candidato.posicionLuz, new Map());
      }

      const porPosicion = agrupado.get(candidato.posicionLuz)!;
      const actual = porPosicion.get(productoId);

      if (!actual) {
        porPosicion.set(productoId, {
          posicionLuz: candidato.posicionLuz,
          idCasquillo: candidato.idCasquillo,
          casquilloCodigo: casquilloCodigoPorId.get(candidato.idCasquillo) ?? "N/D",
          producto: candidato.producto,
          puntajeTotal: puntaje,
          motivos: [...motivos]
        });
      } else {
        actual.puntajeTotal = Math.max(actual.puntajeTotal, puntaje);
        actual.motivos = [...new Set([...actual.motivos, ...motivos])];
      }
    }

    const posicionesOrdenadas = [...agrupado.keys()].sort(
      (left, right) => (POSICION_ORDEN[left] ?? 99) - (POSICION_ORDEN[right] ?? 99)
    );

    const resultados: PosicionResultado[] = [];
    const filasPersistencia: ConsultaRecomendacionRow[] = [];

    for (const posicion of posicionesOrdenadas) {
      const productosOrdenados = [...(agrupado.get(posicion)?.values() ?? [])].sort((left, right) => {
        if (right.puntajeTotal !== left.puntajeTotal) {
          return right.puntajeTotal - left.puntajeTotal;
        }
        if (right.producto.lumens !== left.producto.lumens) {
          return right.producto.lumens - left.producto.lumens;
        }
        return left.producto.id - right.producto.id;
      });

      const productos: ProductoResultado[] = [];
      let rank = 1;
      for (const acumulado of productosOrdenados) {
        const item: ProductoResultado = {
          rank,
          productoId: acumulado.producto.id,
          marcaLedId: acumulado.producto.idMarcaLed,
          modelo: acumulado.producto.modelo,
          gama: acumulado.producto.gamaNombre,
          casquilloId: acumulado.idCasquillo,
          casquilloCodigo: acumulado.casquilloCodigo,
          puntajeTotal: acumulado.puntajeTotal,
          motivos: [...acumulado.motivos]
        };
        productos.push(item);
        filasPersistencia.push({
          posicionLuz: posicion,
          idProductoLed: acumulado.producto.id,
          puntajeTotal: acumulado.puntajeTotal,
          rankPosicion: rank,
          motivos: [...item.motivos]
        });
        rank += 1;
      }

      resultados.push({
        posicionLuz: posicion,
        productos
      });
    }

    const nivelConfianza = resolverNivelConfianza(
      fallbackPorDatoClave,
      usedGenerationSpecific,
      fallbackPorRango
    );

    const mensaje =
      nivelConfianza === "alta"
        ? "Recomendacion resuelta con coincidencia exacta y datos completos."
        : nivelConfianza === "media"
          ? "Recomendacion resuelta por coincidencia de rango/generacion."
          : "Recomendacion resuelta con fallback por datos faltantes o parciales.";

    const consultaId = await guardarConsulta(
      request,
      modelo.id,
      generacion?.id ?? null,
      nivelConfianza,
      mensaje,
      {
        horarioManejo: perfilHorario,
        zonaManejo: perfilZona,
        usoVehiculo: perfilUsoVehiculo
      },
      tipoPolarizado.codigo,
      idsPerfilUnicos,
      resultados,
      filasPersistencia
    );

    res.json({
      consultaId,
      nivelConfianza,
      mensaje,
      marcaId: request.marcaId,
      modeloId: request.modeloId,
      generacionModeloId: generacion?.id ?? null,
      anioVehiculo: request.anioVehiculo,
      resultados
    });
  } catch (error) {
    next(error);
  }
});
