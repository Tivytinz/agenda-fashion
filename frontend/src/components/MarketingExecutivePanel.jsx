export function MarketingExecutivePanel({
  title,
  status,
  tone = "neutral",
  summary,
  metrics = [],
  action
}) {
  return (
    <section
      aria-label={title}
      className={`panel marketing-executive-panel is-${tone}`}
    >
      <div className="marketing-executive-heading">
        <div>
          <p className="eyebrow">Leitura executiva</p>
          <h2>{title}</h2>
          <p className="muted">{summary}</p>
        </div>
        <span className={`marketing-health-badge is-${tone}`}>
          {status}
        </span>
      </div>

      <div className="marketing-executive-metrics">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            {metric.hint && <small>{metric.hint}</small>}
          </div>
        ))}
      </div>

      {action && (
        <p className="marketing-executive-action">
          <strong>Próxima ação:</strong> {action}
        </p>
      )}
    </section>
  );
}
