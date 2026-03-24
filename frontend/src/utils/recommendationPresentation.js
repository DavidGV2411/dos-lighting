const POSITION_LABELS = {
  cruce: "Luz de cruce",
  largo: "Luz larga",
  cruce_y_largo: "Cruce y larga",
  antiniebla: "Antiniebla"
};

export function getPositionLabel(code) {
  return POSITION_LABELS[code] || code;
}

export function sortRecommendations(a, b) {
  const scoreA = a.puntajeTotal ?? Number.NEGATIVE_INFINITY;
  const scoreB = b.puntajeTotal ?? Number.NEGATIVE_INFINITY;
  if (scoreA !== scoreB) {
    return scoreB - scoreA;
  }

  const rankA = a.rank ?? Number.MAX_SAFE_INTEGER;
  const rankB = b.rank ?? Number.MAX_SAFE_INTEGER;
  if (rankA !== rankB) {
    return rankA - rankB;
  }

  return (a.productoId ?? 0) - (b.productoId ?? 0);
}

export function getTopRecommendationsByPosition(resultados = [], limit = 3) {
  return resultados
    .map((group) => ({
      posicionLuz: group.posicionLuz,
      productos: [...(group.productos || [])].sort(sortRecommendations).slice(0, limit)
    }))
    .filter((group) => group.productos.length > 0);
}
