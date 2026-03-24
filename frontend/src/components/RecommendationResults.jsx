import EmptyState from "./EmptyState";
import {
  getPositionLabel,
  getTopRecommendationsByPosition
} from "../utils/recommendationPresentation";

function RecommendationResults({
  recommendation,
  title = "Resultado",
  compact = false
}) {
  if (!recommendation) {
    return null;
  }

  const topRecommendationsByPosition = getTopRecommendationsByPosition(
    recommendation.resultados || []
  );

  return (
    <section className={`recommendation-panel${compact ? " compact" : ""}`}>
      <header className="panel-header result-header">
        <div>
          <h3>{title}</h3>
          <p>{recommendation.mensaje || "Recomendacion generada correctamente."}</p>
        </div>
        <span className={`confidence-badge ${recommendation.nivelConfianza || "baja"}`}>
          Confianza: {recommendation.nivelConfianza || "baja"}
        </span>
      </header>

      {topRecommendationsByPosition.length ? (
        <div className="result-groups">
          {topRecommendationsByPosition.map((group) => (
            <section key={group.posicionLuz} className="result-position">
              <h3>Top 3 - {getPositionLabel(group.posicionLuz)}</h3>
              <div className="product-list">
                {group.productos.map((product, index) => (
                  <article
                    className="recommendation-card"
                    key={`${group.posicionLuz}-${product.productoId}`}
                  >
                    <p className="recommendation-kicker">Top {index + 1} recomendado</p>
                    <h4>{product.modelo}</h4>
                    <p>
                      <strong>Conector/Casquillo:</strong> {product.casquilloCodigo || "N/D"}
                    </p>
                    <p>
                      <strong>Gama:</strong> {product.gama || "N/D"}
                    </p>
                    <p>
                      <strong>Puntaje:</strong> {product.puntajeTotal ?? "No aplica"}
                    </p>

                    <div>
                      <h5>Motivo</h5>
                      <ul>
                        {product.motivos?.length ? (
                          product.motivos.map((motivo, motivoIndex) => (
                            <li key={`${product.productoId}-motivo-${motivoIndex}`}>{motivo}</li>
                          ))
                        ) : (
                          <li>Sin motivo especifico, puntaje base.</li>
                        )}
                      </ul>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Sin productos recomendados"
          description="No se encontro compatibilidad o inventario para esta consulta."
        />
      )}
    </section>
  );
}

export default RecommendationResults;
