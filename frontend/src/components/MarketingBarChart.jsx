function numericValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
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

  return (
    <figure className="marketing-bar-chart">
      <figcaption>
        <strong>{title}</strong>
        {description && <small>{description}</small>}
      </figcaption>

      {normalized.length === 0 || maxValue <= 0 ? (
        <p className="marketing-chart-empty muted">{emptyMessage}</p>
      ) : (
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
      )}
    </figure>
  );
}
