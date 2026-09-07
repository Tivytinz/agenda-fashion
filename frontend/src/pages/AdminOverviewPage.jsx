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

function timestamp(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : Number.POSITIVE_INFINITY;
}

function prioritizeProfiles(profiles) {
  return [...profiles]
    .sort((a, b) => {
      const progressA = toFiniteNumber(a?.progresso?.etapasConcluidas);
      const progressB = toFiniteNumber(b?.progresso?.etapasConcluidas);

      if (progressA !== progressB) return progressB - progressA;
      return timestamp(a?.ultimaAtividadeEm) - timestamp(b?.ultimaAtividadeEm);
    })
    .slice(0, 5);
}

function inactivityLabel(value) {
  if (!value) return "Sem atividade registrada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem atividade registrada";

  const elapsed = Math.max(0, Date.now() - date.getTime());
  const days = Math.floor(elapsed / (24 * 60 * 60 * 1000));

  if (days === 0) return "Atividade hoje";
  if (days === 1) return "Sem atividade há 1 dia";
  return `Sem atividade há ${days} dias`;
}

function recurrenceValue(recurrence, key) {
  if (!recurrence) return "—";
  return toFiniteNumber(recurrence?.resumo?.[key]);
}

function recurrenceTime(recurrence) {
  if (!recurrence) return "—";
  const value = recurrence?.tempos?.primeiroParaSegundo?.medianaDias;
  return Number.isFinite(Number(value)) ? `${Number(value)} dias` : "Amostra insuficiente";
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
        "/admin/saude/perfis-incompletos?pendencia=todos&pagina=1&limite=25",
        { signal: controller.signal }
      ),
      funnel: apiRequest(`/admin/marketing/funil-profissionais?periodo=${period}`, {
        signal: controller.signal
      }),
      recurrence: apiRequest(`/admin/marketing/recorrencia-profissionais?periodo=${period}`, {
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
          recurrence: values.recurrence || current?.recurrence || null,
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
  const profiles = useMemo(
    () => prioritizeProfiles(activation?.perfis || []),
    [activation?.perfis]
  );
  const funnelSummary =
    data?.funnel?.resumo ||
    data?.funnel?.resumoOficial ||
    {};
  const recurrence = data?.recurrence || null;
  const system = readinessState(data?.readiness);

  const activationStages = useMemo(() => [
    { label: "Cadastros", value: toFiniteNumber(funnelSummary.cadastros) },
    { label: "Negócios", value: toFiniteNumber(funnelSummary.negociosCriados), action: "sem_negocio" },
    { label: "Serviços", value: toFiniteNumber(funnelSummary.servicosCriados), action: "servico" },
    { label: "Agendas", value: toFiniteNumber(funnelSummary.agendasConfiguradas), action: "agenda" },
    { label: "Publicados", value: toFiniteNumber(funnelSummary.negociosPublicados), action: "publicacao" },
    { label: "1º agendamento válido", value: toFiniteNumber(funnelSummary.primeirosAgendamentos) }
  ], [funnelSummary]);

  const bottleneck = useMemo(
    () => bottleneckFrom(activationStages, period),
    [activationStages, period]
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
  const activationValue = (key) => activationAvailable ? toFiniteNumber(summary[key]) : "—";
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
            hint={activationHint(`de ${toFiniteNumber(summary.totalProfissionais)} profissionais`)}
            label="Ativações pendentes"
            tone={activationAvailable
              ? toFiniteNumber(summary.totalIncompletos) > 0 ? "warning" : "success"
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
              Os cards mostram pendências independentes: o mesmo profissional pode aparecer em mais de um bloqueio. A lista abaixo prioriza quem está mais perto de ativar e está há mais tempo sem atividade.
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
                  <small>{inactivityLabel(profile.ultimaAtividadeEm)}</small>
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
          <StatusCard hint="profissionais vinculados no período" label="Profissionais no período" value={toFiniteNumber(indicators.totalProfissionais)} />
          <StatusCard hint="criados no período" label="Negócios criados" value={toFiniteNumber(indicators.totalNegocios)} />
          <StatusCard hint="pessoas distintas observadas em agendamentos" label="Clientes que agendaram" value={toFiniteNumber(indicators.totalClientes)} />
          <StatusCard hint="criados no período selecionado" label="Agendamentos" value={toFiniteNumber(indicators.totalAgendamentos)} />
        </div>
      </section>

      <section className="panel admin-command-funnel-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Ativação</p>
            <h2>Da aquisição ao primeiro valor</h2>
            <p className="muted">
              Este funil é cumulativo: cada etapa só conta profissionais que também cumpriram os marcos anteriores. O primeiro agendamento ignora reservas canceladas.
            </p>
          </div>
          <Link className="button button-secondary button-small" to={funnelPath}>
            Ver funil completo
          </Link>
        </div>

        <div className="admin-command-funnel">
          {activationStages.map(({ label, value }, index) => (
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

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Monetização</p>
            <h2>Intenção de compra e receita</h2>
            <p className="muted">
              Checkout é intenção; assinatura paga é monetização. Esses números preservam os eventos financeiros reais e não são forçados a caber no funil cumulativo de ativação.
            </p>
          </div>
          <Link className="button button-secondary button-small" to={funnelPath}>
            Ver monetização completa
          </Link>
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
          <Link
            className="button button-secondary button-small"
            to={funnelPath}
          >
            Ver análise completa
          </Link>
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
              <p className="eyebrow">Cliente final</p>
              <h2>Sinais de descoberta</h2>
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
            </div>
            <Link className="text-button" to="/admin/operacao">Ver operação →</Link>
          </div>
          <dl className="admin-command-data-list">
            <div><dt>Visitas a perfis</dt><dd>{toFiniteNumber(metrics.visitasPlataforma)}</dd></div>
            <div><dt>Cliques no WhatsApp</dt><dd>{toFiniteNumber(metrics.cliquesWhatsapp)}</dd></div>
            <div><dt>Cliques em mapas</dt><dd>{toFiniteNumber(metrics.cliquesMaps)}</dd></div>
            <div><dt>Favoritos</dt><dd>{toFiniteNumber(metrics.favoritosTotais)}</dd></div>
            <div><dt>Cidade em destaque</dt><dd>{highlights.cidadeTop || "—"}</dd></div>
          </dl>
        </section>
      </div>
    </main>
  );
}
