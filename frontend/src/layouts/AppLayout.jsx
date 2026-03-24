import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import ChatWidget from "../components/ChatWidget";
import { hasAuthSession, logoutAdmin } from "../services/authService";

const publicLinks = [
  { to: "/encuesta", label: "Encuesta" }
];

const adminLinks = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/marcas-vehiculo", label: "Marcas" },
  { to: "/modelos-vehiculo", label: "Modelos" },
  { to: "/productos", label: "Productos LED" },
  { to: "/compatibilidades", label: "Compatibilidades" }
];

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(hasAuthSession());
  const showChatWidget = !isAuthenticated && location.pathname !== "/login";

  useEffect(() => {
    setIsAuthenticated(hasAuthSession());
  }, [location.pathname]);

  async function handleLogout() {
    await logoutAdmin();
    setIsAuthenticated(false);
    navigate("/encuesta", { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-copy">
          <p className="eyebrow">Over Tech</p>
          <h1>DOS LIGTHING</h1>
          <p className="brand-subtitle">Iluminacion automotriz, recomendaciones e inventario</p>
        </div>
      </header>

      <nav className="app-nav" aria-label="Navegacion principal">
        <div className="nav-links">
          {publicLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              {link.label}
            </NavLink>
          ))}

          {isAuthenticated
            ? adminLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
                >
                  {link.label}
                </NavLink>
              ))
            : null}
        </div>

        <div className="nav-actions">
          {isAuthenticated ? (
            <button type="button" className="btn secondary" onClick={handleLogout}>
              Cerrar sesion
            </button>
          ) : (
            <NavLink
              to="/login"
              className={({ isActive }) => `nav-link admin-icon-link${isActive ? " active" : ""}`}
              aria-label="Iniciar sesion de administrador"
              title="Acceso administrador"
            >
              <svg className="admin-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M7 10V8a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1Zm2 0h6V8a3 3 0 0 0-6 0v2Zm3 3a2 2 0 0 1 1 3.732V18a1 1 0 1 1-2 0v-1.268A2 2 0 0 1 12 13Z" />
              </svg>
              <span className="sr-only">Admin login</span>
            </NavLink>
          )}
        </div>
      </nav>

      <main className="app-content">
        <Outlet />
      </main>

      <ChatWidget show={showChatWidget} />
    </div>
  );
}

export default AppLayout;
