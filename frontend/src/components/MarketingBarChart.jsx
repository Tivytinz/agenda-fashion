const DONUT_COLORS = [
  "var(--marketing-donut-1)",
  "var(--marketing-donut-2)",
  "var(--marketing-donut-3)",
  "var(--marketing-donut-4)",
  "var(--marketing-donut-5)",
  "var(--marketing-donut-6)",
  "var(--marketing-donut-7)",
  "var(--marketing-donut-8)"
];

function numericValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function percent(value, total) {
  if (!total) return 0;
  return Number(((value / total) * 100).toFixed(1));
}

function donutGradient(items, total) {
  let cursor = 0;
  const segments = items
    .filter((item) => item.numericValue > 0)
    .map((item, index) => {
      const start = cursor;
      const end = cursor + percent(item.numericValue, total);
      cursor = end;
      const color = DONUT_COLORS[index % DONUT_COLORS.length];
      return `${color} ${start}% ${end}%`;
    });

  return segments.length
    ? `conic-gradient(${segments.join(", ")})`
    : "none";
}

export function MarketingBarChart({
  title,
  description,
  items = [],
  emptyMessage = "Ainda não há dados suficientes para este gráfico."
}) {
  const normalized = items.map((item) => ({
    ...item,
    numericValue: numericValue(item.value)
  }));
  const maxValue = Math.max(0, ...normalized.map((item) => item.numericValue));
  const totalValue = normalized.reduce((sum, item) => sum + item.numericValue, 0);
  const gradient = donutGradient(normalized, totalValue);

  return (
    <figure className="marketing-bar-chart">
      <figcaption>
        <strong>{title}</strong>
        {description && <small>{description}</small>}
      </figcaption>

      {normalized.length === 0 || maxValue <= 0 ? (
        <p className="marketing-chart-empty muted">{emptyMessage}</p>
      ) : (
        <>
          <div className="marketing-donut-chart">
            <div
              aria-label={normalized
                .filter((item) => item.numericValue > 0)
                .map(
                  (item) =>
                    `${item.label}: ${percent(item.numericValue, totalValue)}%`
                )
                .join(", ")}
              className="marketing-donut-visual"
              role="img"
              style={{ background: gradient }}
            >
              <div className="marketing-donut-center">
                <strong>100%</strong>
                <span>do total</span>
              </div>
            </div>

            <ol className="marketing-donut-legend">
              {normalized
                .filter((item) => item.numericValue > 0)
                .map((item, index) => (
                  <li key={item.key || `${item.label}-${index}`}>
                    <span
                      aria-hidden="true"
                      className="marketing-donut-dot"
                      style={{
                        background: DONUT_COLORS[index % DONUT_COLORS.length]
                      }}
                    />
                    <div>
                      <strong>{item.label}</strong>
                      <small>
                        {item.formattedValue ?? item.value} · {percent(item.numericValue, totalValue)}%
                      </small>
                    </div>
                  </li>
                ))}
            </ol>
          </div>

          <ol className="marketing-bar-chart-list">
            {normalized.map((item, index) => {
              const width = Math.max(4, (item.numericValue / maxValue) * 100);
              return (
                <li key={item.key || `${item.label}-${index}`}>
                  <div className="marketing-bar-chart-meta">
                    <span title={item.label}>{item.label}</span>
                    <strong>{item.formattedValue ?? item.value}</strong>
                  </div>
                  <div className="marketing-bar-chart-track" aria-hidden="true">
                    <span style={{ width: `${width}%` }} />
                  </div>
                  {item.secondary && <small>{item.secondary}</small>}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </figure>
  );
}
