import { ErrorState, LoadingState } from "../../components/ScreenState";
import { ADMIN_PERIODS, adminPeriodLabel, setPeriodSearchParam } from "../../utils/adminPeriods";
import "../../styles/admin-refinements.css";

export function MetricCard({ hint, label, tone = "neutral", value }) {
  return (
    <article className={`admin-command-metric is-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

export function PeriodSelector({ period, refreshing, searchParams, setSearchParams }) {
  return (
    <div className="segmented-control" aria-label="Período administrativo">
      {ADMIN_PERIODS.map(([value, label]) => (
        <button
          aria-pressed={period === value}
          className={period === value ? "active" : ""}
          disabled={refreshing}
          key={value}
          onClick={() => {
            if (period === value) return;
            setSearchParams(setPeriodSearchParam(searchParams, value));
          }}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function AdminSectionFrame({
  children,
  className = "",
  eyebrow,
  title,
  description,
  state
}) {
  const {
    data,
    error,
    period,
    refreshing,
    retry,
    searchParams,
    setSearchParams
  } = state;

  if (!data && !error) {
    return (
      <main className="admin-page admin-workspace-page admin-command-page">
        <LoadingState>Carregando {title.toLocaleLowerCase("pt-BR")}...</LoadingState>
      </main>
    );
  }

  if (!data && error) {
    return (
      <main className="admin-page admin-workspace-page admin-command-page">
        <ErrorState message={error} onRetry={retry} />
      </main>
    );
  }

  return (
    <main
      aria-busy={refreshing}
      className={`admin-page admin-workspace-page admin-command-page ${className}`.trim()}
    >
      <header className="admin-page-header admin-command-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <PeriodSelector
          period={period}
          refreshing={refreshing}
          searchParams={searchParams}
          setSearchParams={setSearchParams}
        />
      </header>

      {refreshing && data && (
        <p className="data-refresh-status" role="status">
          Mostrando os dados de {adminPeriodLabel(data.periodo)} enquanto atualizamos {adminPeriodLabel(period)}…
        </p>
      )}
      {error && data && (
        <p className="form-error" role="alert">
          {error} Os últimos dados válidos de {adminPeriodLabel(data.periodo)} continuam visíveis.
        </p>
      )}

      <section className="admin-period-context" aria-label="Recorte temporal">
        <span>Período</span>
        <strong>{adminPeriodLabel(data?.periodo || period)}</strong>
      </section>

      {children(data)}
    </main>
  );
}
