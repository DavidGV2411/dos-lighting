function LoadingBlock({ text = "Cargando..." }) {
  return (
    <div className="loading-block" aria-live="polite">
      <div className="loader" />
      <span>{text}</span>
    </div>
  );
}

export default LoadingBlock;
