import { useEffect, useMemo, useState } from "react";
import ApiErrorBanner from "../components/ApiErrorBanner";
import EmptyState from "../components/EmptyState";
import FieldError from "../components/FieldError";
import LoadingBlock from "../components/LoadingBlock";
import SuccessBanner from "../components/SuccessBanner";
import { getTiposVehiculo } from "../services/catalogService";
import {
  createMarcaVehiculo,
  deleteMarcaVehiculo,
  getMarcasVehiculoCrud,
  updateMarcaVehiculo
} from "../services/marcaVehiculoService";
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
  idTipoVehiculo: ""
};

function validateForm(form, items) {
  const errors = {};
  const nombre = form.nombre.trim();

  if (!nombre) {
    errors.nombre = "Nombre obligatorio.";
  }

  if (!form.idTipoVehiculo) {
    errors.idTipoVehiculo = "Tipo de vehiculo obligatorio.";
  }

  if (
    nombre &&
    hasDuplicate(
      items,
      form.id,
      (item) => normalizeText(item.nombre) === normalizeText(nombre)
    )
  ) {
    errors.nombre = "Ya existe una marca de vehiculo con ese nombre.";
  }

  return errors;
}

function mapToPayload(form) {
  return {
    nombre: form.nombre.trim(),
    idTipoVehiculo: toInteger(form.idTipoVehiculo)
  };
}

function MarcasVehiculoPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [items, setItems] = useState([]);
  const [tiposVehiculo, setTiposVehiculo] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    idTipoVehiculo: ""
  });
  const [draftFilters, setDraftFilters] = useState({
    search: "",
    idTipoVehiculo: ""
  });
  const [form, setForm] = useState(EMPTY_FORM);

  const tiposById = useMemo(
    () => Object.fromEntries(tiposVehiculo.map((tipo) => [tipo.id, tipo.nombre])),
    [tiposVehiculo]
  );

  const filteredItems = useMemo(
    () =>
      items
        .filter((item) =>
          !filters.idTipoVehiculo || String(item.idTipoVehiculo) === String(filters.idTipoVehiculo)
        )
        .filter(
          (item) =>
            includesNormalized(item.nombre, filters.search) ||
            includesNormalized(tiposById[item.idTipoVehiculo], filters.search)
        )
        .sort((left, right) => left.nombre.localeCompare(right.nombre)),
    [items, filters, tiposById]
  );

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        setApiError(null);
        const [tiposData, marcasData] = await Promise.all([
          getTiposVehiculo(),
          getMarcasVehiculoCrud()
        ]);
        setTiposVehiculo(tiposData);
        setItems(marcasData);
      } catch (error) {
        setApiError({ message: error.message, details: error.details || [] });
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, []);

  async function reloadMarcas() {
    const marcasData = await getMarcasVehiculoCrud();
    setItems(marcasData);
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
      idTipoVehiculo: ""
    };
    setDraftFilters(emptyFilters);
    setFilters(emptyFilters);
  }

  function handleEdit(item) {
    setForm({
      id: item.id,
      nombre: item.nombre || "",
      idTipoVehiculo: String(item.idTipoVehiculo)
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
        await updateMarcaVehiculo(form.id, payload);
        setSuccessMessage(`Marca de vehiculo #${form.id} actualizada correctamente.`);
      } else {
        await createMarcaVehiculo(payload);
        setSuccessMessage("Marca de vehiculo creada correctamente.");
      }

      resetForm();
      await reloadMarcas();
    } catch (error) {
      setApiError({ message: error.message, details: error.details || [] });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    const confirmed = window.confirm(`¿Eliminar la marca de vehiculo "${item.nombre}" (ID ${item.id})?`);
    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      setApiError(null);
      setSuccessMessage("");
      await deleteMarcaVehiculo(item.id);

      if (form.id === item.id) {
        resetForm();
      }

      await reloadMarcas();
      setSuccessMessage(`Marca de vehiculo "${item.nombre}" eliminada correctamente.`);
    } catch (error) {
      setApiError({ message: buildDeleteErrorMessage("la marca de vehiculo", error), details: [] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Modulo Marcas de Vehiculo</h2>
        <p>Gestion de marcas de vehiculo y su clasificacion por tipo.</p>
      </header>

      <ApiErrorBanner
        title="Error en marcas de vehiculo"
        message={apiError?.message}
        details={apiError?.details}
      />

      <SuccessBanner title="Cambios guardados" message={successMessage} />

      <div className="split-layout">
        <article className="panel section">
          <h3>{form.id ? `Editar marca #${form.id}` : "Crear marca"}</h3>
          <form className="grid-form" onSubmit={handleSubmit} noValidate>
            <label>
              Nombre de la marca
              <input name="nombre" value={form.nombre} onChange={handleFormChange} maxLength={120} />
              <FieldError message={formErrors.nombre} />
            </label>

            <label>
              Tipo de vehiculo
              <select
                name="idTipoVehiculo"
                value={form.idTipoVehiculo}
                onChange={handleFormChange}
              >
                <option value="">Seleccionar</option>
                {tiposVehiculo.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre}
                  </option>
                ))}
              </select>
              <FieldError message={formErrors.idTipoVehiculo} />
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
            <h3>Listado de marcas</h3>
            <small>Total filtrado: {filteredItems.length}</small>
          </header>

          <div className="filter-bar">
            <label className="filter-field">
              Buscar
              <input
                name="search"
                value={draftFilters.search}
                onChange={handleFilterChange}
                placeholder="Marca o tipo de vehiculo"
              />
            </label>

            <label className="filter-field">
              Tipo de vehiculo
              <select
                name="idTipoVehiculo"
                value={draftFilters.idTipoVehiculo}
                onChange={handleFilterChange}
              >
                <option value="">Todos</option>
                {tiposVehiculo.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre}
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
            <LoadingBlock text="Cargando marcas..." />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              title="Sin marcas"
              description="No hay marcas que coincidan con los filtros actuales."
            />
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Marca</th>
                    <th>Tipo</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.nombre}</td>
                      <td>{tiposById[item.idTipoVehiculo] || item.idTipoVehiculo}</td>
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

export default MarcasVehiculoPage;
