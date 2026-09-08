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
import {
  formatMetricPercent,
  metricPercentage,
  paidAttributionQuality
} from "../utils/marketingMetrics";

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

function classificationLabel(value) {
  const classification = String(value || "").toLowerCase();
  if (classification === "oficial") return "Atribuída";
  if (classification === "organico") return "Orgânico";
  if (classification === "rastreamento_incompleto") return "Rastreamento incompleto";
  if (classification === "identidade_nao_oficial") return "Identidade não oficial";
  if (classification === "sem_evidencia") return "Sem evidência";
  return "A revisar";
}

function professionalStages(summary) {
  const signups = toFiniteNumber(summary?.cadastros);

  return [
    ["Cadastro", signups, signups ? 100 : 0],
    [
      "Negócio criado",
      toFiniteNumber(summary?.negociosCriados),
      summary?.taxaNegocio ?? metricPercentage(summary?.negociosCriados, signups) ?? 0
    ],
    [
      "Serviço cadastrado",
      toFiniteNumber(summary?.servicosCriados),
      summary?.taxaServico ?? metricPercentage(summary?.servicosCriados, signups) ?? 0
    ],
    [
      "Agenda configurada",
      toFiniteNumber(summary?.agendasConfiguradas),
      summary?.taxaAgenda ?? metricPercentage(summary?.agendasConfiguradas, signups) ?? 0
    ],
    [
      "Negócio publicado",
      toFiniteNumber(summary?.negociosPublicados),
      summary?.taxaPublicacao ?? metricPercentage(summary?.negociosPublicados, signups) ?? 0
    ],
    [
      "1º agendamento válido",
      toFiniteNumber(summary?.primeirosAgendamentos),
      summary?.taxaPrimeiroAgendamento ??
        metricPercentage(summary?.primeirosAgendamentos, signups) ??
        0
    ],
    [
      "Checkout iniciado",
      toFiniteNumber(summary?.checkoutsIniciados),
      summary?.taxaCheckout ?? metricPercentage(summary?.checkoutsIniciados, signups) ?? 0
    ],
    [
      "Assinatura paga",
      toFiniteNumber(summary?.assinaturasAtivadas),
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

        setData({
          period,
          funnel: values.funnel,
          traffic: values.traffic?.campanhas || [],
          ga4: values.ga4 || {
            habilitado: true,
            configurado: false,
            erro: ga4Error?.error?.message || ""
          }
        });
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
  const professionalCampaigns = data?.funnel?.campanhas || [];
  const qualityCampaigns = useMemo(
    () => professionalCampaigns.filter((item) =>
      ["oficial", "organico"].includes(item?.classificacaoAtribuicao) &&
      (
        toFiniteNumber(item?.cadastros) > 0 ||
        toFiniteNumber(item?.primeirosAgendamentos) > 0 ||
        toFiniteNumber(item?.assinaturasAtivadas) > 0 ||
        toFiniteNumber(item?.investimentoCentavos) > 0
      )
    ),
    [professionalCampaigns]
  );
  const unresolvedCampaigns = useMemo(
    () => professionalCampaigns.filter((item) =>
      !["oficial", "organico"].includes(item?.classificacaoAtribuicao) &&
      toFiniteNumber(item?.cadastros) > 0
    ),
    [professionalCampaigns]
  );

  const officialSessions = officialTraffic.reduce(
    (total, item) => total + toFiniteNumber(item?.sessoes),
    0
  );
  const directSessions = officialTraffic.reduce(
    (total, item) => total + toFiniteNumber(item?.sessoesAtribuicaoDireta),
    0
  );
  const assistedSessions = officialTraffic.reduce(
    (total, item) => total + toFiniteNumber(item?.sessoesAtribuicaoAssistida),
    0
  );

  const attribution = paidAttributionQuality({
    official: officialSessions,
    missingCampaign: pendingTraffic
      .filter((item) => item?.classificacaoAtribuicao === "rastreamento_incompleto")
      .reduce((total, item) => total + toFiniteNumber(item?.sessoes), 0),
    unofficialIdentity: pendingTraffic
      .filter((item) => item?.classificacaoAtribuicao === "identidade_nao_oficial")
      .reduce((total, item) => total + toFiniteNumber(item?.sessoes), 0)
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

  const loadedPeriod = data?.period || period;
  const periodPending = loadedPeriod !== period;
  const loadedPeriodLabel = adminPeriodLabel(loadedPeriod);
  const requestedPeriodLabel = adminPeriodLabel(period);
  const funnelPath = adminPathWithPeriod("/admin/trafego-pago/profissionais", period);
  const costsPath = adminPathWithPeriod("/admin/trafego-pago/custos", period);
  const integrationsPath = `${costsPath}#integracoes-custos`;
  const measurementQuality = data?.funnel?.qualidadeMensuracao || {};
  const paidSignupCoverage = measurementQuality.coberturaAtribuicaoPagaPercentual;
  const paidSignupsDetected = toFiniteNumber(measurementQuality.cadastrosPagosDetectados);
  const minimumCoverage = toFiniteNumber(measurementQuality.coberturaMinimaPercentual) || 100;
  const paidSignupCoverageWarning =
    paidSignupCoverage !== null &&
    paidSignupCoverage !== undefined &&
    Number(paidSignupCoverage) < minimumCoverage;
  const ga4Configured = data?.ga4?.configurado === true;
  const ga4Summary = data?.ga4?.resumo || {};

  const journeyCards = [
    {
      label: "Sessões no site",
      value: ga4Configured ? toFiniteNumber(ga4Summary.sessoes) : "—",
      hint: ga4Configured
        ? `${toFiniteNumber(ga4Summary.usuarios)} usuários no GA4`
        : "GA4 indisponível para este período",
      source: "GA4"
    },
    {
      label: "Cadastros profissionais",
      value: toFiniteNumber(professionalSummary.cadastros),
      hint: "coorte profissional do período",
      source: "Banco AF"
    },
    {
      label: "1º agendamento válido",
      value: toFiniteNumber(professionalSummary.primeirosAgendamentos),
      hint: `${formatMetricPercent(professionalSummary.taxaPrimeiroAgendamento)} dos cadastros`,
      source: "Banco AF"
    },
    {
      label: "Assinaturas pagas",
      value: toFiniteNumber(professionalSummary.assinaturasAtivadas),
      hint: `${formatMetricPercent(professionalSummary.taxaAssinatura)} dos cadastros`,
      source: "Banco AF"
    }
  ];

  const sortedQualityCampaigns = qualityCampaigns
    .slice()
    .sort((a, b) =>
      toFiniteNumber(b?.primeirosAgendamentos) - toFiniteNumber(a?.primeirosAgendamentos) ||
      toFiniteNumber(b?.cadastros) - toFiniteNumber(a?.cadastros)
    )
    .slice(0, 12);

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
            Entenda de onde as pessoas chegam e quais origens trazem profissionais que avançam até o primeiro agendamento e a monetização.
          </p>
        </div>

        <div className="marketing-command-actions">
          <nav className="marketing-command-nav" aria-label="Áreas do marketing">
            <span aria-current="page">Visão geral</span>
            <Link to={funnelPath}>Funil completo</Link>
            <Link to={costsPath}>Custos e retorno</Link>
            <Link to={integrationsPath}>Integrações</Link>
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
        <p className="data-refresh-status" role="status">
          {periodPending
            ? `Mostrando os últimos dados de ${loadedPeriodLabel} enquanto ${requestedPeriodLabel} é atualizado…`
            : "Atualizando análise sem ocultar os últimos dados…"}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}{periodPending ? ` Os dados abaixo ainda correspondem a ${loadedPeriodLabel}.` : ""}
        </p>
      )}

      <section className="marketing-trust-bar" aria-label="Confiabilidade dos dados">
        <div className="marketing-trust-copy">
          <span>Dados conectados</span>
          <strong>Comportamento + coorte + atribuição</strong>
          <small>
            GA4 explica navegação. O banco do AF continua sendo a fonte para cadastro, primeiro agendamento, assinatura e receita.
          </small>
        </div>

        <div className="marketing-trust-signals">
          <span className={`marketing-trust-chip ${ga4Configured ? "is-success" : "is-warning"}`}>
            {ga4Configured ? "GA4 conectado" : "GA4 indisponível"}
          </span>
          <span className={`marketing-trust-chip ${paidSignupCoverageWarning ? "is-warning" : "is-success"}`}>
            {paidSignupsDetected === 0
              ? "Sem cadastro pago detectado"
              : `${formatMetricPercent(paidSignupCoverage)} dos cadastros pagos atribuídos`}
          </span>
          {attribution.detectedPaidSessions > 0 && (
            <small>
              Sessões pagas com campanha reconhecida: {formatMetricPercent(attribution.coverage)}
              {officialSessions > 0 ? ` · ${directSessions} diretas + ${assistedSessions} assistidas` : ""}
            </small>
          )}
        </div>
      </section>

      <section className="marketing-journey-grid" aria-label="Indicadores de aquisição">
        {journeyCards.map(({ label, value, hint, source }) => (
          <article className="marketing-journey-card" key={label}>
            <span className="marketing-journey-source">{source}</span>
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
            <p className="eyebrow">Coorte profissional</p>
            <h2>Marcos da coorte profissional</h2>
            <p className="muted">
              Todos os percentuais usam os cadastros da coorte como base. Os marcos não são conversões adjacentes; negócios legados podem estar publicados sem agenda confirmada.
            </p>
          </div>
          <Link
            className="button button-secondary button-small"
            to={funnelPath}
          >
            Ver análise completa
          </Link>
        </div>

        <div className="marketing-funnel-rail">
          {stages.map(([label, value, rate]) => (
            <article className="marketing-funnel-stage" key={label}>
              <div>
                <small>{label}</small>
                <strong>{value}</strong>
                <span>{formatMetricPercent(rate)} dos cadastros</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel marketing-analysis-panel marketing-analysis-panel-v3">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Qualidade da aquisição</p>
            <h2>Quais origens trazem profissionais que avançam</h2>
            <p className="muted">
              A leitura abaixo usa a coorte atribuída do AF. Volume de sessão no GA4 é contexto e não substitui cadastro, primeiro agendamento ou pagamento.
            </p>
          </div>
          <Link
            className="button button-secondary button-small"
            to={funnelPath}
          >
            Ver funil e retorno
          </Link>
        </div>

        {sortedQualityCampaigns.length === 0 ? (
          <p className="muted">
            Ainda não há origem oficial ou orgânica com base suficiente nesta seleção.
          </p>
        ) : (
          <div className="marketing-quality-grid">
            {sortedQualityCampaigns.map((item, index) => (
              <article className="marketing-quality-card" key={campaignKey(item, index)}>
                <div className="marketing-quality-card-head">
                  <div>
                    <strong>{campaignLabel(item)}</strong>
                    <small>
                      {sourceLabel(item.origem)}
                      {item.midia ? ` · ${String(item.midia).toUpperCase()}` : ""}
                    </small>
                  </div>
                  <span
                    className={`admin-status-badge ${item.oficial ? "is-success" : "is-muted"}`}
                  >
                    {classificationLabel(item.classificacaoAtribuicao)}
                  </span>
                </div>

                <div className="marketing-quality-metrics">
                  <div>
                    <span>Cadastros</span>
                    <strong>{toFiniteNumber(item.cadastros)}</strong>
                  </div>
                  <div>
                    <span>1º agendamento</span>
                    <strong>{toFiniteNumber(item.primeirosAgendamentos)}</strong>
                  </div>
                  <div>
                    <span>Taxa de ativação</span>
                    <strong>{formatMetricPercent(item.taxaPrimeiroAgendamento)}</strong>
                  </div>
                  <div>
                    <span>Assinaturas pagas</span>
                    <strong>{toFiniteNumber(item.assinaturasAtivadas)}</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {unresolvedCampaigns.length > 0 && (
          <div className="marketing-attribution-pending-section">
            <h3>Origens da coorte ainda sem evidência suficiente</h3>
            <p className="muted">
              Esses cadastros continuam visíveis para diagnóstico, mas não entram em CAC, ROAS ou decisão forte por campanha.
            </p>
            <div className="marketing-attribution-pending-grid">
              {unresolvedCampaigns.slice(0, 8).map((item, index) => (
                <article
                  className="marketing-attribution-pending-card"
                  key={campaignKey(item, index)}
                >
                  <div className="marketing-attribution-pending-card-head">
                    <div>
                      <strong>{campaignLabel(item)}</strong>
                      <small>{sourceLabel(item.origem)}</small>
                    </div>
                    <span className="admin-status-badge is-warning">
                      {classificationLabel(item.classificacaoAtribuicao)}
                    </span>
                  </div>
                  <div className="marketing-attribution-pending-metrics">
                    <div>
                      <span>Cadastros</span>
                      <strong>{toFiniteNumber(item.cadastros)}</strong>
                    </div>
                    <div>
                      <span>1º agendamento</span>
                      <strong>{toFiniteNumber(item.primeirosAgendamentos)}</strong>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <MarketingGa4Panel data={data?.ga4} />

      <section className="marketing-integrations-shortcut" aria-label="Integrações de marketing">
        <div>
          <strong>Integrações e sincronização</strong>
          <p className="muted">
            Saúde, OAuth, vínculos e sincronização das plataformas são estado operacional atual e ficam no painel canônico de custos.
          </p>
        </div>
        <Link className="button button-secondary button-small" to={integrationsPath}>
          Gerenciar integrações
        </Link>
      </section>
    </main>
  );
}
