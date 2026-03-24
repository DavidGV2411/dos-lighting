export function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function includesNormalized(value, search) {
  const normalizedSearch = normalizeText(search);
  if (!normalizedSearch) {
    return true;
  }

  return normalizeText(value).includes(normalizedSearch);
}

export function hasDuplicate(items, currentId, predicate) {
  return items.some((item) => item.id !== currentId && predicate(item));
}

export function buildDeleteErrorMessage(resourceLabel, error) {
  if (error?.status === 409) {
    return `No se puede eliminar ${resourceLabel} porque esta relacionado con otros registros.`;
  }

  return error?.message || `No se pudo eliminar ${resourceLabel}.`;
}
