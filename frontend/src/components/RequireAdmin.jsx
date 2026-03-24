import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { fetchAuthUser, hasAuthSession } from "../services/authService";
import LoadingBlock from "./LoadingBlock";

function RequireAdmin() {
  const location = useLocation();
  const [status, setStatus] = useState(() => (hasAuthSession() ? "checking" : "unauthorized"));

  useEffect(() => {
    let isCancelled = false;

    if (!hasAuthSession()) {
      setStatus("unauthorized");
      return () => {
        isCancelled = true;
      };
    }

    setStatus("checking");
    fetchAuthUser().then((user) => {
      if (!isCancelled) {
        setStatus(user ? "authorized" : "unauthorized");
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [location.pathname]);

  if (status === "checking") {
    return <LoadingBlock text="Validando acceso de administrador..." />;
  }

  if (status !== "authorized") {
    const nextPath = `${location.pathname}${location.search || ""}${location.hash || ""}`;
    return <Navigate to={`/login?next=${encodeURIComponent(nextPath)}`} replace />;
  }

  return <Outlet />;
}

export default RequireAdmin;
