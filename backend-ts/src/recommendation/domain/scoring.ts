import type {
  GamaKey,
  PerfilCategoria,
  ProductAccumulated,
  ProductCandidate,
  ProductResult,
  PositionResult,
  ConsultationRecommendationRow
} from "./types.js";

type ScoreByGama = Record<GamaKey, number>;
type ScoreMatrixByCategoria = Record<string, ScoreByGama>;
type MotiveByGama = Partial<Record<GamaKey, string>>;
type ClientMotiveByPerfil = Record<string, MotiveByGama>;

export const POSICION_ORDEN: Record<string, number> = {
  cruce: 1,
  largo: 2,
  cruce_y_largo: 3,
  antiniebla: 4,
  todos: 5
};

export const SUPER_PREMIUM_WARNING =
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

export const SCORE_MATRIX_POLARIZADO: ScoreMatrixByCategoria = {
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

export const getGamaKey = (gamaNombre: string | null): GamaKey | null => {
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

export const scoreByPerfilFactor = (
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

export const scoreByPolarizadoFactor = (
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

export const resolveConfidenceLevel = (
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

export const buildRankedResults = (
  candidates: ProductCandidate[],
  casquilloCodigoPorId: Map<number, string>,
  perfiles: {
    horario: string;
    zona: string;
    uso: string;
  },
  polarizadoCodigo: string
): {
  resultados: PositionResult[];
  filasPersistencia: ConsultationRecommendationRow[];
  fallbackPorDatoClave: boolean;
} => {
  let fallbackPorDatoClave = false;
  const agrupado = new Map<string, Map<number, ProductAccumulated>>();

  for (const candidate of candidates) {
    const productoId = candidate.producto.id;
    const gamaKey = getGamaKey(candidate.producto.gamaNombre);
    const motivos: string[] = [];
    let puntaje = 0;

    if (!gamaKey) {
      fallbackPorDatoClave = true;
      motivos.push("Producto sin gama valida para scoring; puntaje base 0.");
    } else {
      const scoreHorario = scoreByPerfilFactor("horario_manejo", perfiles.horario, gamaKey);
      const scoreZona = scoreByPerfilFactor("zona_manejo", perfiles.zona, gamaKey);
      const scoreUso = scoreByPerfilFactor("uso_vehiculo", perfiles.uso, gamaKey);
      const scorePolarizado = scoreByPolarizadoFactor(polarizadoCodigo, gamaKey);

      puntaje = scoreHorario.score + scoreZona.score + scoreUso.score + scorePolarizado.score;
      motivos.push(scoreHorario.motivo, scoreZona.motivo, scoreUso.motivo, scorePolarizado.motivo);

      if (gamaKey === "super premium" || candidate.producto.potenciaWatts >= 330) {
        motivos.push(SUPER_PREMIUM_WARNING);
      }
    }

    if (!agrupado.has(candidate.posicionLuz)) {
      agrupado.set(candidate.posicionLuz, new Map());
    }

    const porPosicion = agrupado.get(candidate.posicionLuz)!;
    const actual = porPosicion.get(productoId);

    if (!actual) {
      porPosicion.set(productoId, {
        posicionLuz: candidate.posicionLuz,
        idCasquillo: candidate.idCasquillo,
        casquilloCodigo: casquilloCodigoPorId.get(candidate.idCasquillo) ?? "N/D",
        producto: candidate.producto,
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

  const resultados: PositionResult[] = [];
  const filasPersistencia: ConsultationRecommendationRow[] = [];

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

    const productos: ProductResult[] = [];
    let rank = 1;
    for (const acumulado of productosOrdenados) {
      const item: ProductResult = {
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

    resultados.push({ posicionLuz: posicion, productos });
  }

  return { resultados, filasPersistencia, fallbackPorDatoClave };
};
