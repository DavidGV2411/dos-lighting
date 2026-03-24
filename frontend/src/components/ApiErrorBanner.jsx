function ApiErrorBanner({ title = "Ocurrio un error", message, details = [] }) {
  if (!message) {
    return null;
  }

  return (
    <div className="api-error" role="alert">
      <strong>{title}</strong>
      <p>{message}</p>
      {details.length > 0 ? (
        <ul>
          {details.map((detail, index) => (
            <li key={`${detail.field || "error"}-${index}`}>
              {detail.field ? `${detail.field}: ` : ""}
              {detail.message || "Error de validacion"}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default ApiErrorBanner;
