import { useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import ApiErrorBanner from "../components/ApiErrorBanner";
import FieldError from "../components/FieldError";
import { hasAuthSession, loginAdmin } from "../services/authService";

const parseNextPath = (search) => {
  const params = new URLSearchParams(search);
  const next = params.get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/productos";
  }
  return next;
};

function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const nextPath = useMemo(() => parseNextPath(location.search), [location.search]);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState({
    username: "",
    password: ""
  });

  if (hasAuthSession()) {
    return <Navigate to={nextPath} replace />;
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    setApiError(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const errors = {};
    if (!form.username.trim()) {
      errors.username = "Usuario obligatorio.";
    }
    if (!form.password) {
      errors.password = "Contrasena obligatoria.";
    }
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      setSubmitting(true);
      await loginAdmin({
        username: form.username.trim(),
        password: form.password
      });
      navigate(nextPath, { replace: true });
    } catch (error) {
      setApiError({
        message: error?.message || "No fue posible iniciar sesion.",
        details: error?.details || []
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel login-panel">
      <header className="panel-header">
        <h2>Acceso administrador</h2>
        <p>Solo el usuario admin puede acceder al CRUD e inventario.</p>
      </header>

      <ApiErrorBanner
        title="Error de autenticacion"
        message={apiError?.message}
        details={apiError?.details}
      />

      <form className="grid-form login-form" onSubmit={handleSubmit} noValidate>
        <label className="full-width">
          Usuario
          <input
            name="username"
            autoComplete="username"
            value={form.username}
            onChange={handleChange}
            maxLength={50}
          />
          <FieldError message={fieldErrors.username} />
        </label>

        <label className="full-width">
          Contrasena
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange}
            maxLength={200}
          />
          <FieldError message={fieldErrors.password} />
        </label>

        <div className="form-actions full-width">
          <button className="btn primary" type="submit" disabled={submitting}>
            {submitting ? "Ingresando..." : "Ingresar"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default LoginPage;
