import {
  useEffect,
  useMemo,
  useState
} from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import {
  ErrorState,
  LoadingState
} from "../components/ScreenState";
import {
  ADMIN_PERIODS,
  adminPeriodLabel,
  normalizeAdminPeriod,
  setPeriodSearchParam
} from "../utils/adminPeriods";
import { settleRequestMap } from "../utils/asyncData";
import { toFiniteNumber } from "../utils/format";
import "../styles/admin-refinements.css";

function StatusCard({ hint, label, tone = "neutral", value }) {
  return (
    <article className={`admin-command-metric is-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function recurrenceValue(recurrence, key) {
  if (!recurrence) return "—";
  return toFiniteNumber(recurrence?.resumo?.[key]);
}

function recurrenceTime(recurrence) {
  if (!recurrence) return "—";
  const stats = recurrence?.tempos?.primeiroParaSegundo || {};
  const sample = Number(stats.amostra);
  const value = stats.medianaDias;

  if (
    !Number.isFinite(sample) ||
    sample <= 0 ||
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Amostra insuficiente";
  }

  const days = Number(value);
  if (!Number.isFinite(days)) return "Amostra insuficiente";
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

export function AdminOverviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const period = normalizeAdminPeriod(searchParams.get("periodo"));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setRefreshing(true);
    setError("");

    settleRequestMap({
      dashboard: apiRequest(`/admin/dashboard?periodo=${period}`, {
        signal: controller.signal
      }),
      funnel: apiRequest(`/admin/marketing/funil-profissionais?periodo=${period}`, {
        signal: controller.signal
      }),
      recurrence: apiRequest(`/admin/marketing/recorrencia-profissionais?periodo=${period}`, {
        signal: controller.signal
      })
    })
      .then(({ values, errors }) => {
        if (!active) return;

        const nonAbortErrors = errors.filter(
          ({ error: requestError }) => requestError?.name !== "AbortError"
        );
        const periodError = nonAbortErrors.find(({ key }) =>
          key === "dashboard" || key === "funnel"
        );

        if (!values.dashboard || !values.funnel) {
          setError(
            periodError?.error?.message ||
              "Não foi possível atualizar as métricas do período selecionado."
          );
          return;
        }

        setData((current) => ({
          period,
          dashboard: values.dashboard,
          funnel: values.funnel,
          recurrence:
            values.recurrence ||
            (current?.period === period ? current.recurrence : null)
        }));

        if (nonAbortErrors.length > 0) {
          setError(
            "Parte das métricas está temporariamente indisponível. Os últimos dados válidos do mesmo período continuam visíveis quando disponíveis."
          );
        }
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [period, reloadKey]);

  const dashboard = data?.dashboard || {};
  const funnelSummary =
    data?.funnel?.resumo ||
    data?.funnel?.resumoOficial ||
    {};
  const recurrence = data?.recurrence || null;

  const activationMilestones = useMemo(() => [
    { label: "Cadastros", value: toFiniteNumber(funnelSummary.cadastros) },
    { label: "Negócios", value: toFiniteNumber(funnelSummary.negociosCriados) },
    { label: "Serviços", value: toFiniteNumber(funnelSummary.servicosCriados) },
    { label: "Agendas", value: toFiniteNumber(funnelSummary.agendasConfiguradas) },
    { label: "Publicados", value: toFiniteNumber(funnelSummary.negociosPublicados) },
    { label: "1º agendamento válido", value: toFiniteNumber(funnelSummary.primeirosAgendamentos) }
  ], [funnelSummary]);

  if (!data && !error) {
    return (
      <main className="workspace-page admin-workspace-page admin-command-page">
        <LoadingState>Carregando métricas do Agenda Fashion...</LoadingState>
      </main>
    );
  }

  if (!data && error) {
    return (
      <main className="workspace-page admin-workspace-page admin-command-page">
        <ErrorState
          message={error}
          onRetry={() => setReloadKey((current) => current + 1)}
        />
      </main>
    );
  }

  const indicators = dashboard.indicadores || dashboard;
  const behavior = dashboard.comportamento || {};
  const metrics = dashboard.metricas || dashboard;
  const loadedPeriod = data?.period || period;
  const loadedPeriodLabel = adminPeriodLabel(loadedPeriod);

  return (
    <main
      aria-busy={refreshing}
      className="workspace-page admin-workspace-page admin-command-page"
    >
      <header className="workspace-heading admin-command-heading">
        <div>
          <p className="eyebrow">Administração</p>
          <h1>Visão geral</h1>
          <p>
            Métricas consolidadas do Agenda Fashion para acompanhar aquisição, ativação, uso, retenção, monetização e demanda sem misturar operação individual nesta tela.
          </p>
        </div>

        <div className="segmented-control" aria-label="Período da visão geral">
          {ADMIN_PERIODS.map(([value, label]) => (
            <button
              aria-pressed={period === value}
              className={period === value ? "active" : ""}
              disabled={refreshing}
              key={value}
              onClick={() => {
                if (value === period) return;
                setSearchParams(setPeriodSearchParam(searchParams, value));
              }}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {refreshing && data && (
        <p className="data-refresh-status" role="status">
          Atualizando métricas sem ocultar os últimos dados do período carregado...
        </p>
      )}
      {error && data && <p className="form-error" role="alert">{error}</p>}

      <section aria-labelledby="admin-period-heading">
        <div className="admin-section-heading">
          <p className="eyebrow">Resumo</p>
          <h2 id="admin-period-heading">Métricas — {loadedPeriodLabel}</h2>
          <p className="muted">
            Todos os números desta visão são indicadores agregados do AF no recorte informado; detalhes operacionais ficam nas áreas específicas do Admin.
          </p>
        </div>
        <div className="admin-command-summary-grid is-period-summary" aria-label={`Indicadores de ${loadedPeriodLabel}`}>
          <StatusCard
            hint="profissionais vinculados no período"
            label="Profissionais no período"
            value={toFiniteNumber(indicators.totalProfissionais)}
          />
          <StatusCard
            hint="negócios criados no período"
            label="Negócios criados"
            value={toFiniteNumber(indicators.totalNegocios)}
          />
          <StatusCard
            hint="reservas registradas no período"
            label="Agendamentos"
            value={toFiniteNumber(indicators.totalAgendamentos)}
          />
          <StatusCard
            hint="pessoas distintas observadas em agendamentos"
            label="Clientes que agendaram"
            value={toFiniteNumber(indicators.totalClientes)}
          />
        </div>
      </section>

      <section className="panel admin-command-funnel-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Ativação</p>
            <h2>Marcos de ativação da coorte</h2>
            <p className="muted">
              Os números mostram quais marcos cada profissional da coorte atingiu. Eles não são conversões adjacentes e podem subir entre etapas por compatibilidade com negócios legados. O primeiro agendamento ignora reservas canceladas.
            </p>
          </div>
        </div>

        <div className="admin-command-funnel">
          {activationMilestones.map(({ label, value }, index) => (
            <article key={label}>
              <span>{index + 1}</span>
              <small>{label}</small>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Monetização</p>
            <h2>Intenção de compra e receita</h2>
            <p className="muted">
              Checkout é intenção; assinatura paga é monetização. Os dois indicadores permanecem separados para não tratar tentativa de compra como receita.
            </p>
          </div>
        </div>
        <div className="admin-command-now-grid">
          <StatusCard
            hint="tentativas de checkout observadas na coorte"
            label="Checkouts iniciados"
            value={toFiniteNumber(funnelSummary.checkoutsIniciados)}
          />
          <StatusCard
            hint="assinaturas com primeiro pagamento válido"
            label="Assinaturas pagas"
            tone={toFiniteNumber(funnelSummary.assinaturasAtivadas) > 0 ? "success" : "neutral"}
            value={toFiniteNumber(funnelSummary.assinaturasAtivadas)}
          />
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Retenção</p>
            <h2>Repetição de uso após o primeiro agendamento</h2>
            <p className="muted">
              Mede profissionais cujo primeiro negócio recebeu novos agendamentos não cancelados. Não representa cliente recorrente nem atendimento realizado.
            </p>
          </div>
        </div>
        <dl className="admin-command-data-list">
          <div><dt>Com 1º agendamento</dt><dd>{recurrenceValue(recurrence, "comPrimeiroAgendamento")}</dd></div>
          <div><dt>Com 2º agendamento</dt><dd>{recurrenceValue(recurrence, "comSegundoAgendamento")}</dd></div>
          <div><dt>2º sobre 1º</dt><dd>{recurrence ? `${toFiniteNumber(recurrence?.resumo?.taxaSegundoSobrePrimeiro)}%` : "—"}</dd></div>
          <div><dt>Mediana até o 2º</dt><dd>{recurrenceTime(recurrence)}</dd></div>
        </dl>
      </section>

      <div className="admin-command-two-column">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Demanda</p>
              <h2>Sinais de descoberta e agendamento</h2>
              <p className="muted">
                São contagens de sessões com cada evento no período, não uma conversão sequencial entre etapas.
              </p>
            </div>
          </div>
          <dl className="admin-command-data-list">
            <div><dt>Descobriram</dt><dd>{toFiniteNumber(behavior.descobriram)}</dd></div>
            <div><dt>Avaliaram</dt><dd>{toFiniteNumber(behavior.avaliaram)}</dd></div>
            <div><dt>Iniciaram agendamento</dt><dd>{toFiniteNumber(behavior.iniciaram)}</dd></div>
            <div><dt>Reservas criadas</dt><dd>{toFiniteNumber(behavior.concluiram)}</dd></div>
          </dl>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Marketplace</p>
              <h2>Sinais da plataforma</h2>
              <p className="muted">
                Interações agregadas com perfis e recursos públicos do AF no período carregado.
              </p>
            </div>
          </div>
          <dl className="admin-command-data-list">
            <div><dt>Visitas a perfis</dt><dd>{toFiniteNumber(metrics.visitasPlataforma)}</dd></div>
            <div><dt>Cliques no WhatsApp</dt><dd>{toFiniteNumber(metrics.cliquesWhatsapp)}</dd></div>
            <div><dt>Cliques em mapas</dt><dd>{toFiniteNumber(metrics.cliquesMaps)}</dd></div>
            <div><dt>Favoritos</dt><dd>{toFiniteNumber(metrics.favoritosTotais)}</dd></div>
          </dl>
        </section>
      </div>
    </main>
  );
}
