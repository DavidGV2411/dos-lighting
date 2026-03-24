const DEFAULT_DASHBOARD_URL =
  "http://localhost:3000/public/dashboard/08e360c6-1cf2-4b83-98ee-796866cd8777";

function DashboardPage() {
  const dashboardUrl = import.meta.env.VITE_METABASE_DASHBOARD_URL || DEFAULT_DASHBOARD_URL;

  return (
    <section className="panel dashboard-panel">
      <header className="panel-header dashboard-panel-header">
        <div className="dashboard-heading">
          <p className="eyebrow">Analitica</p>
          <h2>Dashboard Analitico</h2>
          <p>Panel embebido de Metabase para revisar metricas, demanda y recomendaciones.</p>
        </div>

        <div className="dashboard-status-chip" aria-label="Estado del dashboard">
          <span className="dashboard-status-dot" aria-hidden="true" />
          <span>Metabase conectado</span>
        </div>
      </header>

      <div className="dashboard-shell">
        <div className="dashboard-shell-bar" aria-hidden="true">
          <span className="dashboard-shell-pill">Live Dashboard</span>
          <span className="dashboard-shell-caption">Vista integrada de Metabase dentro del panel admin</span>
        </div>

        <iframe
          title="Dashboard Metabase"
          src={dashboardUrl}
          className="dashboard-frame"
          allowFullScreen
        />
      </div>

      <p className="dashboard-footnote">
        El estilo interno del dashboard depende de Metabase; este contenedor lo integra visualmente
        con la interfaz del proyecto.
      </p>
    </section>
  );
}

export default DashboardPage;
