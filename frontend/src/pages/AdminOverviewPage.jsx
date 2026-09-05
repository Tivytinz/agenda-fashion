import {
  useEffect,
  useMemo,
  useState
} from "react";
import {
  Link,
  useSearchParams
} from "react-router-dom";
import { apiRequest } from "../api/client";
import {
  ErrorState,
  LoadingState
} from "../components/ScreenState";
import {
  ADMIN_PERIODS,
  adminPathWithPeriod,
  adminPeriodLabel,
  normalizeAdminPeriod,
  setPeriodSearchParam
} from "../utils/adminPeriods";
import { settleRequestMap } from "../utils/asyncData";

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function StatusCard({ hint, label, tone = "neutral", value }) {
  return (
    <article className={`admin-command-metric is-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function AttentionCard({ hint, label, to, value }) {
  return (
    <Link className="admin-attention-card" to={to}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
      <b>Ver profissionais →</b>
    </Link>
  );
}

function readinessState(readiness) {
  if (readiness?.status === "ready" && readiness?.database === "ok") {
    return {
      label: "Operacional",
      hint: "Aplicação + banco prontos",
      tone: "success"
    };
  }

  if (readiness) {
    return {
      label: "Atenção",
      hint: "Readiness da aplicação requer verificação",
      tone: "warning"
    };
  }

  return {
    label: "Não verificado",
    hint: "Readiness indisponível nesta leitura",
    tone: "neutral"
  };
}

function activationLink(filter) {
  return `/admin/saude?pendencia=${encodeURIComponent(filter)}`;
}

function profileActivationLink(profile) {
  const name = String(profile?.nome || "").trim();
  return name
    ? `/admin/saude?busca=${encodeURIComponent(name)}`
    : "/admin/saude";
}

function bottleneckFrom(stages, period) {
  const transitions = stages.slice(1).map((stage, index) => {
    const previous = stages[index];
    const loss = Math.max(0, previous.value - stage.value);
    const rate = previous.value > 0
      ? Math.round((stage.value / previous.value) * 1000) / 10
      : 0;

    return {
      from: previous.label,
      to: stage.label,
      loss,
      rate,
      action: stage.action
    };
  });

  const largest = transitions.reduce((best, item) =>
    item.loss > (best?.loss ?? -1) ? item : best, null);

  if (!largest || largest.loss <= 0) return null;

  return {
    ...largest,
    href: largest.action
      ? activationLink(largest.action)
      : adminPathWithPeriod("/admin/trafego-pago/profissionais", period)
  };
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
      activation: apiRequest(
        "/admin/saude/perfis-incompletos?pendencia=todos&pagina=1&limite=5",
        { signal: controller.signal }
      ),
      funnel: apiRequest(`/admin/marketing/funil-profissionais?periodo=${period}`, {
        signal: controller.signal
      }),
      readiness: apiRequest("/health/ready", {
        signal: controller.signal,
        timeoutMs: 8000
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
              "Não foi possível atualizar os indicadores do período selecionado."
          );
          return;
        }

        setData((current) => ({
          period,
          dashboard: values.dashboard,
          activation: values.activation || current?.activation || null,
          funnel: values.funnel,
          readiness: values.readiness || current?.readiness || null
        }));

        if (nonAbortErrors.length > 0) {
          setError(
            "Parte dos indicadores atuais está temporariamente indisponível. Os últimos dados válidos continuam visíveis."
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
  const activationAvailable = Boolean(data?.activation);
  const activation = data?.activation || null;
  const summary = activation?.resumo || {};
  const profiles = activation?.perfis || [];
  const funnelSummary =
    data?.funnel?.resumo ||
    data?.funnel?.resumoOficial ||
    {};
  const system = readinessState(data?.readiness);

  const funnelStages = useMemo(() => [
    { label: "Cadastros", value: number(funnelSummary.cadastros) },
    { label: "Negócios", value: number(funnelSummary.negociosCriados), action: "sem_negocio" },
    { label: "Serviços", value: number(funnelSummary.servicosCriados), action: "servico" },
    { label: "Agendas", value: number(funnelSummary.agendasConfiguradas), action: "agenda" },
    { label: "Publicados", value: number(funnelSummary.negociosPublicados), action: "publicacao" },
    { label: "1º agendamento", value: number(funnelSummary.primeirosAgendamentos) },
    { label: "Assinaturas", value: number(funnelSummary.assinaturasAtivadas) }
  ], [funnelSummary]);

  const bottleneck = useMemo(
    () => bottleneckFrom(funnelStages, period),
    [funnelStages, period]
  );

  if (!data && !error) {
    return (
      <main className="workspace-page admin-workspace-page admin-command-page">
        <LoadingState>Carregando centro de comando...</LoadingState>
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
  const highlights = dashboard.destaques || dashboard;
  const loadedPeriod = data?.period || period;
  const loadedPeriodLabel = adminPeriodLabel(loadedPeriod);
  const funnelPath = adminPathWithPeriod("/admin/trafego-pago/profissionais", period);
  const activationValue = (key) => activationAvailable ? number(summary[key]) : "—";
  const activationHint = (availableHint) => activationAvailable
    ? availableHint
    : "Dados de ativação indisponíveis nesta leitura";

  return (
    <main
      aria-busy={refreshing}
      className="workspace-page admin-workspace-page admin-command-page"
    >
      <header className="workspace-heading admin-command-heading">
        <div>
          <p className="eyebrow">Administração</p>
          <h1>Centro de comando</h1>
          <p>
            Veja o estado atual da operação, onde profissionais estão travando e como o funil avançou no período escolhido.
          </p>
        </div>

        <div className="segmented-control" aria-label="Período do centro de comando">
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
        <p className="data-refresh-status" role="status">Atualizando centro de comando sem ocultar os últimos dados...</p>
      )}
      {error && data && <p className="form-error" role="alert">{error}</p>}

      <section aria-labelledby="admin-now-heading">
        <div className="admin-section-heading">
          <p className="eyebrow">Agora</p>
          <h2 id="admin-now-heading">Situação atual</h2>
          <p className="muted">Readiness e fila de ativação representam o estado atual, independentemente do período selecionado.</p>
        </div>
        <div className="admin-command-now-grid">
          <StatusCard
            hint={system.hint}
            label="Sistema"
            tone={system.tone}
            value={system.label}
          />
          <StatusCard
            hint={activationHint(`de ${number(summary.totalProfissionais)} profissionais`)}
            label="Ativações pendentes"
            tone={activationAvailable
              ? number(summary.totalIncompletos) > 0 ? "warning" : "success"
              : "neutral"}
            value={activationValue("totalIncompletos")}
          />
        </div>
      </section>

      <section className="panel admin-command-attention-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Prioridade operacional</p>
            <h2>Profissionais que precisam de atenção</h2>
            <p className="muted">
              Abra diretamente o filtro correspondente ao bloqueio observado agora.
            </p>
          </div>
          <Link className="button button-secondary button-small" to="/admin/saude">
            Abrir ativação
          </Link>
        </div>

        <div className="admin-attention-grid">
          <AttentionCard
            hint={activationHint("horários ainda não configurados")}
            label="Sem agenda"
            to={activationLink("agenda")}
            value={activationValue("semAgenda")}
          />
          <AttentionCard
            hint={activationHint("negócios sem serviço ativo")}
            label="Sem serviço"
            to={activationLink("servico")}
            value={activationValue("semServico")}
          />
          <AttentionCard
            hint={activationHint("fora do catálogo público")}
            label="Não publicados"
            to={activationLink("publicacao")}
            value={activationValue("naoPublicados")}
          />
          <AttentionCard
            hint={activationHint("ainda sem área profissional")}
            label="Sem negócio"
            to={activationLink("sem_negocio")}
            value={activationValue("semNegocio")}
          />
        </div>

        {activationAvailable && profiles.length > 0 && (
          <div className="admin-priority-list" aria-label="Profissionais prioritários">
            <h3>Próximos profissionais a ajudar</h3>
            {profiles.map((profile) => (
              <article key={profile.usuarioId || profile.email || profile.nome}>
                <div>
                  <strong>{profile.nome || "Profissional"}</strong>
                  <small>{profile.negocio?.nome || "Negócio ainda não criado"}</small>
                </div>
                <div>
                  <span>Próxima ação</span>
                  <strong>{profile.proximaAcao?.rotulo || "Revisar ativação"}</strong>
                </div>
                <Link to={profileActivationLink(profile)}>Abrir ativação →</Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="admin-period-heading">
        <div className="admin-section-heading">
          <p className="eyebrow">Período</p>
          <h2 id="admin-period-heading">Desempenho — {loadedPeriodLabel}</h2>
          <p className="muted">Estes indicadores usam o período informado e não representam automaticamente a base total atual do AF.</p>
        </div>
        <div className="admin-command-summary-grid is-period-summary" aria-label={`Indicadores de ${loadedPeriodLabel}`}>
          <StatusCard hint="profissionais vinculados no período" label="Profissionais no período" value={number(indicators.totalProfissionais)} />
          <StatusCard hint="criados no período" label="Negócios criados" value={number(indicators.totalNegocios)} />
          <StatusCard hint="pessoas distintas observadas em agendamentos" label="Clientes que agendaram" value={number(indicators.totalClientes)} />
          <StatusCard hint="criados no período selecionado" label="Agendamentos" value={number(indicators.totalAgendamentos)} />
        </div>
      </section>

      <section className="panel admin-command-funnel-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Jornada de valor</p>
            <h2>Da aquisição ao resultado</h2>
            <p className="muted">
              Cadastro não é resultado final: o AF acompanha negócio, serviço, agenda, publicação, primeiro agendamento e assinatura.
            </p>
          </div>
          <Link className="button button-secondary button-small" to={funnelPath}>
            Ver funil completo
          </Link>
        </div>

        <div className="admin-command-funnel">
          {funnelStages.map(({ label, value }, index) => (
            <article key={label}>
              <span>{index + 1}</span>
              <small>{label}</small>
              <strong>{value}</strong>
            </article>
          ))}
        </div>

        {bottleneck && (
          <aside className="admin-bottleneck" aria-label="Maior perda observada no funil">
            <div>
              <p className="eyebrow">Prioridade do funil</p>
              <strong>Maior perda observada: {bottleneck.from} → {bottleneck.to}</strong>
              <span>{bottleneck.loss} não avançaram nessa transição · conversão observada de {bottleneck.rate}%.</span>
            </div>
            <Link className="button button-secondary button-small" to={bottleneck.href}>
              Investigar etapa
            </Link>
          </aside>
        )}
      </section>

      <div className="admin-command-two-column">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Cliente final</p>
              <h2>Comportamento de descoberta</h2>
            </div>
          </div>
          <dl className="admin-command-data-list">
            <div><dt>Descobriram</dt><dd>{number(behavior.descobriram)}</dd></div>
            <div><dt>Avaliaram</dt><dd>{number(behavior.avaliaram)}</dd></div>
            <div><dt>Iniciaram agendamento</dt><dd>{number(behavior.iniciaram)}</dd></div>
            <div><dt>Concluíram agendamento</dt><dd>{number(behavior.concluiram)}</dd></div>
          </dl>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Marketplace</p>
              <h2>Sinais da plataforma</h2>
            </div>
            <Link className="text-button" to="/admin/operacao">Ver operação →</Link>
          </div>
          <dl className="admin-command-data-list">
            <div><dt>Visitas a perfis</dt><dd>{number(metrics.visitasPlataforma)}</dd></div>
            <div><dt>Cliques no WhatsApp</dt><dd>{number(metrics.cliquesWhatsapp)}</dd></div>
            <div><dt>Cliques em mapas</dt><dd>{number(metrics.cliquesMaps)}</dd></div>
            <div><dt>Favoritos</dt><dd>{number(metrics.favoritosTotais)}</dd></div>
            <div><dt>Cidade em destaque</dt><dd>{highlights.cidadeTop || "—"}</dd></div>
          </dl>
        </section>
      </div>
    </main>
  );
}
