import EmptyState from "./EmptyState";
import {
  getPositionLabel,
  getTopRecommendationsByPosition,
  sortRecommendations
} from "../utils/recommendationPresentation";

function getRecommendationKey(product, posicionLuz, fallbackIndex = 0) {
  const safeProductId = product.productoId ?? product.modelo ?? "producto";
  const safeRank = product.rank ?? fallbackIndex;
  return `${posicionLuz}-${safeProductId}-${safeRank}`;
}

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
  const allRecommendations = topRecommendationsByPosition.flatMap((group) =>
    (group.productos || []).map((product, index) => ({
      ...product,
      posicionLuz: group.posicionLuz,
      fallbackIndex: index
    }))
  );
  const topRecommendation = allRecommendations.length
    ? [...allRecommendations].sort(sortRecommendations)[0]
    : null;
  const topRecommendationKey = topRecommendation
    ? getRecommendationKey(
        topRecommendation,
        topRecommendation.posicionLuz,
        topRecommendation.fallbackIndex
      )
    : null;

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

      {topRecommendation ? (
        <article className="recommendation-summary">
          <div className="recommendation-summary-header">
            <span className="recommendation-badge">Mejor opcion</span>
            <p>Producto destacado para esta consulta</p>
          </div>
          <h4>{topRecommendation.modelo || "Modelo sin especificar"}</h4>
          <p>
            <strong>Posicion de luz:</strong>{" "}
            {getPositionLabel(topRecommendation.posicionLuz) || "No especificada"}
          </p>
          <p>
            <strong>Gama recomendada:</strong> {topRecommendation.gama || "No especificada"}
          </p>
          <p>
            <strong>Puntaje de compatibilidad:</strong>{" "}
            {topRecommendation.puntajeTotal ?? "No disponible"}
          </p>
          <div className="recommendation-reasons">
            <h5>Motivos principales</h5>
            <ul>
              {topRecommendation.motivos?.length ? (
                topRecommendation.motivos.map((motivo, motivoIndex) => (
                  <li key={`top-reason-${motivoIndex}`}>{motivo}</li>
                ))
              ) : (
                <li>Sin motivo especifico, puntaje base.</li>
              )}
            </ul>
          </div>
        </article>
      ) : null}

      {topRecommendationsByPosition.length ? (
        <div className="result-groups">
          {topRecommendationsByPosition.map((group) => (
            <section key={group.posicionLuz} className="result-position">
              <header className="recommendation-position-header">
                <h3>{getPositionLabel(group.posicionLuz) || "Posicion sin definir"}</h3>
                <small>{group.productos.length} opcion(es) recomendada(s)</small>
              </header>
              <div className="product-list">
                {group.productos.map((product, index) => {
                  const recommendationKey = getRecommendationKey(
                    product,
                    group.posicionLuz,
                    index
                  );
                  const isTopRecommended = topRecommendationKey === recommendationKey;

                  return (
                    <article
                      className={`recommendation-card${isTopRecommended ? " is-top-recommended" : ""}`}
                      key={recommendationKey}
                    >
                      <div className="recommendation-card-head">
                        <p className="recommendation-kicker">Top {index + 1} recomendado</p>
                        {isTopRecommended ? (
                          <span className="recommendation-badge">Top recomendado</span>
                        ) : null}
                      </div>
                      <h4>{product.modelo || "Modelo sin especificar"}</h4>
                      <p>
                        <strong>Posicion de luz:</strong>{" "}
                        {getPositionLabel(group.posicionLuz) || "No especificada"}
                      </p>
                      <p>
                        <strong>Conector/Casquillo:</strong> {product.casquilloCodigo || "N/D"}
                      </p>
                      <p>
                        <strong>Gama:</strong> {product.gama || "No especificada"}
                      </p>
                      <p>
                        <strong>Puntaje de compatibilidad:</strong>{" "}
                        {product.puntajeTotal ?? "No disponible"}
                      </p>

                      <div className="recommendation-reasons">
                        <h5>Motivos de la recomendacion</h5>
                        <ul>
                          {product.motivos?.length ? (
                            product.motivos.map((motivo, motivoIndex) => (
                              <li key={`${recommendationKey}-motivo-${motivoIndex}`}>{motivo}</li>
                            ))
                          ) : (
                            <li>Sin motivo especifico, puntaje base.</li>
                          )}
                        </ul>
                      </div>
                    </article>
                  );
                })}
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
