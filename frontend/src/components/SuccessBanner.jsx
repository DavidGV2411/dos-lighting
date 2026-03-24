function SuccessBanner({ title = "Operacion completada", message }) {
  if (!message) {
    return null;
  }

  return (
    <div className="success-banner" role="status" aria-live="polite">
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}

export default SuccessBanner;
