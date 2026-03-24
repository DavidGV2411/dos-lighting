import { useEffect, useMemo, useState } from "react";
import ApiErrorBanner from "../components/ApiErrorBanner";
import EmptyState from "../components/EmptyState";
import FieldError from "../components/FieldError";
import LoadingBlock from "../components/LoadingBlock";
import SuccessBanner from "../components/SuccessBanner";
import { getMarcasVehiculo } from "../services/catalogService";
import {
  createModeloVehiculo,
  deleteModeloVehiculo,
  getModelosVehiculoCrud,
  updateModeloVehiculo
} from "../services/modeloVehiculoService";
import {
  buildDeleteErrorMessage,
  hasDuplicate,
  includesNormalized,
  normalizeText
} from "../utils/adminCrud";
import { toInteger } from "../utils/format";

const EMPTY_FORM = {
  id: null,
  nombre: "",
  idMarca: "",
  anioDesde: "",
  anioHasta: ""
};

function validateForm(form, items) {
  const errors = {};
  const nombre = form.nombre.trim();
  const idMarca = toInteger(form.idMarca);
  const anioDesde = toInteger(form.anioDesde);
  const anioHasta = toInteger(form.anioHasta);

  if (!nombre) {
    errors.nombre = "Nombre obligatorio.";
  }

  if (!form.idMarca) {
    errors.idMarca = "Marca obligatoria.";
  }

  if (!form.anioDesde || Number(form.anioDesde) < 1900) {
    errors.anioDesde = "Ano desde invalido.";
  }

  if (form.anioHasta && Number(form.anioHasta) < Number(form.anioDesde)) {
    errors.anioHasta = "Ano hasta no puede ser menor que ano desde.";
  }

  if (
    nombre &&
    idMarca &&
    anioDesde &&
    hasDuplicate(
      items,
      form.id,
      (item) =>
        normalizeText(item.nombre) === normalizeText(nombre) &&
        Number(item.idMarca) === idMarca &&
        Number(item.anioDesde) === anioDesde &&
        (item.anioHasta == null ? null : Number(item.anioHasta)) === anioHasta
    )
  ) {
    errors.nombre = "Ya existe un modelo con la misma marca y rango de anos.";
  }

  return errors;
}

function mapToPayload(form) {
  return {
    nombre: form.nombre.trim(),
    idMarca: toInteger(form.idMarca),
    anioDesde: toInteger(form.anioDesde),
    anioHasta: toInteger(form.anioHasta)
  };
}

function ModelosVehiculoPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [items, setItems] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    idMarca: ""
  });
  const [draftFilters, setDraftFilters] = useState({
    search: "",
    idMarca: ""
  });
  const [form, setForm] = useState(EMPTY_FORM);

  const marcasById = useMemo(
    () => Object.fromEntries(marcas.map((marca) => [marca.id, marca.nombre])),
    [marcas]
  );

  const filteredItems = useMemo(
    () =>
      items
        .filter((item) => !filters.idMarca || String(item.idMarca) === String(filters.idMarca))
        .filter(
          (item) =>
            includesNormalized(item.nombre, filters.search) ||
            includesNormalized(marcasById[item.idMarca], filters.search)
        )
        .sort((left, right) => {
          if (right.id !== left.id) {
            return right.id - left.id;
          }
          return String(left.nombre).localeCompare(String(right.nombre));
        }),
    [items, filters, marcasById]
  );

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        setApiError(null);
        const [marcasData, modelosData] = await Promise.all([
          getMarcasVehiculo(),
          getModelosVehiculoCrud()
        ]);
        setMarcas(marcasData);
        setItems(modelosData);
      } catch (error) {
        setApiError({ message: error.message, details: error.details || [] });
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, []);

  async function reloadModelos() {
    const modelosData = await getModelosVehiculoCrud();
    setItems(modelosData);
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setFormErrors({});
  }

  function handleFormChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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
      idMarca: ""
    };
    setDraftFilters(emptyFilters);
    setFilters(emptyFilters);
  }

  function handleEdit(item) {
    setForm({
      id: item.id,
      nombre: item.nombre || "",
      idMarca: String(item.idMarca),
      anioDesde: String(item.anioDesde ?? ""),
      anioHasta: item.anioHasta == null ? "" : String(item.anioHasta)
    });
    setFormErrors({});
    setApiError(null);
    setSuccessMessage("");
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
        await updateModeloVehiculo(form.id, payload);
        setSuccessMessage(`Modelo #${form.id} actualizado correctamente.`);
      } else {
        await createModeloVehiculo(payload);
        setSuccessMessage("Modelo creado correctamente.");
      }

      resetForm();
      await reloadModelos();
    } catch (error) {
      setApiError({ message: error.message, details: error.details || [] });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    const confirmed = window.confirm(`¿Eliminar el modelo "${item.nombre}" (ID ${item.id})?`);
    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      setApiError(null);
      setSuccessMessage("");
      await deleteModeloVehiculo(item.id);

      if (form.id === item.id) {
        resetForm();
      }

      await reloadModelos();
      setSuccessMessage(`Modelo "${item.nombre}" eliminado correctamente.`);
    } catch (error) {
      setApiError({ message: buildDeleteErrorMessage("el modelo", error), details: [] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Modulo Modelos de Vehiculo</h2>
        <p>Gestion de modelos por marca y rango de anos para ampliar el catalogo vehicular.</p>
      </header>

      <ApiErrorBanner
        title="Error en modelos de vehiculo"
        message={apiError?.message}
        details={apiError?.details}
      />

      <SuccessBanner title="Cambios guardados" message={successMessage} />

      <div className="split-layout">
        <article className="panel section">
          <h3>{form.id ? `Editar modelo #${form.id}` : "Crear modelo"}</h3>
          <form className="grid-form" onSubmit={handleSubmit} noValidate>
            <label>
              Nombre del modelo
              <input name="nombre" value={form.nombre} onChange={handleFormChange} maxLength={150} />
              <FieldError message={formErrors.nombre} />
            </label>

            <label>
              Marca
              <select name="idMarca" value={form.idMarca} onChange={handleFormChange}>
                <option value="">Seleccionar</option>
                {marcas.map((marca) => (
                  <option key={marca.id} value={marca.id}>
                    {marca.nombre}
                  </option>
                ))}
              </select>
              <FieldError message={formErrors.idMarca} />
            </label>

            <label>
              Ano desde
              <input
                name="anioDesde"
                type="number"
                inputMode="numeric"
                value={form.anioDesde}
                onChange={handleFormChange}
              />
              <FieldError message={formErrors.anioDesde} />
            </label>

            <label>
              Ano hasta (opcional)
              <input
                name="anioHasta"
                type="number"
                inputMode="numeric"
                value={form.anioHasta}
                onChange={handleFormChange}
              />
              <FieldError message={formErrors.anioHasta} />
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
            <h3>Listado de modelos</h3>
            <small>
              Total filtrado: {filteredItems.length} de {items.length}
            </small>
          </header>

          <div className="filter-bar">
            <label className="filter-field">
              Buscar
              <input
                name="search"
                value={draftFilters.search}
                onChange={handleFilterChange}
                placeholder="Modelo o marca"
              />
            </label>

            <label className="filter-field">
              Marca
              <select name="idMarca" value={draftFilters.idMarca} onChange={handleFilterChange}>
                <option value="">Todas</option>
                {marcas.map((marca) => (
                  <option key={marca.id} value={marca.id}>
                    {marca.nombre}
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
            <LoadingBlock text="Cargando modelos..." />
          ) : filteredItems.length === 0 ? (
            <EmptyState title="Sin modelos" description="No hay modelos que coincidan con los filtros." />
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Modelo</th>
                    <th>Marca</th>
                    <th>Anos</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.nombre}</td>
                      <td>{marcasById[item.idMarca] || item.idMarca}</td>
                      <td>
                        {item.anioDesde} - {item.anioHasta ?? "Actual"}
                      </td>
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
          )}
        </article>
      </div>
    </section>
  );
}

export default ModelosVehiculoPage;
