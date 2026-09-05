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
import { MarketingGa4Panel } from "../components/MarketingGa4Panel";
import { MarketingSyncPanel } from "../components/MarketingSyncPanel";
import {
  ErrorState,
  LoadingState
} from "../components/ScreenState";
import {
  ADMIN_PERIODS,
  normalizeAdminPeriod,
  setPeriodSearchParam
} from "../utils/adminPeriods";
import { settleRequestMap } from "../utils/asyncData";
import {
  formatMetricPercent,
  metricPercentage,
  paidAttributionQuality
} from "../utils/marketingMetrics";

const OBJECTIVES = {
  profissional: "Profissionais",
  cliente: "Clientes"
};

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sourceLabel(value) {
  const source = String(value || "").trim().toLowerCase();
  if (source === "google") return "Google Ads";
  if (["meta", "facebook", "instagram"].includes(source)) return "Meta Ads";
  if (source === "pinterest") return "Pinterest";
  if (source === "tiktok") return "TikTok";
  if (["organico", "orgânico"].includes(source)) return "Orgânico";
  return value || "Origem não identificada";
}

function campaignLabel(item) {
  const value = String(item?.campanha || "").trim();
  return value && !["(sem campanha)", "sem campanha"].includes(value.toLowerCase())
    ? value
    : "Campanha não identificada";
}

function campaignKey(item, index) {
  return [item?.origem, item?.midia, item?.campanha, index].join("|");
}

function professionalStages(summary) {
  const signups = number(summary?.cadastros);

  return [
    ["Cadastro", signups, signups ? 100 : 0],
    [
      "Negócio criado",
      number(summary?.negociosCriados),
      summary?.taxaNegocio ?? metricPercentage(summary?.negociosCriados, signups) ?? 0
    ],
    [
      "Serviço cadastrado",
      number(summary?.servicosCriados),
      summary?.taxaServico ?? metricPercentage(summary?.servicosCriados, signups) ?? 0
    ],
    [
      "Agenda configurada",
      number(summary?.agendasConfiguradas),
      summary?.taxaAgenda ?? metricPercentage(summary?.agendasConfiguradas, signups) ?? 0
    ],
    [
      "Negócio publicado",
      number(summary?.negociosPublicados),
      summary?.taxaPublicacao ?? metricPercentage(summary?.negociosPublicados, signups) ?? 0
    ],
    [
      "Primeiro agendamento",
      number(summary?.primeirosAgendamentos),
      summary?.taxaPrimeiroAgendamento ??
        metricPercentage(summary?.primeirosAgendamentos, signups) ??
        0
    ],
    [
      "Checkout iniciado",
      number(summary?.checkoutsIniciados),
      summary?.taxaCheckout ?? metricPercentage(summary?.checkoutsIniciados, signups) ?? 0
    ],
    [
      "Assinatura ativada",
      number(summary?.assinaturasAtivadas),
      summary?.taxaAssinatura ?? metricPercentage(summary?.assinaturasAtivadas, signups) ?? 0
    ]
  ];
}

export function AdminMarketingPage() {
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
      traffic: apiRequest(`/admin/marketing/campanhas?periodo=${period}`, {
        signal: controller.signal
      }),
      funnel: apiRequest(`/admin/marketing/funil-profissionais?periodo=${period}`, {
        signal: controller.signal
      }),
      summary: apiRequest(`/admin/marketing/resumo?periodo=${period}`, {
        signal: controller.signal
      }),
      ga4: apiRequest(`/admin/marketing/ga4?periodo=${period}`, {
        signal: controller.signal
      })
    })
      .then(({ values, errors }) => {
        if (!active) return;

        if (!values.funnel || !values.traffic) {
          const critical = errors.find(({ key }) =>
            ["funnel", "traffic"].includes(key)
          );
          setError(
            critical?.error?.message ||
              "Não foi possível atualizar a análise de marketing."
          );
          return;
        }

        const ga4Error = errors.find(({ key, error: itemError }) =>
          key === "ga4" && itemError?.name !== "AbortError"
        );
        const nonGa4Errors = errors.filter(({ key, error: itemError }) =>
          key !== "ga4" && itemError?.name !== "AbortError"
        );

        setData({
          period,
          funnel: values.funnel,
          traffic: values.traffic?.campanhas || [],
          summary: values.summary || {},
          ga4: values.ga4 || {
            habilitado: true,
            configurado: false,
            erro: ga4Error?.error?.message || ""
          }
        });

        if (nonGa4Errors.length > 0) {
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

  const professionalSummary =
    data?.funnel?.resumo ||
    data?.funnel?.resumoOficial ||
    {};

  const stages = useMemo(
    () => professionalStages(professionalSummary),
    [professionalSummary]
  );

  const traffic = data?.traffic || [];
  const officialTraffic = useMemo(
    () => traffic.filter((item) =>
      item?.oficial === true ||
      item?.classificacaoAtribuicao === "oficial"
    ),
    [traffic]
  );
  const pendingTraffic = useMemo(
    () => traffic.filter((item) =>
      ["rastreamento_incompleto", "identidade_nao_oficial"]
        .includes(item?.classificacaoAtribuicao)
    ),
    [traffic]
  );

  const officialSessions = officialTraffic.reduce(
    (total, item) => total + number(item?.sessoes),
    0
  );
  const directSessions = officialTraffic.reduce(
    (total, item) => total + number(item?.sessoesAtribuicaoDireta),
    0
  );
  const assistedSessions = officialTraffic.reduce(
    (total, item) => total + number(item?.sessoesAtribuicaoAssistida),
    0
  );
  const pendingSessions = pendingTraffic.reduce(
    (total, item) => total + number(item?.sessoes),
    0
  );

  const attribution = paidAttributionQuality({
    official: officialSessions,
    missingCampaign: pendingTraffic
      .filter((item) => item?.classificacaoAtribuicao === "rastreamento_incompleto")
      .reduce((total, item) => total + number(item?.sessoes), 0),
    unofficialIdentity: pendingTraffic
      .filter((item) => item?.classificacaoAtribuicao === "identidade_nao_oficial")
      .reduce((total, item) => total + number(item?.sessoes), 0)
  });

  if (!data && !error) {
    return (
      <main className="workspace-page admin-workspace-page admin-marketing-page marketing-command-page marketing-command-page-v3">
        <LoadingState>Carregando Marketing...</LoadingState>
      </main>
    );
  }

  if (!data && error) {
    return (
      <main className="workspace-page admin-workspace-page admin-marketing-page marketing-command-page marketing-command-page-v3">
        <ErrorState
          message={error}
          onRetry={() => setReloadKey((current) => current + 1)}
        />
      </main>
    );
  }

  const paidCoverage =
    data?.funnel?.qualidadeMensuracao?.coberturaAtribuicaoPagaPercentual ??
    attribution.coverage;
  const ga4Configured = data?.ga4?.configurado === true;
  const ga4Summary = data?.ga4?.resumo || {};
  const loadedPeriod = data?.period || period;

  const journeyCards = [
    [
      "Sessões no site",
      ga4Configured ? number(ga4Summary.sessoes) : "—",
      ga4Configured
        ? `${number(ga4Summary.usuarios)} usuários no GA4`
        : "GA4 indisponível para este período"
    ],
    [
      "Cadastros profissionais",
      number(professionalSummary.cadastros),
      "entrada do funil profissional"
    ],
    [
      "Primeiros agendamentos",
      number(professionalSummary.primeirosAgendamentos),
      `${formatMetricPercent(professionalSummary.taxaPrimeiroAgendamento)} dos cadastros`
    ],
    [
      "Assinaturas ativadas",
      number(professionalSummary.assinaturasAtivadas),
      `${formatMetricPercent(professionalSummary.taxaAssinatura)} dos cadastros`
    ]
  ];

  return (
    <main
      aria-busy={refreshing}
      className="workspace-page admin-workspace-page admin-marketing-page marketing-command-page marketing-command-page-v3"
    >
      <header className="marketing-command-hero marketing-command-hero-v3">
        <div>
          <p className="eyebrow">Marketing</p>
          <h1>Marketing e aquisição</h1>
          <p>
            Entenda de onde as pessoas chegam, como navegam e quantas avançam até ativação, primeiro agendamento e assinatura.
          </p>
        </div>

        <div className="marketing-command-actions">
          <nav className="marketing-command-nav" aria-label="Áreas do marketing">
            <span aria-current="page">Visão geral</span>
            <Link to={`/admin/trafego-pago/profissionais?periodo=${encodeURIComponent(loadedPeriod)}`}>Funil completo</Link>
            <Link to="/admin/trafego-pago/custos">Custos e retorno</Link>
          </nav>

          <div className="segmented-control" aria-label="Período do marketing">
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
        </div>
      </header>

      {refreshing && data && (
        <p className="data-refresh-status" role="status">Atualizando análise sem ocultar os últimos dados...</p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}

      <section className="marketing-trust-bar" aria-label="Confiabilidade dos dados">
        <div className="marketing-trust-copy">
          <span>Dados conectados</span>
          <strong>Comportamento + funil + atribuição</strong>
          <small>
            GA4 explica a navegação. O banco do AF continua sendo a fonte para ativação, agendamento, assinatura e receita.
          </small>
        </div>

        <div className="marketing-trust-signals">
          <span className={`marketing-trust-chip ${ga4Configured ? "is-success" : "is-warning"}`}>
            {ga4Configured ? "GA4 conectado" : "GA4 indisponível"}
          </span>
          <span className={`marketing-trust-chip ${pendingSessions > 0 ? "is-warning" : "is-success"}`}>
            {attribution.detectedPaidSessions === 0
              ? "Sem tráfego pago"
              : `${formatMetricPercent(paidCoverage)} do tráfego pago identificado`}
          </span>
          {officialSessions > 0 && (
            <small>{directSessions} diretas + {assistedSessions} assistidas</small>
          )}
        </div>
      </section>

      <section className="marketing-journey-grid" aria-label="Jornada de aquisição">
        {journeyCards.map(([label, value, hint], index) => (
          <article className="marketing-journey-card" key={label}>
            <span className="marketing-journey-index">{index + 1}</span>
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{hint}</small>
            </div>
          </article>
        ))}
      </section>

      <section className="panel marketing-funnel-panel marketing-funnel-panel-v3">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Funil profissional</p>
            <h2>Da aquisição ao resultado</h2>
            <p className="muted">
              O AF mede o avanço real depois do cadastro. A agenda confirmada é uma etapa explícita antes da publicação no fluxo novo.
            </p>
          </div>
          <Link
            className="button button-secondary button-small"
            to={`/admin/trafego-pago/profissionais?periodo=${encodeURIComponent(loadedPeriod)}`}
          >
            Ver funil completo
          </Link>
        </div>

        <div className="marketing-funnel-rail">
          {stages.map(([label, value, rate], index) => (
            <article className="marketing-funnel-stage" key={label}>
              <span className="marketing-funnel-step">{index + 1}</span>
              <div>
                <small>{label}</small>
                <strong>{value}</strong>
                <span>{formatMetricPercent(rate)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <MarketingGa4Panel data={data?.ga4} />

      <section className="panel marketing-analysis-panel marketing-analysis-panel-v3">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Aquisição comprovada</p>
            <h2>Campanhas reconhecidas pelo AF</h2>
            <p className="muted">
              Aqui entram apenas origens que o AF conseguiu comprovar. Ambiguidade continua fora de CAC, ROAS e decisões por campanha.
            </p>
          </div>
          <Link
            className="button button-secondary button-small"
            to="/admin/trafego-pago/custos"
          >
            Ver custos e retorno
          </Link>
        </div>

        {traffic.length === 0 ? (
          <p className="muted">Nenhuma campanha teve tráfego neste período.</p>
        ) : (
          <div className="marketing-campaign-performance-grid">
            {traffic
              .slice()
              .sort((a, b) => number(b.sessoes) - number(a.sessoes))
              .slice(0, 12)
              .map((item, index) => {
                const objective = item.objetivo || "indefinido";
                const official =
                  item.oficial === true ||
                  item.classificacaoAtribuicao === "oficial";

                return (
                  <article
                    className="marketing-performance-card"
                    key={campaignKey(item, index)}
                  >
                    <div className="marketing-performance-card-head">
                      <div>
                        <strong>{campaignLabel(item)}</strong>
                        <small>
                          {sourceLabel(item.origem)}
                          {item.midia ? ` · ${String(item.midia).toUpperCase()}` : ""}
                        </small>
                      </div>
                      <span
                        className={`admin-status-badge ${official ? "is-success" : "is-warning"}`}
                      >
                        {official ? "Atribuída" : "Pendente"}
                      </span>
                    </div>

                    <div className="marketing-performance-metrics">
                      <div>
                        <span>Sessões</span>
                        <strong>{number(item.sessoes)}</strong>
                      </div>
                      <div>
                        <span>Perfis vistos</span>
                        <strong>{number(item.perfisVisualizados)}</strong>
                      </div>
                      <div>
                        <span>{objective === "cliente" ? "Agendamentos" : "Objetivo"}</span>
                        <strong>
                          {objective === "cliente"
                            ? number(item.agendamentosConcluidos)
                            : OBJECTIVES[objective] || "A classificar"}
                        </strong>
                      </div>
                    </div>
                  </article>
                );
              })}
          </div>
        )}
      </section>

      <MarketingSyncPanel
        onChanged={() => setReloadKey((current) => current + 1)}
      />
    </main>
  );
}