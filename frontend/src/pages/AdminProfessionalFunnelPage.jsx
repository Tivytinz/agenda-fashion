import {
  Fragment,
  useEffect,
  useState
} from "react";
import { apiRequest } from "../api/client";
import { MarketingBarChart } from "../components/MarketingBarChart";
import { MarketingExecutivePanel } from "../components/MarketingExecutivePanel";
import {
  ErrorState,
  LoadingState
} from "../components/ScreenState";
import {
  formatMetricPercent,
  metricPercentage,
  paidAttributionQuality
} from "../utils/marketingMetrics";

const PERIODS = [
  ["today", "Hoje"],
  ["7", "7 dias"],
  ["30", "30 dias"],
  ["month", "Este mês"],
  ["all", "Todo período"]
];

function formatMoney(value) {
  if (value === null || value === undefined) return "Sem dados";
  const number = Number(value);
  if (!Number.isFinite(number)) return "Sem dados";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(number / 100);
}

function formatRoas(value) {
  if (value === null || value === undefined) return "Sem dados";
  const number = Number(value);
  if (!Number.isFinite(number)) return "Sem dados";
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(number)}x`;
}

function campaignLabel(item) {
  const campaign = String(item?.campanha || "").trim();
  const source = String(item?.origem || "").trim().toLowerCase();
  const medium = String(item?.midia || "").trim().toLowerCase();
  const classification = String(
    item?.classificacaoAtribuicao || ""
  ).trim().toLowerCase();

  if (classification === "sem_evidencia") {
    return "Origem não identificada";
  }

  if (
    source === "google" &&
    medium === "cpc" &&
    campaign.toLowerCase() === "google_ads_profissionais"
  ) {
    return "Google Ads · Aquisição de profissionais";
  }

  if (
    !campaign ||
    [
      "organico",
      "orgânico",
      "(sem campanha)",
      "sem campanha"
    ].includes(campaign.toLowerCase())
  ) {
    if (source === "organico" && (!medium || medium === "none")) {
      return "Orgânico / sem campanha";
    }
    return "Tráfego sem UTM de campanha";
  }

  return campaign;
}

function campaignKey(item) {
  return `${item.classificacaoAtribuicao || "sem_classificacao"}-${item.origem}-${item.midia}-${item.campanha}`;
}

function utmIdentityLabel(item) {
  return [
    item?.origem || "organico",
    item?.midia || "none",
    item?.campanha || "organico"
  ].join(" / ");
}

function decisionBadgeClass(code) {
  const safeCode = String(code || "sem_dados").replace(/[^a-z_]/g, "");
  return `admin-status-badge admin-decision-badge is-${safeCode}`;
}

function sourceMeta(item) {
  const source = String(item?.origem || "").trim().toLowerCase();
  const classification = String(
    item?.classificacaoAtribuicao || ""
  ).trim().toLowerCase();

  if (classification === "sem_evidencia") {
    return { code: "outro", label: "Origem não identificada" };
  }

  if (source === "google") return { code: "google", label: "Google Ads" };
  if (["meta", "facebook", "instagram"].includes(source)) {
    return { code: "meta", label: "Meta Ads" };
  }
  if (source === "pinterest") return { code: "pinterest", label: "Pinterest" };
  if (source === "tiktok") return { code: "tiktok", label: "TikTok" };
  if (source === "organico") return { code: "organico", label: "Orgânico" };

  return {
    code: "outro",
    label: source
      ? source.charAt(0).toUpperCase() + source.slice(1)
      : "Origem não identificada"
  };
}

function mediumLabel(item) {
  const source = String(item?.origem || "").trim().toLowerCase();
  const medium = String(item?.midia || "").trim().toLowerCase();
  if (source === "organico" && (!medium || medium === "none")) return "";
  return medium ? medium.toUpperCase() : "";
}

function isOrganicCampaign(item) {
  const source = String(item?.origem || "").trim().toLowerCase();
  const medium = String(item?.midia || "").trim().toLowerCase();
  const classification = String(
    item?.classificacaoAtribuicao || ""
  ).trim().toLowerCase();

  return classification === "organico" || (
    !classification &&
    source === "organico" &&
    (!medium || medium === "none")
  );
}

function decisionSignalLabel(confidence) {
  if (confidence === "operacional") return "Sinal operacional";
  if (confidence === "bloqueada") return "Decisão bloqueada";
  return "Base ainda insuficiente";
}

export function AdminProfessionalFunnelPage() {
  const [period, setPeriod] = useState("30");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(true);
  const [expandedCampaign, setExpandedCampaign] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setError("");
    setRefreshing(true);

    apiRequest(`/admin/marketing/funil-profissionais?periodo=${period}`, {
      signal: controller.signal
    })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((requestError) => {
        if (active && requestError.name !== "AbortError") {
          setError(requestError.message);
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

  function selectPeriod(value) {
    if (value === period) return;
    setData(null);
    setError("");
    setExpandedCampaign("");
    setPeriod(value);
  }

  if (!data && !error) {
    return (
      <main className="workspace-page admin-workspace-page admin-marketing-page admin-professional-funnel-page">
        <LoadingState>Carregando aquisição e retorno profissional...</LoadingState>
      </main>
    );
  }

  if (!data && error) {
    return (
      <main className="workspace-page admin-workspace-page admin-marketing-page admin-professional-funnel-page">
        <ErrorState
          message={error}
          onRetry={() => setReloadKey((current) => current + 1)}
        />
      </main>
    );
  }

  const summary = data?.resumoOficial || data?.resumo || {};
  const decision = data?.decisao || {};
  const decisionCounts = decision?.contagem || {};
  const campaigns = data?.campanhasOficiais || data?.campanhas || [];
  const attributionDiagnostic = data?.diagnosticoAtribuicao || {};
  const measurementQuality = data?.qualidadeMensuracao || {};
  const signupAttributionQuality = paidAttributionQuality({
    official: attributionDiagnostic.cadastrosOficiais ?? summary.cadastros,
    missingCampaign: attributionDiagnostic.cadastrosSemCampanha,
    unofficialIdentity: attributionDiagnostic.cadastrosIdentidadeNaoOficial
  });
  const signupsWithoutEvidence = Number(
    attributionDiagnostic.cadastrosSemEvidencia ??
    measurementQuality.cadastrosSemEvidencia ??
    0
  );
  const totalAttributedSignups = Number(
    measurementQuality.cadastrosTotais ??
    (
      signupAttributionQuality.detectedPaidSessions +
      Number(attributionDiagnostic.cadastrosOrganicos || 0) +
      signupsWithoutEvidence
    )
  );
  const paidCoverage =
    measurementQuality.coberturaAtribuicaoPagaPercentual ??
    signupAttributionQuality.coverage;
  const originCoverage =
    measurementQuality.coberturaOrigemPercentual ??
    metricPercentage(
      totalAttributedSignups - signupsWithoutEvidence,
      totalAttributedSignups
    );
  const minimumCoverage = Number(
    measurementQuality.coberturaMinimaPercentual ??
    decision.coberturaMinimaPercentual ??
    100
  );
  const measurementReady =
    measurementQuality.prontaParaDecisao ??
    (
      signupsWithoutEvidence === 0 &&
      (paidCoverage === null || Number(paidCoverage) >= minimumCoverage)
    );
  const investment = Number(summary.investimentoCentavos || 0);
  const signups = Number(summary.cadastros || 0);
  const subscriptions = Number(summary.assinaturasAtivadas || 0);
  const firstAppointments = Number(summary.primeirosAgendamentos || 0);
  const profitabilityTone = !measurementReady
    ? "warning"
    : investment <= 0
    ? "neutral"
    : signups === 0
      ? "critical"
      : firstAppointments === 0 || subscriptions === 0 || Number(summary.roas || 0) < Number(decision.metaRoas || 1)
        ? "warning"
        : "success";
  const profitabilityStatus = !measurementReady
    ? "Mensuração incompleta"
    : investment <= 0
    ? "Sem investimento"
    : signups === 0
      ? "Aquisição sem cadastro"
      : firstAppointments === 0
        ? "Ativação em atenção"
        : subscriptions === 0
          ? "Monetização em análise"
          : Number(summary.roas || 0) < Number(decision.metaRoas || 1)
          ? "Retorno abaixo da meta"
          : "Aquisição rentável";

  const cards = [
    [
      "Cadastros profissionais",
      summary.cadastros ?? 0,
      !measurementReady
        ? "coorte oficial parcial; custo bloqueado"
        : summary.custoCadastroCentavos === null
        ? "atribuídos a campanhas oficiais"
        : `${formatMoney(summary.custoCadastroCentavos)} por cadastro`
    ],
    [
      "Negócios publicados",
      summary.negociosPublicados ?? 0,
      `${summary.taxaPublicacao ?? 0}% dos cadastros`
    ],
    [
      "Primeiros agendamentos",
      summary.primeirosAgendamentos ?? 0,
      `${summary.taxaPrimeiroAgendamento ?? 0}% dos cadastros`
    ],
    [
      "Assinaturas ativadas",
      summary.assinaturasAtivadas ?? 0,
      !measurementReady
        ? "resultado parcial; CAC bloqueado"
        : summary.cacAssinanteCentavos === null
        ? `${summary.taxaAssinatura ?? 0}% dos cadastros`
        : `CAC ${formatMoney(summary.cacAssinanteCentavos)}`
    ],
    [
      "Investimento",
      formatMoney(summary.investimentoCentavos ?? 0),
      "gasto atribuído no período"
    ],
    [
      "Receita atribuída",
      formatMoney(summary.receitaPrimeiroPagamentoCentavos ?? 0),
      measurementReady
        ? "primeiro pagamento da aquisição"
        : "valor parcial; não usar para decisão"
    ],
    [
      "ROAS de aquisição",
      measurementReady ? formatRoas(summary.roas) : "Aguardando cobertura",
      measurementReady
        ? "receita atribuída ÷ investimento"
        : "decisão financeira bloqueada"
    ]
  ];

  const stages = [
    ["Cadastro", summary.cadastros ?? 0, summary.cadastros ? 100 : 0],
    ["Negócio criado", summary.negociosCriados ?? 0, summary.taxaNegocio ?? 0],
    [
      "Serviço criado",
      summary.servicosCriados ?? 0,
      summary.taxaServico ?? metricPercentage(
        summary.servicosCriados,
        summary.cadastros,
        2
      ) ?? 0
    ],
    [
      "Agenda configurada",
      summary.agendasConfiguradas ?? 0,
      summary.taxaAgenda ?? metricPercentage(
        summary.agendasConfiguradas,
        summary.cadastros,
        2
      ) ?? 0
    ],
    ["Negócio publicado", summary.negociosPublicados ?? 0, summary.taxaPublicacao ?? 0],
    [
      "Primeiro agendamento",
      summary.primeirosAgendamentos ?? 0,
      summary.taxaPrimeiroAgendamento ?? metricPercentage(
        summary.primeirosAgendamentos,
        summary.cadastros,
        2
      ) ?? 0
    ],
    ["Checkout iniciado", summary.checkoutsIniciados ?? 0, summary.taxaCheckout ?? 0],
    ["Assinatura ativada", summary.assinaturasAtivadas ?? 0, summary.taxaAssinatura ?? 0]
  ];

  const stageChartItems = stages.map(([label, value, rate]) => ({
    key: label,
    label,
    value: rate,
    formattedValue: `${rate}%`,
    secondary: `${value} profissionais`
  }));

  const roasChartItems = (measurementReady ? campaigns : [])
    .filter((item) => Number.isFinite(Number(item.roas)) && Number(item.roas) > 0)
    .sort((a, b) => Number(b.roas) - Number(a.roas))
    .slice(0, 8)
    .map((item) => ({
      key: campaignKey(item),
      label: campaignLabel(item),
      value: Number(item.roas),
      formattedValue: formatRoas(item.roas),
      secondary: `${sourceMeta(item).label} · CAC ${formatMoney(item.cacAssinanteCentavos)}`
    }));

  return (
    <main
      aria-busy={refreshing}
      className="workspace-page admin-workspace-page admin-marketing-page admin-professional-funnel-page"
    >
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">Administração do AF</p>
          <h1>Aquisição e retorno de profissionais</h1>
          <p>
            Acompanhe aquisição, ativação, primeiro agendamento e retorno atribuído. CAC e ROAS só orientam orçamento quando a mensuração está completa.
          </p>
        </div>

        <div className="segmented-control" aria-label="Período do funil profissional">
          {PERIODS.map(([value, label]) => (
            <button
              aria-pressed={period === value}
              className={period === value ? "active" : ""}
              key={value}
              onClick={() => selectPeriod(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {refreshing && <p className="data-refresh-status" role="status">Atualizando aquisição e retorno...</p>}
      {error && (
        <p className="form-error" role="alert">
          {error} Os últimos dados carregados continuam visíveis.
        </p>
      )}

      <section className="metric-grid" aria-label="Indicadores do funil profissional">
        {cards.map(([label, value, hint]) => (
          <article className="metric-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
          </article>
        ))}
      </section>

      <MarketingExecutivePanel
        action={!measurementReady
          ? "corrija os cadastros pagos pendentes e os registros sem evidência de origem antes de alterar orçamento."
          : investment > 0 && signups === 0
          ? "não aumente o orçamento ainda. Valide a landing page, o formulário de cadastro, o evento de conversão e a preservação do identificador de clique."
          : firstAppointments === 0 && signups > 0
            ? "identifique o primeiro marco com maior perda antes de alterar segmentação ou orçamento."
            : subscriptions === 0 && signups > 0
              ? "revise a proposta do plano pago sem tratar o uso gratuito como falha de aquisição."
            : "compare CAC e ROAS com a régua de decisão antes de escalar."}
        metrics={[
          {
            label: "Custo por cadastro",
            value: measurementReady
              ? formatMoney(summary.custoCadastroCentavos)
              : "Aguardando cobertura",
            hint: measurementReady
              ? (signups > 0 ? `${signups} cadastros oficiais` : "não calculável sem cadastro")
              : "coorte oficial ainda parcial"
          },
          {
            label: "CAC assinante",
            value: measurementReady
              ? formatMoney(summary.cacAssinanteCentavos)
              : "Aguardando cobertura",
            hint: measurementReady
              ? (subscriptions > 0 ? `${subscriptions} assinaturas ativadas` : "não calculável sem assinatura")
              : "não use o valor parcial para decisão"
          },
          {
            label: "ROAS",
            value: measurementReady
              ? formatRoas(summary.roas)
              : "Aguardando cobertura",
            hint: measurementReady
              ? `meta ${formatRoas(decision.metaRoas)}`
              : "decisão financeira bloqueada"
          },
          {
            label: "Cobertura dos cadastros pagos",
            value: formatMetricPercent(paidCoverage),
            hint: `${signupAttributionQuality.pendingSessions} cadastros pagos fora da coorte oficial`
          },
          {
            label: "Cobertura de origem",
            value: formatMetricPercent(originCoverage),
            hint: `${signupsWithoutEvidence} cadastros sem evidência de origem`
          }
        ]}
        status={profitabilityStatus}
        summary={!measurementReady
          ? `A coorte oficial ainda está incompleta: ${signupAttributionQuality.pendingSessions} cadastro(s) pago(s) aguardam vínculo e ${signupsWithoutEvidence} não têm evidência de origem. CAC, ROAS e decisões de orçamento permanecem bloqueados.`
          : investment <= 0
          ? "Não há investimento profissional registrado no período selecionado."
          : signups === 0
            ? `${formatMoney(investment)} foram investidos, mas nenhum cadastro profissional oficial foi atribuído. CAC não é zero: ele ainda não pode ser calculado.`
            : firstAppointments === 0
              ? `A campanha gerou ${signups} cadastros, mas nenhum primeiro agendamento. O gargalo está na ativação do valor gratuito.`
              : subscriptions === 0
                ? `A coorte já recebeu ${firstAppointments} primeiro(s) agendamento(s), mas ainda não ativou assinatura paga. Revise monetização sem pausar mídia apenas por esse motivo.`
              : `A coorte gerou ${subscriptions} assinaturas e ROAS de ${formatRoas(summary.roas)} no primeiro pagamento.`}
        title="Diagnóstico de aquisição profissional"
        tone={profitabilityTone}
      />

      <section className="admin-attribution-overview" aria-label="Qualidade da atribuição dos cadastros">
        <div>
          <span>Oficiais</span>
          <strong>{attributionDiagnostic.cadastrosOficiais ?? summary.cadastros ?? 0}</strong>
          <small>{measurementReady ? "entram em CAC e ROAS" : "base oficial ainda parcial"}</small>
        </div>
        <div>
          <span>Sem campanha</span>
          <strong>{attributionDiagnostic.cadastrosSemCampanha ?? 0}</strong>
          <small>pagos com UTM incompleta</small>
        </div>
        <div>
          <span>Identidade não oficial</span>
          <strong>{attributionDiagnostic.cadastrosIdentidadeNaoOficial ?? 0}</strong>
          <small>pagos fora da campanha cadastrada</small>
        </div>
        <div>
          <span>Sem evidência</span>
          <strong>{signupsWithoutEvidence}</strong>
          <small>origem paga, orgânica ou direta não comprovada</small>
        </div>
        <div>
          <span>Orgânicos</span>
          <strong>{attributionDiagnostic.cadastrosOrganicos ?? 0}</strong>
          <small>fora do retorno de mídia paga</small>
        </div>
      </section>

      <section className="admin-decision-summary" aria-label="Resumo das recomendações de campanha">
        <div>
          <span>Mensuração bloqueada</span>
          <strong>{decisionCounts.mensuracaoIncompleta ?? 0}</strong>
          <small>Sem decisão financeira até atingir a cobertura mínima</small>
        </div>
        <div>
          <span>Para escalar</span>
          <strong>{decisionCounts.escalar ?? 0}</strong>
          <small>
            {decision.faixaEscalaRoas
              ? `ROAS a partir de ${formatRoas(decision.faixaEscalaRoas)}`
              : "Aguardando régua"}
          </small>
        </div>
        <div>
          <span>Para manter</span>
          <strong>{decisionCounts.manter ?? 0}</strong>
          <small>Meta de ROAS atingida, sem faixa de escala</small>
        </div>
        <div>
          <span>Em análise</span>
          <strong>
            {(decisionCounts.observar ?? 0) + (decisionCounts.revisar ?? 0)}
          </strong>
          <small>Amostra pequena ou otimização necessária</small>
        </div>
        <div>
          <span>Para pausar</span>
          <strong>{decisionCounts.pausar ?? 0}</strong>
          <small>Somente com amostra mínima atingida</small>
        </div>
        <div className="admin-decision-rule">
          <span>Régua de decisão</span>
          <strong>
            {decision.minimoCadastros ?? "Sem dados"} cadastros · {decision.minimoAssinaturas ?? "Sem dados"} assinaturas
          </strong>
          <small>
            Cobertura mínima {formatMetricPercent(minimumCoverage)} · ativação em {decision.diasMaturacaoAtivacao ?? 14} dias · monetização em {decision.diasMaturacaoMonetizacao ?? 21} dias
          </small>
          <small>
            Meta de ROAS {formatRoas(decision.metaRoas)} · escala em {formatRoas(decision.faixaEscalaRoas)} · sinal operacional, não confiança estatística
          </small>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Ativação</p>
            <h2>Marcos alcançados pela coorte</h2>
            <p className="muted">
              Cada marco é medido de forma independente para os profissionais atribuídos a campanhas oficiais no período selecionado.
            </p>
          </div>
        </div>

        <div className="admin-insights-grid">
          <MarketingBarChart
            title="Atingimento por marco"
            description="Percentual da coorte oficial que já alcançou cada marco."
            items={stageChartItems}
            emptyMessage="Ainda não há profissionais nesta coorte."
            variant="none"
          />

          <div className="admin-stat-table-card">
            <div className="admin-stat-table-heading">
              <strong>Detalhamento da coorte</strong>
              <small>Quantidade e participação sobre os cadastros oficiais.</small>
            </div>
            <div className="table-wrap">
              <table className="admin-compact-table">
                <thead>
                  <tr>
                    <th>Marco</th>
                    <th>Profissionais</th>
                    <th>% dos cadastros</th>
                  </tr>
                </thead>
                <tbody>
                  {stages.map(([label, value, rate]) => (
                    <tr key={label}>
                      <td>{label}</td>
                      <td>{value}</td>
                      <td>{rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Retorno</p>
            <h2>Retorno e decisão por campanha</h2>
            <p className="muted">
              Compare investimento, receita atribuída, ROAS e CAC. Estes indicadores não representam lucro: custos operacionais, impostos e margem não entram no cálculo. A receita considera somente o primeiro pagamento da aquisição; reembolso zera a receita e renovações posteriores não entram no ROAS.
            </p>
            <p className="muted">As recomendações são analíticas e não alteram campanhas automaticamente.</p>
            <p className="muted admin-campaign-attribution-note">
              Identidades UTM históricas equivalentes são consolidadas na campanha canônica para unir investimento e conversões. Os nomes originais continuam disponíveis nos detalhes para auditoria.
            </p>
          </div>
        </div>

        <MarketingBarChart
          title="ROAS por campanha"
          description="Comparação das campanhas com ROAS calculável no período."
          items={roasChartItems}
          emptyMessage={measurementReady
            ? "Nenhuma campanha possui investimento e receita suficientes para calcular ROAS neste período."
            : "ROAS oculto enquanto a cobertura de atribuição estiver incompleta."}
          variant="none"
        />

        {campaigns.length === 0 ? (
          <p className="muted">Ainda não há profissionais nesta coorte.</p>
        ) : (
          <div className="table-wrap admin-chart-table-spacing">
            <table className="admin-decision-table">
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th>Investimento</th>
                  <th>Receita</th>
                  <th>ROAS</th>
                  <th>CAC</th>
                  <th>Decisão</th>
                  <th>Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((item) => {
                  const key = campaignKey(item);
                  const expanded = expandedCampaign === key;
                  const source = sourceMeta(item);
                  const medium = mediumLabel(item);
                  const identities = Array.isArray(item.identidadesUtm)
                    ? item.identidadesUtm
                    : [];

                  return (
                    <Fragment key={key}>
                      <tr>
                        <td>
                          <strong>{campaignLabel(item)}</strong>
                          <div className="admin-campaign-source">
                            <span className={`admin-status-badge admin-source-badge is-${source.code}`}>
                              {source.label}
                            </span>
                            {medium && <small className="admin-medium-label">{medium}</small>}
                            {identities.length > 1 && (
                              <small className="admin-medium-label">
                                {identities.length} identidades vinculadas
                              </small>
                            )}
                          </div>
                        </td>
                        <td>
                          {item.investimentoCentavos > 0
                            ? formatMoney(item.investimentoCentavos)
                            : (
                              <span className="admin-data-empty">
                                {isOrganicCampaign(item) ? "Não se aplica" : "Não atribuído"}
                              </span>
                            )}
                        </td>
                        <td>
                          {formatMoney(item.receitaPrimeiroPagamentoCentavos ?? 0)}
                          {!measurementReady && (
                            <small className="admin-data-empty">Parcial</small>
                          )}
                        </td>
                        <td>
                          <strong className={!measurementReady || item.roas === null || item.roas === undefined ? "admin-data-empty" : ""}>
                            {!measurementReady
                              ? "Aguardando cobertura"
                              : item.roas === null || item.roas === undefined
                              ? "Não calculável"
                              : formatRoas(item.roas)}
                          </strong>
                        </td>
                        <td>
                          <span className={!measurementReady || item.cacAssinanteCentavos === null || item.cacAssinanteCentavos === undefined ? "admin-data-empty" : ""}>
                            {!measurementReady
                              ? "Aguardando cobertura"
                              : item.cacAssinanteCentavos === null || item.cacAssinanteCentavos === undefined
                              ? "Não calculável"
                              : formatMoney(item.cacAssinanteCentavos)}
                          </span>
                        </td>
                        <td className="admin-decision-cell">
                          <span className={decisionBadgeClass(item.decisao?.codigo)}>
                            {item.decisao?.rotulo || "Sem dados"}
                          </span>
                          {item.decisao?.codigo !== "sem_dados" && (
                            <small className="muted">
                              {decisionSignalLabel(item.decisao?.confianca)}
                            </small>
                          )}
                        </td>
                        <td>
                          <button
                            aria-expanded={expanded}
                            className="button button-secondary button-small admin-detail-toggle"
                            onClick={() => setExpandedCampaign(expanded ? "" : key)}
                            type="button"
                          >
                            {expanded ? "Ocultar detalhes" : "Ver detalhes"}
                          </button>
                        </td>
                      </tr>

                      {expanded && (
                        <tr className="admin-campaign-detail-row">
                          <td colSpan="7">
                            <div className="admin-campaign-detail-grid">
                              <div>
                                <span>Cadastros</span>
                                <strong>{item.cadastros}</strong>
                              </div>
                              <div>
                                <span>Checkouts</span>
                                <strong>{item.checkoutsIniciados}</strong>
                              </div>
                              <div>
                                <span>Primeiros agendamentos</span>
                                <strong>{item.primeirosAgendamentos ?? 0} · {item.taxaPrimeiroAgendamento ?? 0}%</strong>
                              </div>
                              <div>
                                <span>Assinaturas</span>
                                <strong>{item.assinaturasAtivadas} · {item.taxaAssinatura}%</strong>
                              </div>
                              <div>
                                <span>Custo por cadastro</span>
                                <strong>
                                  {measurementReady
                                    ? formatMoney(item.custoCadastroCentavos)
                                    : "Aguardando cobertura"}
                                </strong>
                              </div>
                              <div>
                                <span>Custo por checkout</span>
                                <strong>
                                  {measurementReady
                                    ? formatMoney(item.custoCheckoutCentavos)
                                    : "Aguardando cobertura"}
                                </strong>
                              </div>
                              <div>
                                <span>Cadastros maduros</span>
                                <strong>
                                  {item.cadastrosMadurosAtivacao ?? 0} ativação · {item.cadastrosMadurosMonetizacao ?? 0} monetização
                                </strong>
                              </div>
                              <div>
                                <span>Ativação na janela</span>
                                <strong>
                                  {item.negociosPublicadosMadurosAtivacao ?? 0} publicados · {item.primeirosAgendamentosMadurosAtivacao ?? 0} com primeiro agendamento em até {decision.diasMaturacaoAtivacao ?? 14} dias
                                </strong>
                              </div>
                              <div>
                                <span>Monetização na janela</span>
                                <strong>
                                  {item.assinaturasAtivadasMadurasMonetizacao ?? 0} assinaturas em até {decision.diasMaturacaoMonetizacao ?? 21} dias
                                </strong>
                              </div>
                              {identities.length > 1 && (
                                <div className="admin-campaign-decision-reason">
                                  <span>Identidades UTM incluídas</span>
                                  <strong>
                                    {identities.map(utmIdentityLabel).join(" · ")}
                                  </strong>
                                </div>
                              )}
                              {item.decisao?.motivo && (
                                <div className="admin-campaign-decision-reason">
                                  <span>Motivo da recomendação</span>
                                  <strong>{item.decisao.motivo}</strong>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
