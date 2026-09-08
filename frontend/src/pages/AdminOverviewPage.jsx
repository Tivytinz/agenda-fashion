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

function percentage(part, total) {
  const denominator = toFiniteNumber(total);
  if (denominator <= 0) return "—";

  const rate = (
    toFiniteNumber(part) /
    denominator
  ) * 100;

  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1
  }).format(rate)}%`;
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
    { label: "Cadastros profissionais", value: toFiniteNumber(funnelSummary.cadastros) },
    { label: "Negócios criados", value: toFiniteNumber(funnelSummary.negociosCriados) },
    { label: "Serviços cadastrados", value: toFiniteNumber(funnelSummary.servicosCriados) },
    { label: "Agendas configuradas", value: toFiniteNumber(funnelSummary.agendasConfiguradas) },
    { label: "Negócios publicados", value: toFiniteNumber(funnelSummary.negociosPublicados) },
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
  const activationCount = toFiniteNumber(funnelSummary.primeirosAgendamentos);
  const signupCount = toFiniteNumber(funnelSummary.cadastros);
  const paidSubscriptions = toFiniteNumber(funnelSummary.assinaturasAtivadas);
  const activationRate = percentage(activationCount, signupCount);
  const subscriptionRate = percentage(paidSubscriptions, signupCount);

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
            Indicadores consolidados do Agenda Fashion no período selecionado.
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
        </div>
        <div className="admin-command-summary-grid is-period-summary" aria-label={`Indicadores de ${loadedPeriodLabel}`}>
          <StatusCard
            hint="cadastros profissionais observados na coorte"
            label="Cadastros profissionais"
            value={signupCount}
          />
          <StatusCard
            hint={`${activationRate} dos cadastros chegaram ao 1º agendamento válido`}
            label="Ativações"
            tone={activationCount > 0 ? "success" : "neutral"}
            value={activationCount}
          />
          <StatusCard
            hint="reservas registradas no período"
            label="Agendamentos"
            value={toFiniteNumber(indicators.totalAgendamentos)}
          />
          <StatusCard
            hint={`${subscriptionRate} dos cadastros chegaram a uma assinatura paga`}
            label="Assinaturas pagas"
            tone={paidSubscriptions > 0 ? "success" : "neutral"}
            value={paidSubscriptions}
          />
        </div>
      </section>

      <section className="panel admin-command-funnel-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Ativação</p>
            <h2>Ativação da coorte profissional</h2>
            <p className="muted">
              Marcos atingidos pelos profissionais cadastrados no recorte selecionado.
            </p>
          </div>
        </div>

        <div className="admin-command-funnel is-milestones">
          {activationMilestones.map(({ label, value }) => (
            <article key={label}>
              <small>{label}</small>
              <strong>{value}</strong>
            </article>
          ))}
        </div>

        <div className="admin-command-rate-summary">
          <div>
            <span>Taxa de ativação da coorte</span>
            <small>1º agendamento válido ÷ cadastros profissionais</small>
          </div>
          <strong>{activationRate}</strong>
        </div>

        <details className="admin-metric-definition">
          <summary>Como interpretar estes marcos</summary>
          <p>
            Os marcos não são conversões adjacentes. Negócios legados podem estar publicados sem agenda confirmada, então uma etapa pode ter contagem maior que a anterior. O primeiro agendamento válido ignora reservas canceladas.
          </p>
        </details>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Monetização</p>
            <h2>Conversão para assinatura</h2>
          </div>
        </div>
        <dl className="admin-command-data-list">
          <div>
            <dt>Checkouts iniciados</dt>
            <dd>{toFiniteNumber(funnelSummary.checkoutsIniciados)}</dd>
          </div>
          <div>
            <dt>Assinaturas pagas</dt>
            <dd>{paidSubscriptions}</dd>
          </div>
          <div>
            <dt>Taxa de assinatura na coorte</dt>
            <dd>{subscriptionRate}</dd>
          </div>
        </dl>
        <details className="admin-metric-definition">
          <summary>Como interpretar monetização</summary>
          <p>
            Checkout é intenção de compra. Apenas assinatura com primeiro pagamento válido conta como monetização.
          </p>
        </details>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Retenção</p>
            <h2>Retenção dos negócios</h2>
            <p className="muted">
              Negócios que continuam recebendo agendamentos depois do primeiro valor entregue.
            </p>
          </div>
        </div>
        <dl className="admin-command-data-list">
          <div><dt>Com 1º agendamento</dt><dd>{recurrenceValue(recurrence, "comPrimeiroAgendamento")}</dd></div>
          <div><dt>Com 2º agendamento</dt><dd>{recurrenceValue(recurrence, "comSegundoAgendamento")}</dd></div>
          <div><dt>2º sobre 1º</dt><dd>{recurrence ? `${toFiniteNumber(recurrence?.resumo?.taxaSegundoSobrePrimeiro)}%` : "—"}</dd></div>
          <div><dt>Mediana até o 2º</dt><dd>{recurrenceTime(recurrence)}</dd></div>
        </dl>
        <details className="admin-metric-definition">
          <summary>Como interpretar retenção</summary>
          <p>
            Esta leitura acompanha repetição de agendamentos não cancelados por negócio. Não representa, sozinha, cliente recorrente nem atendimento realizado.
          </p>
        </details>
      </section>

      <div className="admin-command-two-column">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Demanda</p>
              <h2>Descoberta e agendamento</h2>
            </div>
          </div>
          <dl className="admin-command-data-list">
            <div><dt>Sessões na página inicial</dt><dd>{toFiniteNumber(behavior.descobriram)}</dd></div>
            <div><dt>Sessões que viram perfis</dt><dd>{toFiniteNumber(behavior.avaliaram)}</dd></div>
            <div><dt>Sessões que iniciaram agendamento</dt><dd>{toFiniteNumber(behavior.iniciaram)}</dd></div>
            <div><dt>Sessões com reserva criada</dt><dd>{toFiniteNumber(behavior.concluiram)}</dd></div>
            <div><dt>Clientes distintos que agendaram</dt><dd>{toFiniteNumber(indicators.totalClientes)}</dd></div>
          </dl>
          <details className="admin-metric-definition">
            <summary>Como interpretar demanda</summary>
            <p>
              Cada linha conta sessões que emitiram aquele evento no período. Elas são sinais independentes e não formam automaticamente uma conversão sequencial entre etapas.
            </p>
          </details>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Marketplace</p>
              <h2>Interações na plataforma</h2>
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
