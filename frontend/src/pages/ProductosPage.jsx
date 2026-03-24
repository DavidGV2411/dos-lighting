import { useEffect, useMemo, useState } from "react";
import ApiErrorBanner from "../components/ApiErrorBanner";
import EmptyState from "../components/EmptyState";
import FieldError from "../components/FieldError";
import LoadingBlock from "../components/LoadingBlock";
import SuccessBanner from "../components/SuccessBanner";
import { getCasquillos, getGamasLuz, getMarcasLed } from "../services/catalogService";
import {
  createProductoLed,
  deleteProductoLed,
  getProductosLed,
  updateProductoLed
} from "../services/productoService";
import {
  buildDeleteErrorMessage,
  hasDuplicate,
  includesNormalized,
  normalizeText
} from "../utils/adminCrud";
import { toDecimal, toInteger } from "../utils/format";

const POSICIONES = ["cruce", "largo", "cruce_y_largo", "antiniebla", "todos"];
const SISTEMAS_OPTICOS = ["lupa_proyector", "reflector_abierto", "ambos"];

const EMPTY_FORM = {
  id: null,
  idMarcaLed: "",
  modelo: "",
  idCasquillo: "",
  posicionAplicable: "cruce",
  sistemaOpticoCompatible: "ambos",
  lumens: "",
  temperaturaColor: "",
  potenciaWatts: "",
  precio: "",
  disponible: true,
  imagenPath: "",
  notas: "",
  idGamaLuz: ""
};

function resolveGamaByPotenciaWatts(potenciaWatts, gamasLuz) {
  const potencia = Number(potenciaWatts);
  if (!Number.isFinite(potencia) || potencia < 0) {
    return "";
  }

  const gama = gamasLuz.find((item) => {
    if (!item?.activo) {
      return false;
    }
    const min = Number(item.potenciaWattsMin);
    const max = Number(item.potenciaWattsMax);
    return Number.isFinite(min) && Number.isFinite(max) && potencia >= min && potencia <= max;
  });

  return gama ? String(gama.id) : "";
}

function validateForm(form, items) {
  const errors = {};

  if (!form.idMarcaLed) errors.idMarcaLed = "Marca LED obligatoria.";
  if (!form.modelo.trim()) errors.modelo = "Modelo obligatorio.";
  if (!form.idCasquillo) errors.idCasquillo = "Casquillo obligatorio.";
  if (!form.posicionAplicable) errors.posicionAplicable = "Posicion obligatoria.";
  if (!form.sistemaOpticoCompatible) errors.sistemaOpticoCompatible = "Sistema optico obligatorio.";
  if (!form.lumens || Number(form.lumens) <= 0) errors.lumens = "Lumens debe ser mayor a 0.";
  if (!form.temperaturaColor || Number(form.temperaturaColor) <= 0) {
    errors.temperaturaColor = "Temperatura debe ser mayor a 0.";
  }
  if (!form.potenciaWatts || Number(form.potenciaWatts) <= 0) {
    errors.potenciaWatts = "Potencia debe ser mayor a 0.";
  }
  if (!form.idGamaLuz) {
    errors.idGamaLuz = "No hay gama configurada para esa potencia.";
  }
  if (form.precio === "" || Number(form.precio) < 0) {
    errors.precio = "Precio no puede ser negativo.";
  }

  if (
    form.modelo.trim() &&
    form.idMarcaLed &&
    form.idCasquillo &&
    hasDuplicate(
      items,
      form.id,
      (item) =>
        normalizeText(item.modelo) === normalizeText(form.modelo) &&
        String(item.idMarcaLed) === String(form.idMarcaLed) &&
        String(item.idCasquillo) === String(form.idCasquillo) &&
        String(item.posicionAplicable) === String(form.posicionAplicable) &&
        String(item.sistemaOpticoCompatible) === String(form.sistemaOpticoCompatible)
    )
  ) {
    errors.modelo = "Ya existe un producto con esa marca, modelo, casquillo y configuracion.";
  }

  return errors;
}

function mapToPayload(form) {
  return {
    idMarcaLed: toInteger(form.idMarcaLed),
    modelo: form.modelo.trim(),
    idCasquillo: toInteger(form.idCasquillo),
    posicionAplicable: form.posicionAplicable,
    sistemaOpticoCompatible: form.sistemaOpticoCompatible,
    lumens: toInteger(form.lumens),
    temperaturaColor: toInteger(form.temperaturaColor),
    potenciaWatts: toDecimal(form.potenciaWatts),
    precio: toDecimal(form.precio),
    disponible: Boolean(form.disponible),
    imagenPath: form.imagenPath.trim() || null,
    notas: form.notas.trim() || null,
    idGamaLuz: toInteger(form.idGamaLuz)
  };
}

function getPageAfterDelete(page, itemsLength) {
  if (page > 0 && itemsLength === 1) {
    return page - 1;
  }
  return page;
}

function ProductosPage() {
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

  const [marcasLed, setMarcasLed] = useState([]);
  const [casquillos, setCasquillos] = useState([]);
  const [gamasLuz, setGamasLuz] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    idMarcaLed: "",
    disponible: ""
  });
  const [draftFilters, setDraftFilters] = useState({
    search: "",
    idMarcaLed: "",
    disponible: ""
  });

  const [form, setForm] = useState(EMPTY_FORM);

  const marcasById = useMemo(
    () => Object.fromEntries(marcasLed.map((marca) => [marca.id, marca.nombre])),
    [marcasLed]
  );
  const casquillosById = useMemo(
    () => Object.fromEntries(casquillos.map((casquillo) => [casquillo.id, casquillo.codigo])),
    [casquillos]
  );

  const filteredItems = useMemo(
    () =>
      items
        .filter(
          (item) =>
            !filters.idMarcaLed || String(item.idMarcaLed) === String(filters.idMarcaLed)
        )
        .filter((item) => {
          if (!filters.disponible) {
            return true;
          }
          return filters.disponible === "si" ? item.disponible : !item.disponible;
        })
        .filter((item) => {
          const search = filters.search;
          return (
            includesNormalized(item.modelo, search) ||
            includesNormalized(marcasById[item.idMarcaLed], search) ||
            includesNormalized(casquillosById[item.idCasquillo], search)
          );
        }),
    [items, filters, marcasById, casquillosById]
  );

  useEffect(() => {
    async function loadCatalogs() {
      try {
        const [marcasData, casquillosData, gamasData] = await Promise.all([
          getMarcasLed(),
          getCasquillos(),
          getGamasLuz()
        ]);
        setMarcasLed(marcasData);
        setCasquillos(casquillosData);
        const gamasActivas = gamasData.filter((item) => item.activo);
        setGamasLuz(gamasActivas);
        setForm((prev) => ({
          ...prev,
          idGamaLuz: resolveGamaByPotenciaWatts(prev.potenciaWatts, gamasActivas)
        }));
      } catch (error) {
        setApiError({ message: error.message, details: error.details || [] });
      }
    }
    loadCatalogs();
  }, []);

  useEffect(() => {
    loadProductos(pageInfo.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageInfo.page]);

  async function loadProductos(page) {
    try {
      setLoading(true);
      setApiError(null);
      const response = await getProductosLed({ page, size: pageInfo.size, sort: "id,desc" });
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
    const { name, value, type, checked } = event.target;
    setForm((prev) => {
      const next = {
        ...prev,
        [name]: type === "checkbox" ? checked : value
      };
      if (name === "potenciaWatts") {
        next.idGamaLuz = resolveGamaByPotenciaWatts(value, gamasLuz);
      }
      return next;
    });
    setFormErrors((prev) => ({ ...prev, [name]: undefined, idGamaLuz: undefined }));
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
      idMarcaLed: "",
      disponible: ""
    };
    setDraftFilters(emptyFilters);
    setFilters(emptyFilters);
  }

  function handleEdit(item) {
    setForm({
      id: item.id,
      idMarcaLed: String(item.idMarcaLed),
      modelo: item.modelo || "",
      idCasquillo: String(item.idCasquillo),
      posicionAplicable: item.posicionAplicable || "cruce",
      sistemaOpticoCompatible: item.sistemaOpticoCompatible || "ambos",
      lumens: String(item.lumens ?? ""),
      temperaturaColor: String(item.temperaturaColor ?? ""),
      potenciaWatts: String(item.potenciaWatts ?? ""),
      precio: String(item.precio ?? ""),
      disponible: Boolean(item.disponible),
      imagenPath: item.imagenPath || "",
      notas: item.notas || "",
      idGamaLuz: item.idGamaLuz ? String(item.idGamaLuz) : ""
    });
    setFormErrors({});
    setApiError(null);
    setSuccessMessage("");
  }

  async function handleDelete(item) {
    const confirmed = window.confirm(`¿Eliminar el producto "${item.modelo}" (ID ${item.id})?`);
    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      setApiError(null);
      setSuccessMessage("");
      await deleteProductoLed(item.id);

      if (form.id === item.id) {
        resetForm();
      }

      const nextPage = getPageAfterDelete(pageInfo.page, items.length);
      if (nextPage !== pageInfo.page) {
        setPageInfo((prev) => ({ ...prev, page: nextPage }));
      } else {
        await loadProductos(nextPage);
      }
      setSuccessMessage(`Producto "${item.modelo}" eliminado correctamente.`);
    } catch (error) {
      setApiError({ message: buildDeleteErrorMessage("el producto", error), details: [] });
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
        await updateProductoLed(form.id, payload);
        setSuccessMessage(`Producto #${form.id} actualizado correctamente.`);
      } else {
        await createProductoLed(payload);
        setSuccessMessage("Producto creado correctamente.");
      }

      resetForm();
      await loadProductos(pageInfo.page);
    } catch (error) {
      setApiError({ message: error.message, details: error.details || [] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Modulo Productos LED</h2>
        <p>Gestion de catalogo de productos con formulario y listado paginado.</p>
      </header>

      <ApiErrorBanner
        title="Error en productos"
        message={apiError?.message}
        details={apiError?.details}
      />

      <SuccessBanner title="Cambios guardados" message={successMessage} />

      <div className="split-layout">
        <article className="panel section">
          <h3>{form.id ? `Editar producto #${form.id}` : "Crear producto"}</h3>
          <form className="grid-form" onSubmit={handleSubmit} noValidate>
            <label>
              Marca LED
              <select name="idMarcaLed" value={form.idMarcaLed} onChange={handleFormChange}>
                <option value="">Seleccionar</option>
                {marcasLed.map((marca) => (
                  <option key={marca.id} value={marca.id}>
                    {marca.nombre}
                  </option>
                ))}
              </select>
              <FieldError message={formErrors.idMarcaLed} />
            </label>

            <label>
              Modelo
              <input name="modelo" value={form.modelo} onChange={handleFormChange} maxLength={150} />
              <FieldError message={formErrors.modelo} />
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
              Posicion aplicable
              <select
                name="posicionAplicable"
                value={form.posicionAplicable}
                onChange={handleFormChange}
              >
                {POSICIONES.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
              <FieldError message={formErrors.posicionAplicable} />
            </label>

            <label>
              Sistema optico compatible
              <select
                name="sistemaOpticoCompatible"
                value={form.sistemaOpticoCompatible}
                onChange={handleFormChange}
              >
                {SISTEMAS_OPTICOS.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
              <FieldError message={formErrors.sistemaOpticoCompatible} />
            </label>

            <label>
              Lumens
              <input name="lumens" type="number" value={form.lumens} onChange={handleFormChange} />
              <FieldError message={formErrors.lumens} />
            </label>

            <label>
              Temperatura color (K)
              <input
                name="temperaturaColor"
                type="number"
                value={form.temperaturaColor}
                onChange={handleFormChange}
              />
              <FieldError message={formErrors.temperaturaColor} />
            </label>

            <label>
              Potencia (W)
              <input
                name="potenciaWatts"
                type="number"
                step="0.01"
                value={form.potenciaWatts}
                onChange={handleFormChange}
              />
              <FieldError message={formErrors.potenciaWatts} />
            </label>

            <label>
              Precio
              <input
                name="precio"
                type="number"
                step="0.01"
                value={form.precio}
                onChange={handleFormChange}
              />
              <FieldError message={formErrors.precio} />
            </label>

            <label>
              Gama luz (calculada por potencia W)
              <select name="idGamaLuz" value={form.idGamaLuz} onChange={handleFormChange} disabled>
                <option value="">Sin rango configurado</option>
                {gamasLuz.map((gama) => (
                  <option key={gama.id} value={gama.id}>
                    {gama.nombre}
                  </option>
                ))}
              </select>
              <FieldError message={formErrors.idGamaLuz} />
            </label>

            <label>
              Ruta imagen
              <input name="imagenPath" value={form.imagenPath} onChange={handleFormChange} maxLength={500} />
            </label>

            <label className="full-width">
              Notas
              <textarea name="notas" value={form.notas} onChange={handleFormChange} rows={3} maxLength={1200} />
            </label>

            <label className="inline-check full-width">
              <input
                type="checkbox"
                name="disponible"
                checked={form.disponible}
                onChange={handleFormChange}
              />
              Disponible
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
            <h3>Listado de productos</h3>
            <small>
              Filtrados: {filteredItems.length} de {items.length} en pagina / {pageInfo.totalElements} total
            </small>
          </header>

          <div className="filter-bar">
            <label className="filter-field">
              Buscar
              <input
                name="search"
                value={draftFilters.search}
                onChange={handleFilterChange}
                placeholder="Modelo, marca o casquillo"
              />
            </label>

            <label className="filter-field">
              Marca LED
              <select name="idMarcaLed" value={draftFilters.idMarcaLed} onChange={handleFilterChange}>
                <option value="">Todas</option>
                {marcasLed.map((marca) => (
                  <option key={marca.id} value={marca.id}>
                    {marca.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="filter-field">
              Disponibilidad
              <select name="disponible" value={draftFilters.disponible} onChange={handleFilterChange}>
                <option value="">Todas</option>
                <option value="si">Disponibles</option>
                <option value="no">No disponibles</option>
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
            <LoadingBlock text="Cargando productos..." />
          ) : filteredItems.length === 0 ? (
            <EmptyState title="Sin productos" description="No hay registros para mostrar con esos filtros." />
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Modelo</th>
                      <th>Marca</th>
                      <th>Casquillo</th>
                      <th>Precio</th>
                      <th>Disponible</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{item.modelo}</td>
                        <td>{marcasById[item.idMarcaLed] || item.idMarcaLed}</td>
                        <td>{casquillosById[item.idCasquillo] || item.idCasquillo}</td>
                        <td>{item.precio}</td>
                        <td>{item.disponible ? "Si" : "No"}</td>
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

export default ProductosPage;
