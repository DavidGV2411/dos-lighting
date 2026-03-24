import { Router, type Request } from "express";
import { z } from "zod";
import { getPagination } from "../common/pagination.js";
import { toPageResponse } from "../common/api/page-response.js";
import { AppError } from "../common/error/api-error.js";
import { parseOrThrow, positiveInt } from "../common/validation.js";
import { pool, query, queryOne } from "../db/pool.js";

type CrudDefinition<TBody extends Record<string, unknown>, TRow extends Record<string, unknown>> = {
  path: string;
  table: string;
  selectColumnsSql: string;
  requestSchema: z.ZodType<TBody>;
  toDbPayload: (body: TBody) => Record<string, unknown>;
  mapRow?: (row: Record<string, unknown>) => TRow;
  notFoundMessage: (id: number) => string;
  validateBusiness?: (body: TBody) => Promise<void>;
  paginated?: {
    defaultSize: number;
    defaultSortField: string;
    defaultSortDirection: "ASC" | "DESC";
    sortFields: Record<string, string>;
  };
};

const toNumber = (value: unknown): unknown => {
  if (value === "" || value == null) {
    return undefined;
  }
  return Number(value);
};

const requiredIntField = (requiredMessage: string, minMessage: string, min = 1) =>
  z.preprocess(
    toNumber,
    z.number({ required_error: requiredMessage, invalid_type_error: requiredMessage }).int(minMessage).min(min, minMessage)
  );

const optionalIntField = (minMessage: string, min = 1) =>
  z.preprocess(
    toNumber,
    z.number({ invalid_type_error: minMessage }).int(minMessage).min(min, minMessage).optional()
  );

const requiredDecimalField = (requiredMessage: string, minMessage: string, min = 0) =>
  z.preprocess(
    toNumber,
    z.number({ required_error: requiredMessage, invalid_type_error: requiredMessage }).min(min, minMessage)
  );

const requiredTextField = (name: string, max: number) =>
  z
    .string({ required_error: `${name} es obligatorio`, invalid_type_error: `${name} es obligatorio` })
    .trim()
    .min(1, `${name} es obligatorio`)
    .max(max, `${name} no puede exceder ${max} caracteres`);

const optionalTextField = (name: string, max: number) =>
  z
    .string({ invalid_type_error: `${name} invalido` })
    .trim()
    .max(max, `${name} no puede exceder ${max} caracteres`)
    .optional()
    .nullable();

const idParamsSchema = z.object({
  id: positiveInt
});

const parseId = (req: Request): number => parseOrThrow(idParamsSchema, req.params).id;

const existsById = async (table: string, id: number): Promise<boolean> => {
  const row = await queryOne<{ id: number }>(`SELECT id FROM ${table} WHERE id = $1`, [id]);
  return row != null;
};

const existsBy = async (table: string, column: string, value: unknown): Promise<boolean> => {
  const row = await queryOne<{ ok: number }>(`SELECT 1 AS ok FROM ${table} WHERE ${column} = $1`, [value]);
  return row != null;
};

const insertReturningId = async (table: string, payload: Record<string, unknown>): Promise<number> => {
  const columns = Object.keys(payload);
  const values = Object.values(payload);
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders}) RETURNING id`;
  const inserted = await queryOne<{ id: number }>(sql, values);
  if (!inserted) {
    throw new AppError(500, "INTERNAL_ERROR", "No se pudo crear el registro.");
  }
  return inserted.id;
};

const updateReturningId = async (
  table: string,
  id: number,
  payload: Record<string, unknown>
): Promise<number | null> => {
  const columns = Object.keys(payload);
  const values = Object.values(payload);
  const assignments = columns.map((column, index) => `${column} = $${index + 1}`).join(", ");
  const sql = `UPDATE ${table} SET ${assignments} WHERE id = $${columns.length + 1} RETURNING id`;
  const updated = await queryOne<{ id: number }>(sql, [...values, id]);
  return updated?.id ?? null;
};

const selectById = async (
  table: string,
  selectColumnsSql: string,
  id: number
): Promise<Record<string, unknown> | null> =>
  queryOne<Record<string, unknown>>(
    `SELECT ${selectColumnsSql} FROM ${table} WHERE id = $1`,
    [id]
  );

const registerCrudResource = <TBody extends Record<string, unknown>, TRow extends Record<string, unknown>>(
  router: Router,
  definition: CrudDefinition<TBody, TRow>
): void => {
  const mapRow = definition.mapRow ?? ((row: Record<string, unknown>) => row as TRow);

  router.get(definition.path, async (req, res, next) => {
    try {
      if (!definition.paginated) {
        const rows = await query<Record<string, unknown>>(
          `SELECT ${definition.selectColumnsSql} FROM ${definition.table} ORDER BY id ASC`
        );
        res.json(rows.map(mapRow));
        return;
      }

      const pagination = getPagination(req, {
        defaultSize: definition.paginated.defaultSize,
        maxSize: 200,
        defaultSortField: definition.paginated.defaultSortField,
        defaultSortDirection: definition.paginated.defaultSortDirection,
        sortFields: definition.paginated.sortFields
      });

      const total = await queryOne<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM ${definition.table}`
      );

      const rows = await query<Record<string, unknown>>(
        `SELECT ${definition.selectColumnsSql}
         FROM ${definition.table}
         ORDER BY ${pagination.sortColumn} ${pagination.sortDirection}
         LIMIT $1 OFFSET $2`,
        [pagination.size, pagination.offset]
      );

      res.json(
        toPageResponse(rows.map(mapRow), pagination.page, pagination.size, Number(total?.total ?? 0))
      );
    } catch (error) {
      next(error);
    }
  });

  router.get(`${definition.path}/:id`, async (req, res, next) => {
    try {
      const id = parseId(req);
      const row = await selectById(definition.table, definition.selectColumnsSql, id);
      if (!row) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", definition.notFoundMessage(id));
      }
      res.json(mapRow(row));
    } catch (error) {
      next(error);
    }
  });

  router.post(definition.path, async (req, res, next) => {
    try {
      const body = parseOrThrow(definition.requestSchema, req.body);
      if (definition.validateBusiness) {
        await definition.validateBusiness(body);
      }
      const id = await insertReturningId(definition.table, definition.toDbPayload(body));
      const row = await selectById(definition.table, definition.selectColumnsSql, id);
      res.status(201).json(row ? mapRow(row) : null);
    } catch (error) {
      next(error);
    }
  });

  router.put(`${definition.path}/:id`, async (req, res, next) => {
    try {
      const id = parseId(req);
      const body = parseOrThrow(definition.requestSchema, req.body);
      if (definition.validateBusiness) {
        await definition.validateBusiness(body);
      }
      const updatedId = await updateReturningId(definition.table, id, definition.toDbPayload(body));
      if (updatedId == null) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", definition.notFoundMessage(id));
      }
      const row = await selectById(definition.table, definition.selectColumnsSql, updatedId);
      res.json(row ? mapRow(row) : null);
    } catch (error) {
      next(error);
    }
  });

  router.delete(`${definition.path}/:id`, async (req, res, next) => {
    try {
      const id = parseId(req);
      const result = await pool.query(`DELETE FROM ${definition.table} WHERE id = $1`, [id]);
      if (result.rowCount === 0) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", definition.notFoundMessage(id));
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });
};

const mapProductoRow = (row: Record<string, unknown>): Record<string, unknown> => ({
  ...row,
  potenciaWatts: row.potenciaWatts == null ? null : Number(row.potenciaWatts),
  precio: row.precio == null ? null : Number(row.precio)
});

const mapGamaLuzRow = (row: Record<string, unknown>): Record<string, unknown> => ({
  ...row,
  potenciaWattsMin: row.potenciaWattsMin == null ? null : Number(row.potenciaWattsMin),
  potenciaWattsMax: row.potenciaWattsMax == null ? null : Number(row.potenciaWattsMax)
});

const marcaVehiculoSchema = z.object({
  nombre: requiredTextField("nombre", 120),
  idTipoVehiculo: requiredIntField("idTipoVehiculo es obligatorio", "idTipoVehiculo debe ser mayor a 0")
});

const modeloVehiculoSchema = z.object({
  nombre: requiredTextField("nombre", 150),
  idMarca: requiredIntField("idMarca es obligatorio", "idMarca debe ser mayor a 0"),
  anioDesde: requiredIntField("anioDesde es obligatorio", "anioDesde invalido", 1900),
  anioHasta: optionalIntField("anioHasta invalido", 1900).nullable()
});

const allowedCasquilloCodes = new Set(["H4", "H1", "H7", "H11", "9005", "9006", "H13", "880", "H3"]);
const allowedTipoPolarizadoCodes = new Set(["5%", "20%", "35%", "50%", "70%", "sin polarizado"]);
const tipoPolarizadoLabelByCode: Record<string, string> = {
  "5%": "5% super oscuro",
  "20%": "20% oscuro medio",
  "35%": "35% medio",
  "50%": "50% claro",
  "70%": "70% casi transparente",
  "sin polarizado": "Sin polarizado"
};

const normalizeTipoPolarizadoCode = (raw: string): string | null => {
  const value = raw.trim().toLowerCase();
  if (!value) {
    return null;
  }

  if (value === "sin polarizado") {
    return "sin polarizado";
  }

  const percentMatch = /^(\d+)\s*%$/.exec(value);
  if (!percentMatch) {
    return null;
  }

  const normalized = `${Number(percentMatch[1])}%`;
  return allowedTipoPolarizadoCodes.has(normalized) ? normalized : null;
};

const casquilloSchema = z.object({
  codigo: z
    .string({ required_error: "codigo es obligatorio", invalid_type_error: "codigo es obligatorio" })
    .trim()
    .min(1, "codigo es obligatorio")
    .max(50, "codigo no puede exceder 50 caracteres")
    .transform((value) => value.toUpperCase())
    .refine((value) => allowedCasquilloCodes.has(value), "codigo de casquillo no permitido"),
  descripcion: optionalTextField("descripcion", 300)
});

const marcaLedSchema = z.object({
  nombre: requiredTextField("nombre", 120),
  paisOrigen: optionalTextField("paisOrigen", 120),
  sitioWeb: optionalTextField("sitioWeb", 250).refine(
    (value) => value == null || value === "" || /^https?:\/\/.*/.test(value),
    "sitioWeb debe iniciar con http:// o https://"
  )
});

const perfilUsoSchema = z.object({
  categoria: requiredTextField("categoria", 60),
  valor: requiredTextField("valor", 80),
  descripcion: requiredTextField("descripcion", 300),
  activo: z.boolean({ required_error: "activo es obligatorio", invalid_type_error: "activo es obligatorio" })
});

const tipoPolarizadoSchema = z.object({
  codigo: z
    .string({ required_error: "codigo es obligatorio", invalid_type_error: "codigo es obligatorio" })
    .transform((value) => normalizeTipoPolarizadoCode(value))
    .refine((value): value is string => value != null, "codigo de polarizado no permitido"),
  descripcion: optionalTextField("descripcion", 300),
  activo: z.boolean({ required_error: "activo es obligatorio", invalid_type_error: "activo es obligatorio" })
});

const gamaLuzSchema = z.object({
  nombre: requiredTextField("nombre", 80),
  descripcion: optionalTextField("descripcion", 300),
  potenciaWattsMin: requiredDecimalField("potenciaWattsMin es obligatoria", "potenciaWattsMin invalida", 0),
  potenciaWattsMax: requiredDecimalField("potenciaWattsMax es obligatoria", "potenciaWattsMax invalida", 0),
  activo: z.boolean({ required_error: "activo es obligatorio", invalid_type_error: "activo es obligatorio" })
});

const generacionModeloSchema = z.object({
  idModelo: requiredIntField("idModelo es obligatorio", "idModelo debe ser mayor a 0"),
  nombre: requiredTextField("nombre", 120),
  anioDesde: requiredIntField("anioDesde es obligatorio", "anioDesde invalido", 1900),
  anioHasta: optionalIntField("anioHasta invalido", 1900).nullable(),
  activo: z.boolean({ required_error: "activo es obligatorio", invalid_type_error: "activo es obligatorio" })
});

const reglaRecomendacionSchema = z.object({
  idPerfilUso: requiredIntField("idPerfilUso es obligatorio", "idPerfilUso debe ser mayor a 0"),
  idProductoLed: requiredIntField("idProductoLed es obligatorio", "idProductoLed debe ser mayor a 0"),
  puntaje: z.preprocess(
    toNumber,
    z
      .number({ required_error: "puntaje es obligatorio", invalid_type_error: "puntaje es obligatorio" })
      .int("puntaje es obligatorio")
      .min(-100, "puntaje no puede ser menor a -100")
      .max(100, "puntaje no puede ser mayor a 100")
  ),
  motivo: requiredTextField("motivo", 500)
});

const productoLedSchema = z.object({
  idMarcaLed: requiredIntField("idMarcaLed es obligatorio", "idMarcaLed debe ser mayor a 0"),
  modelo: requiredTextField("modelo", 150),
  idCasquillo: requiredIntField("idCasquillo es obligatorio", "idCasquillo debe ser mayor a 0"),
  posicionAplicable: z
    .string({ required_error: "posicionAplicable es obligatoria", invalid_type_error: "posicionAplicable es obligatoria" })
    .regex(/^(cruce|largo|cruce_y_largo|antiniebla|todos)$/, "posicionAplicable invalida"),
  sistemaOpticoCompatible: z
    .string({
      required_error: "sistemaOpticoCompatible es obligatorio",
      invalid_type_error: "sistemaOpticoCompatible es obligatorio"
    })
    .regex(/^(lupa_proyector|reflector_abierto|ambos)$/, "sistemaOpticoCompatible invalido"),
  lumens: requiredIntField("lumens es obligatorio", "lumens debe ser mayor a 0"),
  temperaturaColor: requiredIntField("temperaturaColor es obligatoria", "temperaturaColor invalida", 1000),
  potenciaWatts: requiredDecimalField("potenciaWatts es obligatoria", "potenciaWatts debe ser mayor a 0", 0.01),
  precio: requiredDecimalField("precio es obligatorio", "precio no puede ser negativo", 0),
  disponible: z.boolean({ required_error: "disponible es obligatorio", invalid_type_error: "disponible es obligatorio" }),
  imagenPath: optionalTextField("imagenPath", 500),
  notas: optionalTextField("notas", 1200),
  idGamaLuz: optionalIntField("idGamaLuz debe ser mayor a 0").nullable()
});

const compatibilidadSchema = z.object({
  idModelo: requiredIntField("idModelo es obligatorio", "idModelo debe ser mayor a 0"),
  idGeneracionModelo: optionalIntField("idGeneracionModelo debe ser mayor a 0").nullable(),
  anioDesde: requiredIntField("anioDesde es obligatorio", "anioDesde invalido", 1900),
  anioHasta: optionalIntField("anioHasta invalido", 1900).nullable(),
  posicionLuz: z
    .string({ required_error: "posicionLuz es obligatoria", invalid_type_error: "posicionLuz es obligatoria" })
    .regex(/^(cruce|largo|cruce_y_largo|antiniebla)$/, "posicionLuz invalida"),
  idCasquillo: requiredIntField("idCasquillo es obligatorio", "idCasquillo debe ser mayor a 0"),
  tipoSistemaOptico: z
    .string({ required_error: "tipoSistemaOptico es obligatorio", invalid_type_error: "tipoSistemaOptico es obligatorio" })
    .regex(/^(lupa_proyector|reflector_abierto)$/, "tipoSistemaOptico invalido")
});

export const crudRoutes = Router();

registerCrudResource(crudRoutes, {
  path: "/api/v1/marcas-vehiculo",
  table: "marcas_vehiculo",
  selectColumnsSql: `id, nombre, id_tipo_vehiculo AS "idTipoVehiculo"`,
  requestSchema: marcaVehiculoSchema,
  toDbPayload: (body) => ({
    nombre: body.nombre.trim(),
    id_tipo_vehiculo: body.idTipoVehiculo
  }),
  validateBusiness: async (body) => {
    const valid = await existsById("tipos_vehiculo", Number(body.idTipoVehiculo));
    if (!valid) {
      throw new AppError(422, "BUSINESS_RULE_ERROR", `idTipoVehiculo no existe: ${body.idTipoVehiculo}`);
    }
  },
  notFoundMessage: (id) => `Marca de vehiculo no encontrada con id ${id}`
});

registerCrudResource(crudRoutes, {
  path: "/api/v1/modelos-vehiculo",
  table: "modelos_vehiculo",
  selectColumnsSql: `id, nombre, id_marca AS "idMarca", anio_desde AS "anioDesde", anio_hasta AS "anioHasta"`,
  requestSchema: modeloVehiculoSchema,
  toDbPayload: (body) => ({
    nombre: body.nombre.trim(),
    id_marca: body.idMarca,
    anio_desde: body.anioDesde,
    anio_hasta: body.anioHasta
  }),
  validateBusiness: async (body) => {
    const valid = await existsById("marcas_vehiculo", Number(body.idMarca));
    if (!valid) {
      throw new AppError(422, "BUSINESS_RULE_ERROR", `idMarca no existe: ${body.idMarca}`);
    }
    if (body.anioHasta != null && Number(body.anioHasta) < Number(body.anioDesde)) {
      throw new AppError(422, "BUSINESS_RULE_ERROR", "anioHasta no puede ser menor que anioDesde");
    }
  },
  notFoundMessage: (id) => `Modelo de vehiculo no encontrado con id ${id}`
});

registerCrudResource(crudRoutes, {
  path: "/api/v1/casquillos",
  table: "casquillos",
  selectColumnsSql: `id, codigo, descripcion`,
  requestSchema: casquilloSchema,
  toDbPayload: (body) => ({
    codigo: body.codigo,
    descripcion: body.descripcion == null || body.descripcion === "" ? null : body.descripcion.trim()
  }),
  notFoundMessage: (id) => `Casquillo no encontrado con id ${id}`
});

registerCrudResource(crudRoutes, {
  path: "/api/v1/marcas-led",
  table: "marcas_led",
  selectColumnsSql: `id, nombre, pais_origen AS "paisOrigen", sitio_web AS "sitioWeb"`,
  requestSchema: marcaLedSchema,
  toDbPayload: (body) => ({
    nombre: body.nombre.trim(),
    pais_origen: body.paisOrigen == null || body.paisOrigen === "" ? null : body.paisOrigen.trim(),
    sitio_web: body.sitioWeb == null || body.sitioWeb === "" ? null : body.sitioWeb.trim()
  }),
  notFoundMessage: (id) => `Marca LED no encontrada con id ${id}`
});

registerCrudResource(crudRoutes, {
  path: "/api/v1/perfiles-uso",
  table: "perfiles_uso",
  selectColumnsSql: `id, categoria, valor, descripcion, activo`,
  requestSchema: perfilUsoSchema,
  toDbPayload: (body) => ({
    categoria: body.categoria.trim(),
    valor: body.valor.trim(),
    descripcion: body.descripcion.trim(),
    activo: body.activo
  }),
  notFoundMessage: (id) => `Perfil de uso no encontrado con id ${id}`
});

registerCrudResource(crudRoutes, {
  path: "/api/v1/tipos-polarizado",
  table: "tipos_polarizado",
  selectColumnsSql: `id, codigo, descripcion, activo`,
  requestSchema: tipoPolarizadoSchema,
  toDbPayload: (body) => ({
    codigo: body.codigo,
    descripcion: tipoPolarizadoLabelByCode[body.codigo] ?? body.codigo,
    activo: body.activo
  }),
  notFoundMessage: (id) => `Tipo de polarizado no encontrado con id ${id}`
});

registerCrudResource(crudRoutes, {
  path: "/api/v1/gamas-luz",
  table: "gamas_luz",
  selectColumnsSql: `id, nombre, descripcion, potencia_watts_min AS "potenciaWattsMin", potencia_watts_max AS "potenciaWattsMax", activo`,
  requestSchema: gamaLuzSchema,
  toDbPayload: (body) => ({
    nombre: body.nombre.trim(),
    descripcion: body.descripcion == null || body.descripcion === "" ? null : body.descripcion.trim(),
    potencia_watts_min: body.potenciaWattsMin,
    potencia_watts_max: body.potenciaWattsMax,
    activo: body.activo
  }),
  validateBusiness: async (body) => {
    if (Number(body.potenciaWattsMax) < Number(body.potenciaWattsMin)) {
      throw new AppError(
        422,
        "BUSINESS_RULE_ERROR",
        "potenciaWattsMax no puede ser menor que potenciaWattsMin"
      );
    }
  },
  mapRow: mapGamaLuzRow,
  notFoundMessage: (id) => `Gama de luz no encontrada con id ${id}`
});

registerCrudResource(crudRoutes, {
  path: "/api/v1/generaciones-modelo",
  table: "generaciones_modelo",
  selectColumnsSql: `id, id_modelo AS "idModelo", nombre, anio_desde AS "anioDesde", anio_hasta AS "anioHasta", activo`,
  requestSchema: generacionModeloSchema,
  toDbPayload: (body) => ({
    id_modelo: body.idModelo,
    nombre: body.nombre.trim(),
    anio_desde: body.anioDesde,
    anio_hasta: body.anioHasta,
    activo: body.activo
  }),
  validateBusiness: async (body) => {
    const valid = await existsById("modelos_vehiculo", Number(body.idModelo));
    if (!valid) {
      throw new AppError(422, "BUSINESS_RULE_ERROR", `idModelo no existe: ${body.idModelo}`);
    }
    if (body.anioHasta != null && Number(body.anioHasta) < Number(body.anioDesde)) {
      throw new AppError(422, "BUSINESS_RULE_ERROR", "anioHasta no puede ser menor que anioDesde");
    }
  },
  notFoundMessage: (id) => `Generacion de modelo no encontrada con id ${id}`
});

registerCrudResource(crudRoutes, {
  path: "/api/v1/reglas-recomendacion",
  table: "reglas_recomendacion",
  selectColumnsSql: `id, id_perfil_uso AS "idPerfilUso", id_producto_led AS "idProductoLed", puntaje, motivo`,
  requestSchema: reglaRecomendacionSchema,
  toDbPayload: (body) => ({
    id_perfil_uso: body.idPerfilUso,
    id_producto_led: body.idProductoLed,
    puntaje: body.puntaje,
    motivo: String(body.motivo).trim()
  }),
  validateBusiness: async (body) => {
    const perfilValido = await existsById("perfiles_uso", Number(body.idPerfilUso));
    if (!perfilValido) {
      throw new AppError(422, "BUSINESS_RULE_ERROR", `idPerfilUso no existe: ${body.idPerfilUso}`);
    }
    const productoValido = await existsById("productos_led", Number(body.idProductoLed));
    if (!productoValido) {
      throw new AppError(422, "BUSINESS_RULE_ERROR", `idProductoLed no existe: ${body.idProductoLed}`);
    }
  },
  notFoundMessage: (id) => `Regla de recomendacion no encontrada con id ${id}`
});

registerCrudResource(crudRoutes, {
  path: "/api/v1/productos-led",
  table: "productos_led",
  selectColumnsSql: `id, id_marca_led AS "idMarcaLed", modelo, id_casquillo AS "idCasquillo", posicion_aplicable AS "posicionAplicable", sistema_optico_compatible AS "sistemaOpticoCompatible", lumens, temperatura_color AS "temperaturaColor", potencia_watts AS "potenciaWatts", precio, disponible, imagen_path AS "imagenPath", notas, id_gama_luz AS "idGamaLuz"`,
  requestSchema: productoLedSchema,
  toDbPayload: (body) => ({
    id_marca_led: body.idMarcaLed,
    modelo: body.modelo.trim(),
    id_casquillo: body.idCasquillo,
    posicion_aplicable: body.posicionAplicable,
    sistema_optico_compatible: body.sistemaOpticoCompatible,
    lumens: body.lumens,
    temperatura_color: body.temperaturaColor,
    potencia_watts: body.potenciaWatts,
    precio: body.precio,
    disponible: body.disponible,
    imagen_path: body.imagenPath == null || body.imagenPath === "" ? null : body.imagenPath.trim(),
    notas: body.notas == null || body.notas === "" ? null : body.notas.trim(),
    id_gama_luz: body.idGamaLuz
  }),
  validateBusiness: async (body) => {
    if (!(await existsById("marcas_led", Number(body.idMarcaLed)))) {
      throw new AppError(422, "BUSINESS_RULE_ERROR", `idMarcaLed no existe: ${body.idMarcaLed}`);
    }
    if (!(await existsById("casquillos", Number(body.idCasquillo)))) {
      throw new AppError(422, "BUSINESS_RULE_ERROR", `idCasquillo no existe: ${body.idCasquillo}`);
    }
    const gamaPorPotencia = await queryOne<{ id: number }>(
      `
      SELECT id
      FROM gamas_luz
      WHERE activo = true
        AND $1::numeric BETWEEN potencia_watts_min AND potencia_watts_max
      ORDER BY id ASC
      LIMIT 1
      `,
      [body.potenciaWatts]
    );

    if (!gamaPorPotencia) {
      throw new AppError(
        422,
        "BUSINESS_RULE_ERROR",
        `No existe gama activa para potenciaWatts=${body.potenciaWatts}.`
      );
    }

    body.idGamaLuz = gamaPorPotencia.id;
  },
  mapRow: mapProductoRow,
  notFoundMessage: (id) => `Producto LED no encontrado con id ${id}`,
  paginated: {
    defaultSize: 20,
    defaultSortField: "id",
    defaultSortDirection: "ASC",
    sortFields: {
      id: "id"
    }
  }
});

registerCrudResource(crudRoutes, {
  path: "/api/v1/compatibilidades-vehiculo-casquillo",
  table: "compatibilidad_vehiculo_casquillo",
  selectColumnsSql: `id, id_modelo AS "idModelo", id_generacion_modelo AS "idGeneracionModelo", anio_desde AS "anioDesde", anio_hasta AS "anioHasta", posicion_luz AS "posicionLuz", id_casquillo AS "idCasquillo", tipo_sistema_optico AS "tipoSistemaOptico"`,
  requestSchema: compatibilidadSchema,
  toDbPayload: (body) => ({
    id_modelo: body.idModelo,
    id_generacion_modelo: body.idGeneracionModelo,
    anio_desde: body.anioDesde,
    anio_hasta: body.anioHasta,
    posicion_luz: body.posicionLuz,
    id_casquillo: body.idCasquillo,
    tipo_sistema_optico: body.tipoSistemaOptico
  }),
  validateBusiness: async (body) => {
    if (!(await existsById("modelos_vehiculo", Number(body.idModelo)))) {
      throw new AppError(422, "BUSINESS_RULE_ERROR", `idModelo no existe: ${body.idModelo}`);
    }
    if (!(await existsById("casquillos", Number(body.idCasquillo)))) {
      throw new AppError(422, "BUSINESS_RULE_ERROR", `idCasquillo no existe: ${body.idCasquillo}`);
    }
    if (body.idGeneracionModelo != null) {
      const valid = await queryOne<{ ok: number }>(
        `SELECT 1 AS ok
         FROM generaciones_modelo
         WHERE id = $1 AND id_modelo = $2`,
        [body.idGeneracionModelo, body.idModelo]
      );
      if (!valid) {
        throw new AppError(
          422,
          "BUSINESS_RULE_ERROR",
          `idGeneracionModelo no existe o no pertenece al idModelo indicado: ${body.idGeneracionModelo}`
        );
      }
    }
    if (body.anioHasta != null && Number(body.anioHasta) < Number(body.anioDesde)) {
      throw new AppError(422, "BUSINESS_RULE_ERROR", "anioHasta no puede ser menor que anioDesde");
    }
  },
  notFoundMessage: (id) => `Compatibilidad no encontrada con id ${id}`,
  paginated: {
    defaultSize: 20,
    defaultSortField: "id",
    defaultSortDirection: "ASC",
    sortFields: {
      id: "id"
    }
  }
});

// Re-export helper used by resolver and consultas routes.
export const dbExists = {
  byId: existsById,
  by: existsBy
};
