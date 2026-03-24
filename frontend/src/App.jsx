import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import RequireAdmin from "./components/RequireAdmin";
import EncuestaPage from "./pages/EncuestaPage";
import MarcasVehiculoPage from "./pages/MarcasVehiculoPage";
import ProductosPage from "./pages/ProductosPage";
import CompatibilidadesPage from "./pages/CompatibilidadesPage";
import ModelosVehiculoPage from "./pages/ModelosVehiculoPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/encuesta" replace />} />
        <Route path="encuesta" element={<EncuestaPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route element={<RequireAdmin />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="marcas-vehiculo" element={<MarcasVehiculoPage />} />
          <Route path="modelos-vehiculo" element={<ModelosVehiculoPage />} />
          <Route path="productos" element={<ProductosPage />} />
          <Route path="compatibilidades" element={<CompatibilidadesPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
