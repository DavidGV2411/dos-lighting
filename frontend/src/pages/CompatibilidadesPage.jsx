import { useEffect, useMemo, useState } from "react";
import ApiErrorBanner from "../components/ApiErrorBanner";
import EmptyState from "../components/EmptyState";
import FieldError from "../components/FieldError";
import LoadingBlock from "../components/LoadingBlock";
import SuccessBanner from "../components/SuccessBanner";
import { getCasquillos, getGeneracionesModelo, getModelosVehiculo } from "../services/catalogService";
import {
  createCompatibilidad,
  deleteCompatibilidad,
  getCompatibilidades,
  updateCompatibilidad
} from "../services/compatibilidadService";
import {
  buildDeleteErrorMessage,
  hasDuplicate,
  includesNormalized
} from "../utils/adminCrud";
import { toInteger } from "../utils/format";

const POSICIONES = ["cruce", "largo", "cruce_y_largo", "antiniebla"];
const SISTEMAS_OPTICOS = ["lupa_proyector", "reflector_abierto"];

const EMPTY_FORM = {
  id: null,
  idModelo: "",
  idGeneracionModelo: "",
  anioDesde: "",
  anioHasta: "",
  posicionLuz: "cruce",
  idCasquillo: "",
  tipoSistemaOptico: "reflector_abierto"
};

function validateForm(form, items) {
  const errors = {};
  const idModelo = toInteger(form.idModelo);
  const idGeneracionModelo = toInteger(form.idGeneracionModelo);
  const anioDesde = toInteger(form.anioDesde);
  const anioHasta = toInteger(form.anioHasta);
  const idCasquillo = toInteger(form.idCasquillo);

  if (!form.idModelo) errors.idModelo = "Modelo obligatorio.";
  if (!form.anioDesde || Number(form.anioDesde) < 1900) errors.anioDesde = "Ano desde invalido.";
  if (form.anioHasta && Number(form.anioHasta) < Number(form.anioDesde)) {
    errors.anioHasta = "Ano hasta no puede ser menor que ano desde.";
  }
  if (!form.idCasquillo) errors.idCasquillo = "Casquillo obligatorio.";
  if (!form.posicionLuz) errors.posicionLuz = "Posicion obligatoria.";
  if (!form.tipoSistemaOptico) errors.tipoSistemaOptico = "Sistema optico obligatorio.";

  if (
    idModelo &&
    anioDesde &&
    idCasquillo &&
    hasDuplicate(
      items,
      form.id,
      (item) =>
        Number(item.idModelo) === idModelo &&
        (item.idGeneracionModelo == null ? null : Number(item.idGeneracionModelo)) === idGeneracionModelo &&
        Number(item.anioDesde) === anioDesde &&
        (item.anioHasta == null ? null : Number(item.anioHasta)) === anioHasta &&
        String(item.posicionLuz) === String(form.posicionLuz) &&
        Number(item.idCasquillo) === idCasquillo &&
        String(item.tipoSistemaOptico) === String(form.tipoSistemaOptico)
    )
  ) {
    errors.idModelo = "Ya existe una compatibilidad con la misma configuracion y rango de anos.";
  }

  return errors;
}

function mapToPayload(form) {
  return {
    idModelo: toInteger(form.idModelo),
    idGeneracionModelo: toInteger(form.idGeneracionModelo),
    anioDesde: toInteger(form.anioDesde),
    anioHasta: toInteger(form.anioHasta),
    posicionLuz: form.posicionLuz,
    idCasquillo: toInteger(form.idCasquillo),
    tipoSistemaOptico: form.tipoSistemaOptico
  };
}

function getPageAfterDelete(page, itemsLength) {
  if (page > 0 && itemsLength === 1) {
    return page - 1;
  }
  return page;
}

function CompatibilidadesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [formErrors, setFormErrors] = useState({});

  const [items, setItems] = useState([]);
  const [pageInfo, setPageInfo] = useState({
    page: 0,
    size: 10,
    totalPages: 0,
    totalElements: 0,
    first: true,
    last: true
  });

  const [modelos, setModelos] = useState([]);
  const [generaciones, setGeneraciones] = useState([]);
  const [casquillos, setCasquillos] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    posicionLuz: "",
    tipoSistemaOptico: ""
  });
  const [draftFilters, setDraftFilters] = useState({
    search: "",
    posicionLuz: "",
    tipoSistemaOptico: ""
  });

  const [form, setForm] = useState(EMPTY_FORM);

  const modelosById = useMemo(
    () => Object.fromEntries(modelos.map((modelo) => [modelo.id, modelo.nombre])),
    [modelos]
  );

  const generacionesById = useMemo(
    () => Object.fromEntries(generaciones.map((gen) => [gen.id, gen.nombre])),
    [generaciones]
  );

  const casquillosById = useMemo(
    () => Object.fromEntries(casquillos.map((casquillo) => [casquillo.id, casquillo.codigo])),
    [casquillos]
  );

  const generacionesFiltradas = useMemo(() => {
    if (!form.idModelo) {
      return generaciones;
    }
    const idModelo = toInteger(form.idModelo);
    return generaciones.filter((item) => item.idModelo === idModelo && item.activo);
  }, [form.idModelo, generaciones]);

  const filteredItems = useMemo(
    () =>
      items
        .filter((item) => !filters.posicionLuz || item.posicionLuz === filters.posicionLuz)
        .filter(
          (item) =>
            !filters.tipoSistemaOptico || item.tipoSistemaOptico === filters.tipoSistemaOptico
        )
        .filter((item) => {
          const search = filters.search;
          return (
            includesNormalized(modelosById[item.idModelo], search) ||
            includesNormalized(generacionesById[item.idGeneracionModelo], search) ||
            includesNormalized(casquillosById[item.idCasquillo], search)
          );
        }),
    [items, filters, modelosById, generacionesById, casquillosById]
  );

  useEffect(() => {
    async function loadCatalogs() {
      try {
        const [modelosData, generacionesData, casquillosData] = await Promise.all([
          getModelosVehiculo(),
          getGeneracionesModelo(),
          getCasquillos()
        ]);
        setModelos(modelosData);
        setGeneraciones(generacionesData);
        setCasquillos(casquillosData);
      } catch (error) {
        setApiError({ message: error.message, details: error.details || [] });
      }
    }

    loadCatalogs();
  }, []);

  useEffect(() => {
    loadCompatibilidades(pageInfo.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageInfo.page]);

  async function loadCompatibilidades(page) {
    try {
      setLoading(true);
      setApiError(null);
      const response = await getCompatibilidades({ page, size: pageInfo.size, sort: "id,desc" });
      setItems(response.content || []);
      setPageInfo((prev) => ({
        ...prev,
        page: response.page,
        size: response.size,
        totalPages: response.totalPages,
        totalElements: response.totalElements,
        first: response.first,
        last: response.last
      }));
    } catch (error) {
      setApiError({ message: error.message, details: error.details || [] });
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setFormErrors({});
  }

  function handleFormChange(event) {
    const { name, value } = event.target;
    setForm((prev) => {
      if (name === "idModelo") {
        return {
          ...prev,
          idModelo: value,
          idGeneracionModelo: ""
        };
      }
      return { ...prev, [name]: value };
    });
    setFormErrors((prev) => ({ ...prev, [name]: undefined }));
    setApiError(null);
    setSuccessMessage("");
  }

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setDraftFilters((prev) => ({ ...prev, [name]: value }));
  }

  function handleApplyFilters() {
    setFilters(draftFilters);
  }

  function handleResetFilters() {
    const emptyFilters = {
      search: "",
      posicionLuz: "",
      tipoSistemaOptico: ""
    };
    setDraftFilters(emptyFilters);
    setFilters(emptyFilters);
  }

  function handleEdit(item) {
    setForm({
      id: item.id,
      idModelo: String(item.idModelo),
      idGeneracionModelo: item.idGeneracionModelo ? String(item.idGeneracionModelo) : "",
      anioDesde: String(item.anioDesde ?? ""),
      anioHasta: item.anioHasta ? String(item.anioHasta) : "",
      posicionLuz: item.posicionLuz,
      idCasquillo: String(item.idCasquillo),
      tipoSistemaOptico: item.tipoSistemaOptico
    });
    setFormErrors({});
    setApiError(null);
    setSuccessMessage("");
  }

  async function handleDelete(item) {
    const confirmed = window.confirm(`¿Eliminar la compatibilidad #${item.id}?`);
    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      setApiError(null);
      setSuccessMessage("");
      await deleteCompatibilidad(item.id);

      if (form.id === item.id) {
        resetForm();
      }

      const nextPage = getPageAfterDelete(pageInfo.page, items.length);
      if (nextPage !== pageInfo.page) {
        setPageInfo((prev) => ({ ...prev, page: nextPage }));
      } else {
        await loadCompatibilidades(nextPage);
      }
      setSuccessMessage(`Compatibilidad #${item.id} eliminada correctamente.`);
    } catch (error) {
      setApiError({ message: buildDeleteErrorMessage("la compatibilidad", error), details: [] });
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const errors = validateForm(form, items);
    setFormErrors(errors);
    setApiError(null);
    setSuccessMessage("");
    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      setSaving(true);
      const payload = mapToPayload(form);

      if (form.id) {
        await updateCompatibilidad(form.id, payload);
        setSuccessMessage(`Compatibilidad #${form.id} actualizada correctamente.`);
      } else {
        await createCompatibilidad(payload);
        setSuccessMessage("Compatibilidad creada correctamente.");
      }

      resetForm();
      await loadCompatibilidades(pageInfo.page);
    } catch (error) {
      setApiError({ message: error.message, details: error.details || [] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Modulo Compatibilidades</h2>
        <p>Gestion de relaciones vehiculo/casquillo por posicion y sistema optico.</p>
      </header>

      <ApiErrorBanner
        title="Error en compatibilidades"
        message={apiError?.message}
        details={apiError?.details}
      />

      <SuccessBanner title="Cambios guardados" message={successMessage} />

      <div className="split-layout">
        <article className="panel section">
          <h3>{form.id ? `Editar compatibilidad #${form.id}` : "Crear compatibilidad"}</h3>
          <form className="grid-form" onSubmit={handleSubmit} noValidate>
            <label>
              Modelo
              <select name="idModelo" value={form.idModelo} onChange={handleFormChange}>
                <option value="">Seleccionar</option>
                {modelos.map((modelo) => (
                  <option key={modelo.id} value={modelo.id}>
                    {modelo.nombre}
                  </option>
                ))}
              </select>
              <FieldError message={formErrors.idModelo} />
            </label>

            <label>
              Generacion (opcional)
              <select
                name="idGeneracionModelo"
                value={form.idGeneracionModelo}
                onChange={handleFormChange}
              >
                <option value="">Sin generacion</option>
                {generacionesFiltradas.map((gen) => (
                  <option key={gen.id} value={gen.id}>
                    {gen.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Ano desde
              <input name="anioDesde" type="number" value={form.anioDesde} onChange={handleFormChange} />
              <FieldError message={formErrors.anioDesde} />
            </label>

            <label>
              Ano hasta (opcional)
              <input name="anioHasta" type="number" value={form.anioHasta} onChange={handleFormChange} />
              <FieldError message={formErrors.anioHasta} />
            </label>

            <label>
              Posicion luz
              <select name="posicionLuz" value={form.posicionLuz} onChange={handleFormChange}>
                {POSICIONES.map((posicion) => (
                  <option key={posicion} value={posicion}>
                    {posicion}
                  </option>
                ))}
              </select>
              <FieldError message={formErrors.posicionLuz} />
            </label>

            <label>
              Casquillo
              <select name="idCasquillo" value={form.idCasquillo} onChange={handleFormChange}>
                <option value="">Seleccionar</option>
                {casquillos.map((casquillo) => (
                  <option key={casquillo.id} value={casquillo.id}>
                    {casquillo.codigo}
                  </option>
                ))}
              </select>
              <FieldError message={formErrors.idCasquillo} />
            </label>

            <label>
              Tipo sistema optico
              <select
                name="tipoSistemaOptico"
                value={form.tipoSistemaOptico}
                onChange={handleFormChange}
              >
                {SISTEMAS_OPTICOS.map((sistema) => (
                  <option key={sistema} value={sistema}>
                    {sistema}
                  </option>
                ))}
              </select>
              <FieldError message={formErrors.tipoSistemaOptico} />
            </label>

            <div className="form-actions full-width">
              <button className="btn primary" type="submit" disabled={saving}>
                {saving ? "Guardando..." : form.id ? "Actualizar" : "Crear"}
              </button>
              <button className="btn secondary" type="button" onClick={resetForm}>
                Limpiar
              </button>
            </div>
          </form>
        </article>

        <article className="panel section">
          <header className="section-header">
            <h3>Listado de compatibilidades</h3>
            <small>
              Filtradas: {filteredItems.length} de {items.length} en pagina / {pageInfo.totalElements} total
            </small>
          </header>

          <div className="filter-bar">
            <label className="filter-field">
              Buscar
              <input
                name="search"
                value={draftFilters.search}
                onChange={handleFilterChange}
                placeholder="Modelo, generacion o casquillo"
              />
            </label>

            <label className="filter-field">
              Posicion
              <select name="posicionLuz" value={draftFilters.posicionLuz} onChange={handleFilterChange}>
                <option value="">Todas</option>
                {POSICIONES.map((posicion) => (
                  <option key={posicion} value={posicion}>
                    {posicion}
                  </option>
                ))}
              </select>
            </label>

            <label className="filter-field">
              Optica
              <select
                name="tipoSistemaOptico"
                value={draftFilters.tipoSistemaOptico}
                onChange={handleFilterChange}
              >
                <option value="">Todas</option>
                {SISTEMAS_OPTICOS.map((sistema) => (
                  <option key={sistema} value={sistema}>
                    {sistema}
                  </option>
                ))}
              </select>
            </label>

            <div className="filter-actions">
              <button className="btn secondary" type="button" onClick={handleApplyFilters}>
                Buscar
              </button>
              <button className="btn secondary" type="button" onClick={handleResetFilters}>
                Limpiar
              </button>
            </div>
          </div>

          {loading ? (
            <LoadingBlock text="Cargando compatibilidades..." />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              title="Sin compatibilidades"
              description="No hay registros cargados con esos filtros."
            />
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Modelo</th>
                      <th>Generacion</th>
                      <th>Anos</th>
                      <th>Posicion</th>
                      <th>Casquillo</th>
                      <th>Optica</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{modelosById[item.idModelo] || item.idModelo}</td>
                        <td>
                          {item.idGeneracionModelo
                            ? generacionesById[item.idGeneracionModelo] || item.idGeneracionModelo
                            : "-"}
                        </td>
                        <td>
                          {item.anioDesde} - {item.anioHasta ?? "Actual"}
                        </td>
                        <td>{item.posicionLuz}</td>
                        <td>{casquillosById[item.idCasquillo] || item.idCasquillo}</td>
                        <td>{item.tipoSistemaOptico}</td>
                        <td>
                          <div className="table-actions">
                            <button className="btn tiny" type="button" onClick={() => handleEdit(item)}>
                              Editar
                            </button>
                            <button
                              className="btn tiny danger"
                              type="button"
                              onClick={() => handleDelete(item)}
                              disabled={saving}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pagination-bar">
                <button
                  className="btn secondary"
                  type="button"
                  disabled={pageInfo.first}
                  onClick={() => setPageInfo((prev) => ({ ...prev, page: prev.page - 1 }))}
                >
                  Anterior
                </button>
                <span>
                  Pagina {pageInfo.page + 1} de {Math.max(pageInfo.totalPages, 1)}
                </span>
                <button
                  className="btn secondary"
                  type="button"
                  disabled={pageInfo.last}
                  onClick={() => setPageInfo((prev) => ({ ...prev, page: prev.page + 1 }))}
                >
                  Siguiente
                </button>
              </div>
            </>
          )}
        </article>
      </div>
    </section>
  );
}

export default CompatibilidadesPage;
