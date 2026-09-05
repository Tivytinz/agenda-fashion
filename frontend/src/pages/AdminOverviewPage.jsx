import {
  useEffect,
  useMemo,
  useState
} from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import {
  ErrorState,
  LoadingState
} from "../components/ScreenState";
import { settleRequestMap } from "../utils/asyncData";

const PERIODS = [
  ["today", "Hoje"],
  ["7", "7 dias"],
  ["30", "30 dias"],
  ["month", "Este mês"],
  ["all", "Todo período"]
];

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

function AttentionCard({ hint, label, value }) {
  return (
    <Link className="admin-attention-card" to="/admin/saude">
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

export function AdminOverviewPage() {
  const [period, setPeriod] = useState("30");
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
        const hasCoreData = Boolean(
          values.dashboard || values.activation || values.funnel
        );

        if (!hasCoreData) {
          setError(
            nonAbortErrors[0]?.error?.message ||
              "Não foi possível carregar o centro de comando."
          );
          return;
        }

        setData({
          dashboard: values.dashboard || {},
          activation: values.activation || {},
          funnel: values.funnel || {},
          readiness: values.readiness || null
        });

        if (nonAbortErrors.length > 0) {
          setError(
            "Parte dos indicadores está temporariamente indisponível. Os dados carregados continuam visíveis."
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
  const activation = data?.activation || {};
  const summary = activation?.resumo || {};
  const profiles = activation?.perfis || [];
  const funnelSummary =
    data?.funnel?.resumo ||
    data?.funnel?.resumoOficial ||
    {};
  const system = readinessState(data?.readiness);

  const funnelStages = useMemo(() => [
    ["Cadastros", number(funnelSummary.cadastros)],
    ["Negócios", number(funnelSummary.negociosCriados)],
    ["Serviços", number(funnelSummary.servicosCriados)],
    ["Agendas", number(funnelSummary.agendasConfiguradas)],
    ["Publicados", number(funnelSummary.negociosPublicados)],
    ["1º agendamento", number(funnelSummary.primeirosAgendamentos)],
    ["Assinaturas", number(funnelSummary.assinaturasAtivadas)]
  ], [funnelSummary]);

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
            Veja o que está acontecendo no Agenda Fashion agora, onde o funil está travando e qual área precisa de ação.
          </p>
        </div>

        <div className="segmented-control" aria-label="Período do centro de comando">
          {PERIODS.map(([value, label]) => (
            <button
              aria-pressed={period === value}
              className={period === value ? "active" : ""}
              disabled={refreshing}
              key={value}
              onClick={() => {
                if (value === period) return;
                setData(null);
                setError("");
                setPeriod(value);
              }}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {refreshing && data && (
        <p className="data-refresh-status" role="status">Atualizando centro de comando...</p>
      )}
      {error && data && <p className="form-error" role="alert">{error}</p>}

      <section className="admin-command-summary-grid" aria-label="Resumo da plataforma">
        <StatusCard
          hint={system.hint}
          label="Sistema"
          tone={system.tone}
          value={system.label}
        />
        <StatusCard
          hint="base profissional"
          label="Profissionais"
          value={number(indicators.totalProfissionais)}
        />
        <StatusCard
          hint="negócios no AF"
          label="Negócios"
          value={number(indicators.totalNegocios)}
        />
        <StatusCard
          hint="clientes finais"
          label="Clientes"
          value={number(indicators.totalClientes)}
        />
        <StatusCard
          hint="no período selecionado"
          label="Agendamentos"
          value={number(indicators.totalAgendamentos)}
        />
      </section>

      <section className="panel admin-command-attention-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Prioridade</p>
            <h2>Precisa da sua atenção</h2>
            <p className="muted">
              {number(summary.totalIncompletos)} de {number(summary.totalProfissionais)} profissionais ainda têm etapas de ativação pendentes.
            </p>
          </div>
          <Link className="button button-secondary button-small" to="/admin/saude">
            Abrir ativação
          </Link>
        </div>

        <div className="admin-attention-grid">
          <AttentionCard
            hint="horários ainda não configurados"
            label="Sem agenda"
            value={number(summary.semAgenda)}
          />
          <AttentionCard
            hint="negócios sem serviço ativo"
            label="Sem serviço"
            value={number(summary.semServico)}
          />
          <AttentionCard
            hint="fora do catálogo público"
            label="Não publicados"
            value={number(summary.naoPublicados)}
          />
          <AttentionCard
            hint="ainda sem área profissional"
            label="Sem negócio"
            value={number(summary.semNegocio)}
          />
        </div>

        {profiles.length > 0 && (
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
                <Link to="/admin/saude">Abrir ativação →</Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel admin-command-funnel-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Jornada de valor</p>
            <h2>Da aquisição ao resultado</h2>
            <p className="muted">
              Cadastro não é resultado final: o AF acompanha o avanço até agenda, primeiro agendamento e assinatura.
            </p>
          </div>
          <Link className="button button-secondary button-small" to="/admin/trafego-pago/profissionais">
            Ver funil completo
          </Link>
        </div>

        <div className="admin-command-funnel">
          {funnelStages.map(([label, value], index) => (
            <article key={label}>
              <span>{index + 1}</span>
              <small>{label}</small>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
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

      <section className="admin-command-shortcuts" aria-label="Áreas da administração">
        <Link to="/admin/saude"><strong>Ativação</strong><span>Profissionais e próxima ação</span></Link>
        <Link to="/admin/operacao"><strong>Operação</strong><span>Negócios, agendamentos e marketplace</span></Link>
        <Link to="/admin/trafego-pago"><strong>Marketing</strong><span>Aquisição, funil, custos e retorno</span></Link>
        <Link to="/admin/whatsapp"><strong>WhatsApp</strong><span>Templates, automações e entrega</span></Link>
      </section>
    </main>
  );
}
