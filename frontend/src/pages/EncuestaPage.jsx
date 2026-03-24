import { useEffect, useMemo, useState } from "react";
import ApiErrorBanner from "../components/ApiErrorBanner";
import FieldError from "../components/FieldError";
import LoadingBlock from "../components/LoadingBlock";
import RecommendationResults from "../components/RecommendationResults";
import {
  getDecisionSistemaOptico,
  getMarcasVehiculo,
  getModelosVehiculo,
  getPerfilesUso,
  getTiposPolarizado
} from "../services/catalogService";
import { resolverRecomendaciones } from "../services/recomendacionService";
import { toInteger } from "../utils/format";

const TIPO_SISTEMA_OPTICO_ID_BY_CODE = {
  lupa_proyector: 1,
  reflector_abierto: 2
};

const TIPO_SISTEMA_OPTICO_LABEL_BY_CODE = {
  lupa_proyector: "Lupa o proyector",
  reflector_abierto: "Reflector abierto"
};

const POLARIZADO_ORDER = new Map([
  ["sin polarizado", 1],
  ["70%", 2],
  ["50%", 3],
  ["35%", 4],
  ["20%", 5],
  ["5%", 6]
]);

const REQUEST_FIELD_TO_FORM_FIELD = {
  tipoSistemaOpticoId: "tieneLupaProyector"
};

function validate(form, requiresOpticalQuestion) {
  const errors = {};

  if (!form.marcaId) errors.marcaId = "Selecciona una marca.";
  if (!form.modeloId) errors.modeloId = "Selecciona un modelo.";
  if (!form.horarioManejoPerfilId) errors.horarioManejoPerfilId = "Selecciona un horario de manejo.";
  if (!form.zonaManejoPerfilId) errors.zonaManejoPerfilId = "Selecciona una zona de manejo.";
  if (!form.usoVehiculoPerfilId) errors.usoVehiculoPerfilId = "Selecciona el uso del vehiculo.";
  if (!form.tipoPolarizadoId) errors.tipoPolarizadoId = "Selecciona un tipo de polarizado.";

  const anio = toInteger(form.anioVehiculo);
  if (!anio) {
    errors.anioVehiculo = "Ingresa el anio del vehiculo.";
  }

  if (requiresOpticalQuestion && !form.tieneLupaProyector) {
    errors.tieneLupaProyector = "Responde si tu vehiculo tiene faros con lupa/proyector.";
  }

  return errors;
}

function toApiErrorState(error) {
  if (error?.status === 400) {
    return {
      title: "Error de validacion (400)",
      message: "Revisa los datos ingresados y vuelve a intentarlo.",
      details: error.details || []
    };
  }

  if (error?.status === 422) {
    return {
      title: "No se pudo resolver (422)",
      message: error.message || "No fue posible resolver la recomendacion con esos datos.",
      details: error.details || []
    };
  }

  return {
    title: "Error al recomendar",
    message: error?.message || "Ocurrio un error al consultar el backend.",
    details: error?.details || []
  };
}

function detailsToFieldErrors(details = []) {
  const fieldErrors = {};

  for (const detail of details) {
    if (!detail?.field) {
      continue;
    }

    const fieldFromApi = String(detail.field).split(".").pop();
    const formField = REQUEST_FIELD_TO_FORM_FIELD[fieldFromApi] || fieldFromApi;
    fieldErrors[formField] = detail.message || "Valor invalido.";
  }

  return fieldErrors;
}

function EncuestaPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [recommendation, setRecommendation] = useState(null);
  const [loadingDecisionSistemaOptico, setLoadingDecisionSistemaOptico] = useState(false);
  const [decisionSistemaOptico, setDecisionSistemaOptico] = useState(null);

  const [marcas, setMarcas] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [perfiles, setPerfiles] = useState([]);
  const [tiposPolarizado, setTiposPolarizado] = useState([]);

  const [form, setForm] = useState({
    marcaId: "",
    modeloId: "",
    anioVehiculo: "",
    horarioManejoPerfilId: "",
    zonaManejoPerfilId: "",
    usoVehiculoPerfilId: "",
    tipoPolarizadoId: "",
    tieneLupaProyector: ""
  });

  useEffect(() => {
    async function loadCatalogs() {
      try {
        setLoading(true);
        setApiError(null);

        const [marcasData, modelosData, perfilesData, polarizadosData] = await Promise.all([
          getMarcasVehiculo(),
          getModelosVehiculo(),
          getPerfilesUso(),
          getTiposPolarizado()
        ]);

        setMarcas(marcasData.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)));
        setModelos(modelosData.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)));
        setPerfiles(perfilesData.filter((item) => item.activo));
        setTiposPolarizado(
          polarizadosData
            .filter((item) => item.activo)
            .slice()
            .sort((a, b) => {
              const keyA = String(a.codigo || a.descripcion || "").toLowerCase();
              const keyB = String(b.codigo || b.descripcion || "").toLowerCase();
              const orderA = POLARIZADO_ORDER.get(keyA) ?? 99;
              const orderB = POLARIZADO_ORDER.get(keyB) ?? 99;
              if (orderA !== orderB) {
                return orderA - orderB;
              }
              return String(a.descripcion || "").localeCompare(String(b.descripcion || ""));
            })
        );
      } catch (error) {
        setApiError(toApiErrorState(error));
      } finally {
        setLoading(false);
      }
    }

    loadCatalogs();
  }, []);

  const filteredModelos = useMemo(() => {
    if (!form.marcaId) {
      return [];
    }

    const marcaId = toInteger(form.marcaId);
    return modelos.filter((modelo) => modelo.idMarca === marcaId);
  }, [form.marcaId, modelos]);

  const selectedModelo = useMemo(
    () => filteredModelos.find((modelo) => modelo.id === toInteger(form.modeloId)),
    [filteredModelos, form.modeloId]
  );

  useEffect(() => {
    const modeloId = toInteger(form.modeloId);
    const anioVehiculo = toInteger(form.anioVehiculo);

    if (!modeloId || !anioVehiculo) {
      setDecisionSistemaOptico(null);
      setLoadingDecisionSistemaOptico(false);
      return;
    }

    if (
      selectedModelo &&
      (anioVehiculo < selectedModelo.anioDesde ||
        (selectedModelo.anioHasta != null && anioVehiculo > selectedModelo.anioHasta))
    ) {
      setDecisionSistemaOptico(null);
      setLoadingDecisionSistemaOptico(false);
      return;
    }

    let cancelled = false;
    const loadDecision = async () => {
      try {
        setLoadingDecisionSistemaOptico(true);
        const decision = await getDecisionSistemaOptico(modeloId, anioVehiculo);
        if (cancelled) {
          return;
        }
        setDecisionSistemaOptico(decision);
        if (!decision?.requiresQuestion) {
          setForm((prev) =>
            prev.tieneLupaProyector ? { ...prev, tieneLupaProyector: "" } : prev
          );
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        setDecisionSistemaOptico(null);
        setApiError(toApiErrorState(error));
      } finally {
        if (!cancelled) {
          setLoadingDecisionSistemaOptico(false);
        }
      }
    };

    loadDecision();

    return () => {
      cancelled = true;
    };
  }, [form.modeloId, form.anioVehiculo, selectedModelo]);

  const perfilesHorario = useMemo(() => {
    const order = ["diurno", "mixto", "nocturno"];
    return perfiles
      .filter((item) => item.categoria === "horario_manejo")
      .slice()
      .sort((a, b) => order.indexOf(a.valor) - order.indexOf(b.valor));
  }, [perfiles]);

  const perfilesZona = useMemo(() => {
    const order = ["urbano", "carretera", "rural", "mixto"];
    return perfiles
      .filter((item) => item.categoria === "zona_manejo")
      .slice()
      .sort((a, b) => order.indexOf(a.valor) - order.indexOf(b.valor));
  }, [perfiles]);

  const perfilesUsoVehiculo = useMemo(() => {
    const order = ["uso_personal", "trabajo", "offroad"];
    return perfiles
      .filter((item) => item.categoria === "uso_vehiculo")
      .slice()
      .sort((a, b) => order.indexOf(a.valor) - order.indexOf(b.valor));
  }, [perfiles]);

  const modelYearHint = useMemo(() => {
    if (!selectedModelo) {
      return "Selecciona un modelo para ver el rango sugerido.";
    }

    const anioDesde = selectedModelo.anioDesde;
    const anioHasta = selectedModelo.anioHasta || new Date().getFullYear();
    return `Rango sugerido: ${anioDesde}-${anioHasta}`;
  }, [selectedModelo]);

  const requiresOpticalQuestion = decisionSistemaOptico?.requiresQuestion === true;
  const resolvedOpticalLabel = TIPO_SISTEMA_OPTICO_LABEL_BY_CODE[decisionSistemaOptico?.resolvedTipoSistemaOptico];

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((prev) => {
      if (name === "marcaId") {
        return {
          ...prev,
          marcaId: value,
          modeloId: "",
          anioVehiculo: "",
          tieneLupaProyector: ""
        };
      }

      if (name === "modeloId") {
        return {
          ...prev,
          modeloId: value,
          anioVehiculo: "",
          tieneLupaProyector: ""
        };
      }

      if (name === "anioVehiculo") {
        return {
          ...prev,
          anioVehiculo: value,
          tieneLupaProyector: ""
        };
      }

      return { ...prev, [name]: value };
    });

    if (name === "marcaId" || name === "modeloId" || name === "anioVehiculo") {
      setDecisionSistemaOptico(null);
    }

    setRecommendation(null);
    setApiError(null);
    setFieldErrors((prev) => ({
      ...prev,
      [name]: undefined,
      ...(name === "marcaId" || name === "modeloId" || name === "anioVehiculo"
        ? { tieneLupaProyector: undefined }
        : {})
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const errors = validate(form, requiresOpticalQuestion);
    setFieldErrors(errors);
    setApiError(null);

    if (Object.keys(errors).length > 0) {
      return;
    }

    let tipoSistemaOpticoCode = null;
    if (requiresOpticalQuestion) {
      tipoSistemaOpticoCode =
        form.tieneLupaProyector === "si"
          ? "lupa_proyector"
          : form.tieneLupaProyector === "no"
            ? "reflector_abierto"
            : null;
    } else if (decisionSistemaOptico?.resolvedTipoSistemaOptico) {
      tipoSistemaOpticoCode = decisionSistemaOptico.resolvedTipoSistemaOptico;
    }

    const tipoSistemaOpticoId = tipoSistemaOpticoCode
      ? TIPO_SISTEMA_OPTICO_ID_BY_CODE[tipoSistemaOpticoCode] ?? null
      : null;

    if (tipoSistemaOpticoCode && tipoSistemaOpticoId == null) {
      setApiError({
        title: "Catalogo incompleto",
        message: "No se pudo mapear el tipo de sistema optico detectado.",
        details: []
      });
      return;
    }

    const payload = {
      marcaId: toInteger(form.marcaId),
      modeloId: toInteger(form.modeloId),
      anioVehiculo: toInteger(form.anioVehiculo),
      horarioManejoPerfilId: toInteger(form.horarioManejoPerfilId),
      zonaManejoPerfilId: toInteger(form.zonaManejoPerfilId),
      usoVehiculoPerfilId: toInteger(form.usoVehiculoPerfilId),
      tipoPolarizadoId: toInteger(form.tipoPolarizadoId),
      tipoSistemaOpticoId
    };

    try {
      setSubmitting(true);
      const response = await resolverRecomendaciones(payload);
      setRecommendation(response);
    } catch (error) {
      setApiError(toApiErrorState(error));

      if (error?.status === 400 && Array.isArray(error?.details) && error.details.length > 0) {
        setFieldErrors((prev) => ({
          ...prev,
          ...detailsToFieldErrors(error.details)
        }));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <LoadingBlock text="Cargando datos de encuesta..." />;
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Encuesta y recomendacion</h2>
        <p>Completa los datos para obtener una recomendacion de luces LED.</p>
      </header>

      <ApiErrorBanner
        title={apiError?.title || "No se pudo recomendar"}
        message={apiError?.message}
        details={apiError?.details}
      />

      <form className="grid-form" onSubmit={handleSubmit} noValidate>
        <label>
          Marca
          <select name="marcaId" value={form.marcaId} onChange={handleChange}>
            <option value="">Seleccionar marca</option>
            {marcas.map((marca) => (
              <option key={marca.id} value={marca.id}>
                {marca.nombre}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors.marcaId} />
        </label>

        <label>
          Modelo
          <select
            name="modeloId"
            value={form.modeloId}
            onChange={handleChange}
            disabled={!form.marcaId}
          >
            <option value="">Seleccionar modelo</option>
            {filteredModelos.map((modelo) => (
              <option key={modelo.id} value={modelo.id}>
                {modelo.nombre}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors.modeloId} />
        </label>

        <label>
          Anio del vehiculo
          <input
            name="anioVehiculo"
            type="number"
            inputMode="numeric"
            placeholder="Ej: 2019"
            value={form.anioVehiculo}
            onChange={handleChange}
            disabled={!form.modeloId}
            min={selectedModelo?.anioDesde || 1900}
            max={selectedModelo?.anioHasta || new Date().getFullYear()}
          />
          <small className="field-hint">{modelYearHint}</small>
          {loadingDecisionSistemaOptico ? (
            <small className="field-hint">Detectando configuracion de faros para modelo y anio...</small>
          ) : null}
          {!loadingDecisionSistemaOptico && !requiresOpticalQuestion && resolvedOpticalLabel ? (
            <small className="field-hint">Sistema optico detectado automaticamente: {resolvedOpticalLabel}</small>
          ) : null}
          <FieldError message={fieldErrors.anioVehiculo} />
        </label>

        {requiresOpticalQuestion ? (
          <label>
            Tu vehiculo tiene faros con lupa/proyector?
            <select
              name="tieneLupaProyector"
              value={form.tieneLupaProyector}
              onChange={handleChange}
            >
              <option value="">Seleccionar</option>
              <option value="si">Si</option>
              <option value="no">No</option>
            </select>
            <FieldError message={fieldErrors.tieneLupaProyector} />
          </label>
        ) : null}

        <label>
          Cuando manejas principalmente?
          <select name="horarioManejoPerfilId" value={form.horarioManejoPerfilId} onChange={handleChange}>
            <option value="">Seleccionar horario</option>
            {perfilesHorario.map((perfil) => (
              <option key={perfil.id} value={perfil.id}>
                {perfil.descripcion}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors.horarioManejoPerfilId} />
        </label>

        <label>
          Donde manejas principalmente?
          <select name="zonaManejoPerfilId" value={form.zonaManejoPerfilId} onChange={handleChange}>
            <option value="">Seleccionar zona</option>
            {perfilesZona.map((perfil) => (
              <option key={perfil.id} value={perfil.id}>
                {perfil.descripcion}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors.zonaManejoPerfilId} />
        </label>

        <label>
          Como usas el vehiculo?
          <select name="usoVehiculoPerfilId" value={form.usoVehiculoPerfilId} onChange={handleChange}>
            <option value="">Seleccionar uso</option>
            {perfilesUsoVehiculo.map((perfil) => (
              <option key={perfil.id} value={perfil.id}>
                {perfil.descripcion}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors.usoVehiculoPerfilId} />
        </label>

        <label>
          Tipo de polarizado
          <select name="tipoPolarizadoId" value={form.tipoPolarizadoId} onChange={handleChange}>
            <option value="">Seleccionar polarizado</option>
            {tiposPolarizado.map((tipo) => (
              <option key={tipo.id} value={tipo.id}>
                {tipo.descripcion}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors.tipoPolarizadoId} />
        </label>

        <div className="form-actions full-width">
          <button className="btn primary" type="submit" disabled={submitting}>
            {submitting ? "Recomendando..." : "Recomendar"}
          </button>
        </div>
      </form>

      <RecommendationResults recommendation={recommendation} />
    </section>
  );
}

export default EncuestaPage;
