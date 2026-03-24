function EmptyState({ title, description }) {
  return (
    <section className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
    </section>
  );
}

export default EmptyState;
