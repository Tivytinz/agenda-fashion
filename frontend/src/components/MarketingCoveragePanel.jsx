import { formatMetricPercent } from "../utils/marketingMetrics";

function normalizedPercentage(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return null;

  return Math.min(100, Math.max(0, number));
}

function coverageTone(value) {
  if (value === null) return "neutral";
  if (value >= 100) return "success";
  if (value >= 80) return "warning";
  return "critical";
}

export function MarketingCoveragePanel({
  title = "Confiabilidade da mensuração",
  description,
  items = []
}) {
  return (
    <section
      aria-label={title}
      className="panel marketing-coverage-panel"
    >
      <div className="marketing-coverage-heading">
        <div>
          <p className="eyebrow">Qualidade dos dados</p>
          <h2>{title}</h2>
          {description && <p className="muted">{description}</p>}
        </div>
        <span className="marketing-coverage-standard">
          Padrão operacional · 100%
        </span>
      </div>

      <div className="marketing-coverage-grid">
        {items.map((item) => {
          const value = normalizedPercentage(item.value);
          const tone = item.tone || coverageTone(value);

          return (
            <article
              className={`marketing-coverage-item is-${tone}`}
              key={item.label}
            >
              <div className="marketing-coverage-meta">
                <span>{item.label}</span>
                <strong>{formatMetricPercent(value)}</strong>
              </div>
              <div
                aria-label={`${item.label}: ${formatMetricPercent(value)}`}
                aria-valuemax="100"
                aria-valuemin="0"
                aria-valuenow={value ?? undefined}
                className="marketing-coverage-track"
                role="progressbar"
              >
                <span style={{ width: `${value ?? 0}%` }} />
              </div>
              <small>{item.detail}</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}
