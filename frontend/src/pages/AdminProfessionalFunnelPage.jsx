import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { MarketingBarChart } from "../components/MarketingBarChart";
import { MarketingExecutivePanel } from "../components/MarketingExecutivePanel";
import { ProfessionalPostAgendaFunnel } from "../components/ProfessionalPostAgendaFunnel";
import { ProfessionalRecurrencePanel } from "../components/ProfessionalRecurrencePanel";
import { ProfessionalCampaignDecisionTable } from "../components/ProfessionalCampaignDecisionTable";
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
import {
  formatMetricPercent,
  metricPercentage,
  paidAttributionQuality
} from "../utils/marketingMetrics";
import {
  campaignKey,
  campaignLabel,
  campaignSourceMeta,
  formatCampaignMoney,
  formatCampaignRoas
} from "../utils/professionalCampaigns";

export function AdminProfessionalFunnelPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const period = normalizeAdminPeriod(searchParams.get("periodo"));
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
        if (active) setData({ ...result, __period: period });
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
    setError("");
    setExpandedCampaign("");
    setSearchParams(setPeriodSearchParam(searchParams, value));
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

  const loadedPeriod = data?.__period || period;
  const periodPending = loadedPeriod !== period;
  const loadedPeriodLabel = adminPeriodLabel(loadedPeriod);
  const requestedPeriodLabel = adminPeriodLabel(period);
  const operationalSummary = data?.resumo || data?.resumoOficial || {};
  const financialSummary = data?.resumoOficial || data?.resumo || {};
  const summary = operationalSummary;
  const decision = data?.decisao || {};
  const decisionCounts = decision?.contagem || {};
  const campaigns = data?.campanhasOficiais || data?.campanhas || [];
  const attributionDiagnostic = data?.diagnosticoAtribuicao || {};
  const measurementQuality = data?.qualidadeMensuracao || {};
  const signupAttributionQuality = paidAttributionQuality({
    official:
      attributionDiagnostic.cadastrosOficiais ??
      financialSummary.cadastros,
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
  const investment = Number(
    financialSummary.investimentoCentavos || 0
  );
  const signups = Number(
    operationalSummary.cadastros || 0
  );
  const officialSignups = Number(
    financialSummary.cadastros || 0
  );
  const officialSubscriptions = Number(
    financialSummary.assinaturasAtivadas || 0
  );
  const officialFirstAppointments = Number(
    financialSummary.primeirosAgendamentos || 0
  );
  const grossInvestmentPerSignup =
    investment > 0 && signups > 0
      ? Math.round(investment / signups)
      : null;
  const profitabilityTone = !measurementReady
    ? "warning"
    : investment <= 0
    ? "neutral"
    : officialSignups === 0
      ? "critical"
      : officialFirstAppointments === 0 ||
        officialSubscriptions === 0 ||
        Number(financialSummary.roas || 0) < Number(decision.metaRoas || 1)
        ? "warning"
        : "success";
  const profitabilityStatus = !measurementReady
    ? "Mensuração incompleta"
    : investment <= 0
    ? "Sem investimento"
    : officialSignups === 0
      ? "Aquisição sem cadastro atribuído"
      : officialFirstAppointments === 0
        ? "Ativação em atenção"
        : officialSubscriptions === 0
          ? "Monetização em análise"
          : Number(financialSummary.roas || 0) < Number(decision.metaRoas || 1)
          ? "Retorno abaixo da meta"
          : "Aquisição rentável";

  const cards = [
    [
      "Cadastros profissionais",
      operationalSummary.cadastros ?? 0,
      !measurementReady
        ? `${officialSignups} oficiais · ${signupAttributionQuality.pendingSessions} pagos pendentes · ${signupsWithoutEvidence} sem evidência`
        : financialSummary.custoCadastroCentavos === null
        ? `${officialSignups} com atribuição oficial`
        : `${officialSignups} oficiais · ${formatCampaignMoney(financialSummary.custoCadastroCentavos)} por cadastro atribuído`
    ],
    [
      "Negócios publicados",
      operationalSummary.negociosPublicados ?? 0,
      `${operationalSummary.taxaPublicacao ?? 0}% dos cadastros do período`
    ],
    [
      "Primeiros agendamentos",
      operationalSummary.primeirosAgendamentos ?? 0,
      `${operationalSummary.taxaPrimeiroAgendamento ?? 0}% dos cadastros do período`
    ],
    [
      "Assinaturas ativadas",
      operationalSummary.assinaturasAtivadas ?? 0,
      !measurementReady
        ? "total operacional; CAC atribuído bloqueado"
        : financialSummary.cacAssinanteCentavos === null
        ? `${officialSubscriptions} assinaturas na coorte oficial`
        : `${officialSubscriptions} oficiais · CAC ${formatCampaignMoney(financialSummary.cacAssinanteCentavos)}`
    ],
    [
      "Investimento",
      formatCampaignMoney(financialSummary.investimentoCentavos ?? 0),
      "gasto atribuído a campanhas oficiais no período"
    ],
    [
      "Receita atribuída",
      formatCampaignMoney(financialSummary.receitaPrimeiroPagamentoCentavos ?? 0),
      measurementReady
        ? "primeiro pagamento da aquisição atribuída"
        : "valor parcial; não usar para decisão"
    ],
    [
      "ROAS de aquisição",
      measurementReady
        ? formatCampaignRoas(financialSummary.roas)
        : "Aguardando cobertura",
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
      formattedValue: formatCampaignRoas(item.roas),
      secondary: `${campaignSourceMeta(item).label} · CAC ${formatCampaignMoney(item.cacAssinanteCentavos)}`
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
            Acompanhe o funil operacional completo e, separadamente, o retorno atribuído. CAC e ROAS só orientam orçamento quando a mensuração está completa.
          </p>
        </div>

        <div className="segmented-control" aria-label="Período do funil profissional">
          {ADMIN_PERIODS.map(([value, label]) => (
            <button
              aria-pressed={period === value}
              className={period === value ? "active" : ""}
              disabled={refreshing}
              key={value}
              onClick={() => selectPeriod(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {refreshing && data && (
        <p className="data-refresh-status" role="status">
          {periodPending
            ? `Mostrando os últimos dados de ${loadedPeriodLabel} enquanto ${requestedPeriodLabel} é atualizado…`
            : "Atualizando aquisição e retorno sem ocultar os últimos dados…"}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}{periodPending
            ? ` Os dados abaixo ainda correspondem a ${loadedPeriodLabel}.`
            : " Os últimos dados carregados continuam visíveis."}
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
          : investment > 0 && officialSignups === 0
          ? "não aumente o orçamento ainda. Valide a landing page, o formulário de cadastro, o evento de conversão e a preservação do identificador de clique."
          : officialFirstAppointments === 0 && officialSignups > 0
            ? "identifique o primeiro marco com maior perda antes de alterar segmentação ou orçamento."
            : officialSubscriptions === 0 && officialSignups > 0
              ? "revise a proposta do plano pago sem tratar o uso gratuito como falha de aquisição."
            : "compare CAC e ROAS com a régua de decisão antes de escalar."}
        metrics={[
          {
            label: measurementReady
              ? "Custo por cadastro atribuído"
              : "Investimento por cadastro total",
            value: measurementReady
              ? formatCampaignMoney(financialSummary.custoCadastroCentavos)
              : formatCampaignMoney(grossInvestmentPerSignup),
            hint: measurementReady
              ? (officialSignups > 0
                ? `${officialSignups} cadastros oficiais`
                : "não calculável sem cadastro atribuído")
              : grossInvestmentPerSignup !== null
                ? "investimento oficial ÷ todos os cadastros; diagnóstico bruto, não CPA atribuído"
                : "sem base para o diagnóstico bruto"
          },
          {
            label: "CAC assinante",
            value: measurementReady
              ? formatCampaignMoney(financialSummary.cacAssinanteCentavos)
              : "Aguardando cobertura",
            hint: measurementReady
              ? (officialSubscriptions > 0
                ? `${officialSubscriptions} assinaturas ativadas na coorte oficial`
                : "não calculável sem assinatura atribuída")
              : "não use o valor parcial para decisão"
          },
          {
            label: "ROAS",
            value: measurementReady
              ? formatCampaignRoas(financialSummary.roas)
              : "Aguardando cobertura",
            hint: measurementReady
              ? `meta ${formatCampaignRoas(decision.metaRoas)}`
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
          ? `O período tem ${signups} cadastro(s) profissional(is), dos quais ${officialSignups} têm atribuição oficial. ${signupAttributionQuality.pendingSessions} cadastro(s) pago(s) aguardam vínculo e ${signupsWithoutEvidence} não têm evidência suficiente de origem. CAC, ROAS e decisões de orçamento permanecem bloqueados.`
          : investment <= 0
          ? "Não há investimento profissional registrado no período selecionado."
          : officialSignups === 0
            ? `${formatCampaignMoney(investment)} foram investidos, mas nenhum cadastro profissional oficial foi atribuído. CAC não é zero: ele ainda não pode ser calculado.`
            : officialFirstAppointments === 0
              ? `A coorte oficial gerou ${officialSignups} cadastros, mas nenhum primeiro agendamento. O gargalo está na ativação do valor gratuito.`
              : officialSubscriptions === 0
                ? `A coorte oficial já recebeu ${officialFirstAppointments} primeiro(s) agendamento(s), mas ainda não ativou assinatura paga. Revise monetização sem pausar mídia apenas por esse motivo.`
              : `A coorte oficial gerou ${officialSubscriptions} assinaturas e ROAS de ${formatCampaignRoas(financialSummary.roas)} no primeiro pagamento.`}
        title="Diagnóstico de aquisição profissional"
        tone={profitabilityTone}
      />

      <section className="admin-attribution-overview" aria-label="Qualidade da atribuição dos cadastros">
        <div>
          <span>Oficiais</span>
          <strong>{attributionDiagnostic.cadastrosOficiais ?? officialSignups}</strong>
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
              ? `ROAS a partir de ${formatCampaignRoas(decision.faixaEscalaRoas)}`
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
            Meta de ROAS {formatCampaignRoas(decision.metaRoas)} · escala em {formatCampaignRoas(decision.faixaEscalaRoas)} · sinal operacional, não confiança estatística
          </small>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Ativação</p>
            <h2>Marcos alcançados no período</h2>
            <p className="muted">
              Cada marco é medido de forma independente para todos os profissionais cadastrados no período selecionado. A atribuição de mídia é analisada separadamente.
            </p>
          </div>
        </div>

        <div className="admin-insights-grid">
          <MarketingBarChart
            title="Atingimento por marco"
            description="Percentual de todos os cadastros profissionais do período que já alcançou cada marco."
            items={stageChartItems}
            emptyMessage="Ainda não há profissionais cadastrados neste período."
            variant="none"
          />

          <div className="admin-stat-table-card">
            <div className="admin-stat-table-heading">
              <strong>Detalhamento do funil</strong>
              <small>Quantidade e participação sobre todos os cadastros profissionais do período.</small>
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

      <ProfessionalPostAgendaFunnel summary={summary} />
      <ProfessionalRecurrencePanel period={loadedPeriod} />

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Retorno</p>
            <h2>Retorno e decisão por campanha</h2>
            <p className="muted">
              Compare investimento, receita atribuída, ROAS e CAC somente na coorte com atribuição oficial. Estes indicadores não representam lucro: custos operacionais, impostos e margem não entram no cálculo. A receita considera somente o primeiro pagamento da aquisição; reembolso zera a receita e renovações posteriores não entram no ROAS.
            </p>
            <p className="muted">As recomendações são analíticas e não alteram campanhas automaticamente.</p>
            <p className="muted admin-campaign-attribution-note">
              Identidades UTM históricas equivalentes são consolidadas na campanha canônica para unir investimento e conversões sem reescrever a evidência capturada. Os nomes originais continuam disponíveis nos detalhes para auditoria.
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

        <ProfessionalCampaignDecisionTable
          campaigns={campaigns}
          decision={decision}
          expandedCampaign={expandedCampaign}
          measurementReady={measurementReady}
          onToggle={setExpandedCampaign}
        />
      </section>
    </main>
  );
}
