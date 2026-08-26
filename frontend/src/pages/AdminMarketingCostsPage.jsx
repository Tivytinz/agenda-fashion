import {
  useEffect,
  useMemo,
  useState
} from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { MarketingBarChart } from "../components/MarketingBarChart";
import { MarketingCostIntegrationsPanel } from "../components/MarketingCostIntegrationsPanel";
import { MarketingExecutivePanel } from "../components/MarketingExecutivePanel";
import {
  ErrorState,
  LoadingState
} from "../components/ScreenState";
import { settleRequestMap } from "../utils/asyncData";
import { countPaidSessionsWithoutCampaign } from "../utils/marketingAttribution";
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

const OBJECTIVE_LABELS = {
  profissional: "Profissional",
  cliente: "Cliente",
  indefinido: "Não classificado"
};

const CHANNEL_LABELS = {
  google: "Google Ads",
  meta: "Meta Ads",
  pinterest: "Pinterest",
  tiktok: "TikTok",
  outro: "Outro"
};

function localDateValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatMoney(value) {
  if (value === null || value === undefined) return "Sem dados";
  const cents = Number(value);
  if (!Number.isFinite(cents)) return "Sem dados";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(cents / 100);
}

function formatDate(value) {
  if (!value) return "Sem data";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function moneyToCents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

function objectiveLabel(value) {
  return OBJECTIVE_LABELS[value] || OBJECTIVE_LABELS.indefinido;
}

function channelLabel(value) {
  return CHANNEL_LABELS[value] || String(value || "Não identificado");
}

function pluralize(count, singular, plural) {
  return `${count} ${Number(count) === 1 ? singular : plural}`;
}

function campaignSessionsWithCost(item) {
  const sessions = Math.max(0, Number(item?.sessoes || 0));
  return Math.min(
    sessions,
    Math.max(
      0,
      Number(
        item?.sessoesComCusto ??
          (Number(item?.investimentoCentavos || 0) > 0 ? sessions : 0)
      ) || 0
    )
  );
}

function campaignCostCoverage(item) {
  return item?.coberturaCustos ?? metricPercentage(
    campaignSessionsWithCost(item),
    item?.sessoes
  );
}

function campaignConversionsWithCost(item) {
  const conversions = Math.max(
    0,
    Number(item?.agendamentosConcluidos || 0)
  );
  return Math.min(
    conversions,
    Math.max(
      0,
      Number(
        item?.agendamentosConcluidosComCusto ??
          (Number(item?.investimentoCentavos || 0) > 0 ? conversions : 0)
      ) || 0
    )
  );
}

export function AdminMarketingCostsPage() {
  const [period, setPeriod] = useState("30");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);
  const [form, setForm] = useState({
    campanhaId: "",
    dataGasto: localDateValue(),
    valor: "",
    observacao: ""
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");
  const [showArchivedCosts, setShowArchivedCosts] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setError("");
    setRefreshing(true);

    settleRequestMap({
      costs: apiRequest(`/admin/marketing/custos?periodo=${period}`, {
        signal: controller.signal
      }),
      expenses: apiRequest(`/admin/marketing/gastos?periodo=${period}`, {
        signal: controller.signal
      }),
      attribution: apiRequest(`/admin/marketing/campanhas?periodo=${period}`, {
        signal: controller.signal
      }),
      managedCampaigns: apiRequest("/admin/marketing/gestao-campanhas", {
        signal: controller.signal
      })
    })
      .then(({ values, errors }) => {
        if (!active) return;

        const criticalKeys = [
          "costs",
          "managedCampaigns"
        ];
        const criticalDataReady = criticalKeys.every(
          (key) => Object.prototype.hasOwnProperty.call(values, key)
        );

        if (!criticalDataReady) {
          const criticalError = errors.find(({ key }) =>
            criticalKeys.includes(key)
          );
          setError(
            criticalError?.error?.message ||
              "Não foi possível carregar os custos de marketing."
          );
          return;
        }

        setData((current) => ({
          costs: values.costs,
          expenses: values.expenses?.gastos || current?.expenses || [],
          attributionCampaigns:
            values.attribution?.campanhas || current?.attributionCampaigns || [],
          managedCampaigns:
            values.managedCampaigns?.campanhas || []
        }));

        setForm((current) => {
          const campanhasCarregadas =
            values.managedCampaigns?.campanhas;

          if (!Array.isArray(campanhasCarregadas)) {
            return current;
          }

          const elegiveis =
            campanhasCarregadas.filter(
              (item) =>
                item.ativo !== false &&
                ["profissional", "cliente"].includes(item.objetivo)
            );

          if (
            elegiveis.some(
              (item) => String(item.id) === current.campanhaId
            )
          ) {
            return current;
          }

          const firstActive = elegiveis[0];

          return {
            ...current,
            campanhaId: firstActive ? String(firstActive.id) : ""
          };
        });

        if (errors.some(({ error: itemError }) => itemError?.name !== "AbortError")) {
          setError("Parte dos custos de marketing está temporariamente indisponível.");
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

  function updateForm(field, value) {
    setFormError("");
    setMessage("");
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selectPeriod(value) {
    if (value === period) return;
    setData(null);
    setError("");
    setPeriod(value);
  }

  async function submitExpense(event) {
    event.preventDefault();
    if (saving) return;

    const cents = moneyToCents(form.valor);
    if (!cents) {
      setFormError("Informe um valor de investimento maior que zero.");
      return;
    }
    if (!form.campanhaId) {
      setFormError("Selecione uma campanha.");
      return;
    }

    setSaving(true);
    setFormError("");
    setMessage("");

    try {
      await apiRequest("/admin/marketing/gastos", {
        method: "POST",
        body: {
          campanhaId: Number(form.campanhaId),
          dataGasto: form.dataGasto,
          valorCentavos: cents,
          observacao: form.observacao
        }
      });

      setForm((current) => ({ ...current, valor: "", observacao: "" }));
      setMessage(
        "Investimento salvo. O lançamento manual será a fonte efetiva daquele dia até uma nova sincronização automática."
      );
      setReloadKey((current) => current + 1);
    } catch (requestError) {
      setFormError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const attributionCampaigns = data?.attributionCampaigns || [];
  const eligibleManagedCampaigns = useMemo(
    () =>
      (data?.managedCampaigns || []).filter(
        (item) =>
          item.ativo !== false &&
          ["profissional", "cliente"].includes(item.objetivo)
      ),
    [data?.managedCampaigns]
  );
  const paidWithoutCampaignSessions = useMemo(
    () => {
      const backendValue = data?.costs?.sessoesSemCampanha;

      return backendValue === null || backendValue === undefined
        ? countPaidSessionsWithoutCampaign(attributionCampaigns)
        : Number(backendValue || 0);
    },
    [attributionCampaigns, data?.costs?.sessoesSemCampanha]
  );

  if (!data && !error) {
    return (
      <main className="workspace-page admin-workspace-page admin-marketing-page admin-costs-page">
        <LoadingState>Carregando custos de marketing...</LoadingState>
      </main>
    );
  }

  if (!data && error) {
    return (
      <main className="workspace-page admin-workspace-page admin-marketing-page admin-costs-page">
        <ErrorState
          message={error}
          onRetry={() => setReloadKey((current) => current + 1)}
        />
      </main>
    );
  }

  const costs = data.costs || {};
  const campaignCosts = costs.campanhas || [];
  const archivedCampaignCosts = campaignCosts.filter(
    (item) => item.ativo === false
  );
  const archivedCampaignCostsWithoutActivity = archivedCampaignCosts.filter(
    (item) =>
      Number(item.investimentoCentavos || 0) === 0 &&
      Number(item.sessoes || 0) === 0
  );
  const reportedCampaignCosts = campaignCosts.filter(
    (item) =>
      item.ativo !== false ||
      Number(item.investimentoCentavos || 0) > 0 ||
      Number(item.sessoes || 0) > 0
  );
  const visibleCampaignCosts = showArchivedCosts
    ? campaignCosts
    : reportedCampaignCosts;
  const unofficialAttributionSessions = Number(
    costs.sessoesIdentidadeNaoOficial || 0
  );
  const attributionQuality = paidAttributionQuality({
    official: costs.sessoesOficiais ?? costs.sessoes,
    missingCampaign: paidWithoutCampaignSessions,
    unofficialIdentity: unofficialAttributionSessions
  });
  const costCoveredSessions = Math.min(
    attributionQuality.officialSessions,
    Math.max(
      0,
      Number(
        costs.sessoesComCusto ??
          attributionQuality.officialSessions
      ) || 0
    )
  );
  const officialSessionsWithoutCost = Math.max(
    0,
    Number(
      costs.sessoesOficiaisSemCusto ??
        attributionQuality.officialSessions - costCoveredSessions
    ) || 0
  );
  const costCoverage = costs.coberturaCustos ?? metricPercentage(
    costCoveredSessions,
    attributionQuality.officialSessions
  );
  const clientConversionsWithCost = Math.max(
    0,
    Number(
      costs.agendamentosClientesComCusto ??
        costs.agendamentosConcluidos
    ) || 0
  );
  const professionalInvestment = costs.investimentoProfissionaisCentavos ??
    campaignCosts
      .filter((item) => item.objetivo === "profissional")
      .reduce(
        (total, item) => total + Number(item.investimentoCentavos || 0),
        0
      );
  const clientInvestment = costs.investimentoClientesCentavos ??
    campaignCosts
      .filter((item) => item.objetivo === "cliente")
      .reduce(
        (total, item) => total + Number(item.investimentoCentavos || 0),
        0
      );
  const campaignsWithInvestment = costs.campanhasComInvestimento ??
    campaignCosts.filter(
      (item) => Number(item.investimentoCentavos || 0) > 0
    ).length;
  const hasInvestment = Number(costs.investimentoCentavos || 0) > 0;
  const hasAttributionGap = attributionQuality.pendingSessions > 0;
  const hasCostGap = hasInvestment && (
    costCoverage === null ||
    Number(costCoverage) < 100
  );
  const criticalAttribution = attributionQuality.detectedPaidSessions > 0 && (
    attributionQuality.coverage === null ||
    Number(attributionQuality.coverage) < 80
  );
  const criticalCostCoverage = hasInvestment && (
    costCoverage === null ||
    Number(costCoverage) < 80
  );
  const warningAttribution = attributionQuality.detectedPaidSessions > 0 &&
    Number(attributionQuality.coverage) < 95;
  const warningCostCoverage = hasInvestment &&
    costCoverage !== null &&
    Number(costCoverage) < 95;
  const efficiencyTone = !hasInvestment
    ? "neutral"
    : criticalAttribution || criticalCostCoverage
      ? "critical"
      : warningAttribution || warningCostCoverage
        ? "warning"
        : "success";
  const efficiencyStatus = !hasInvestment
    ? "Sem investimento"
    : costCoverage === null || Number(costCoverage) < 80
      ? "Custos incompletos"
      : attributionQuality.coverage === null || Number(attributionQuality.coverage) < 80
        ? "Custo subatribuído"
        : warningAttribution || warningCostCoverage
          ? "Eficiência em atenção"
          : "Medição confiável";
  const cards = [
    ["Investimento total", formatMoney(costs.investimentoCentavos), "gasto registrado no período"],
    [
      "Sessões oficiais",
      attributionQuality.officialSessions,
      "vinculadas a campanhas do AF"
    ],
    [
      "Custo por sessão coberta",
      formatMoney(costs.custoPorSessaoCentavos),
      costCoveredSessions > 0
        ? `${formatMoney(costs.investimentoCentavos)} ÷ ${costCoveredSessions} sessões com custo`
        : "não calculável sem sessão coberta por custo"
    ],
    [
      "Cobertura do tráfego pago",
      formatMetricPercent(attributionQuality.coverage),
      `${attributionQuality.pendingSessions} sessões fora dos KPIs`
    ],
    [
      "Cobertura dos custos",
      formatMetricPercent(costCoverage),
      attributionQuality.officialSessions > 0
        ? `${costCoveredSessions} de ${attributionQuality.officialSessions} sessões oficiais`
        : "sem sessão oficial no período"
    ],
    [
      "CPA cliente",
      formatMoney(costs.cpaCentavos),
      Number(clientInvestment || 0) > 0
        ? clientConversionsWithCost > 0
          ? `${formatMoney(clientInvestment)} ÷ ${clientConversionsWithCost} agendamentos com custo`
          : "não calculável sem agendamento coberto por custo"
        : "sem investimento em campanhas de clientes"
    ]
  ];

  const investmentChartItems = [...reportedCampaignCosts]
    .sort((a, b) => Number(b.investimentoCentavos || 0) - Number(a.investimentoCentavos || 0))
    .slice(0, 8)
    .map((item) => ({
      key: item.campanhaId,
      label: item.nome,
      value: Number(item.investimentoCentavos || 0),
      formattedValue: formatMoney(item.investimentoCentavos),
      secondary: `${channelLabel(item.canal)} · ${objectiveLabel(item.objetivo)}`
    }));

  return (
    <main
      aria-busy={refreshing}
      className="workspace-page admin-workspace-page admin-marketing-page admin-costs-page"
    >
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">Administração do AF</p>
          <h1>Investimento e eficiência</h1>
          <p>
            Acompanhe investimento, custo por sessão e CPA. Campanhas profissionais seguem para CAC e ROAS em Rentabilidade.
          </p>
        </div>

        <div className="segmented-control" aria-label="Período dos custos">
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

      {refreshing && <p className="data-refresh-status" role="status">Atualizando custos...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      <section className="metric-grid" aria-label="Indicadores de custo de marketing">
        {cards.map(([label, value, hint]) => (
          <article className="metric-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
          </article>
        ))}
      </section>

      <MarketingExecutivePanel
        action={hasAttributionGap && hasCostGap
          ? "corrija as UTMs pendentes e sincronize os custos das campanhas com tráfego antes de comparar eficiência ou aumentar orçamento."
          : hasAttributionGap
            ? "corrija as UTMs ausentes e cadastre as identidades não oficiais; até lá, custos por campanha usam uma base incompleta."
            : hasCostGap
              ? "sincronize os custos das campanhas com tráfego; sessões sem custo ficam fora de CPS e CPA para não reduzir artificialmente os indicadores."
              : "compare CPA de clientes e CAC de profissionais antes de redistribuir orçamento."}
        metrics={[
          {
            label: "Aquisição profissional",
            value: formatMoney(professionalInvestment),
            hint: "investimento por objetivo"
          },
          {
            label: "Aquisição de clientes",
            value: formatMoney(clientInvestment),
            hint: "investimento por objetivo"
          },
          {
            label: "Tráfego pago detectado",
            value: attributionQuality.detectedPaidSessions,
            hint: "inclui pendências"
          },
          {
            label: "Campanhas com investimento",
            value: campaignsWithInvestment,
            hint: pluralize(campaignCosts.length, "campanha cadastrada", "campanhas cadastradas")
          }
        ]}
        status={efficiencyStatus}
        summary={Number(costs.investimentoCentavos || 0) <= 0
          ? "Não há investimento registrado no período selecionado."
          : hasCostGap
            ? costCoverage === null
              ? "Há investimento registrado, mas nenhuma sessão oficial possui custo sincronizado. CPS e CPA permanecem sem cálculo para evitar números artificialmente baixos."
              : `${formatMetricPercent(costCoverage)} das sessões oficiais possuem custo sincronizado. CPS e CPA usam somente essa base coberta para não parecerem melhores do que realmente são.`
            : hasAttributionGap
              ? `${formatMetricPercent(attributionQuality.coverage)} do tráfego pago detectado entra nos custos por campanha. A eficiência real pode estar melhor ou pior do que o valor exibido.`
              : "Todo o tráfego pago detectado está atribuído a campanhas oficiais; os custos podem ser comparados com segurança dentro deste período."}
        title="Eficiência e confiabilidade dos custos"
        tone={efficiencyTone}
      />

      {hasCostGap && (
        <section className="admin-notice-panel" aria-label="Diagnóstico de cobertura dos custos">
          <div>
            <p className="eyebrow">Custos incompletos</p>
            <strong>
              {officialSessionsWithoutCost > 0
                ? pluralize(
                    officialSessionsWithoutCost,
                    "sessão oficial está sem custo",
                    "sessões oficiais estão sem custo"
                  )
                : "Nenhuma sessão oficial está coberta por custo"}
            </strong>
          </div>
          <div className="admin-notice-action">
            <p className="muted">
              Essas sessões não entram no denominador de CPS ou CPA. Assim, o painel não reduz artificialmente os custos enquanto a sincronização estiver incompleta.
            </p>
            <a className="button button-secondary button-small" href="#integracoes-custos">
              Revisar sincronização
            </a>
          </div>
        </section>
      )}

      {attributionQuality.pendingSessions > 0 && (
        <section className="admin-notice-panel" aria-label="Diagnóstico de atribuição de custos">
          <div>
            <p className="eyebrow">Atribuição pendente</p>
            <strong>
              {pluralize(attributionQuality.pendingSessions, "sessão paga fora dos KPIs", "sessões pagas fora dos KPIs")}
            </strong>
          </div>
          <div className="admin-notice-action">
            <p className="muted">
              {paidWithoutCampaignSessions > 0 && (
                <>
                  {pluralize(paidWithoutCampaignSessions, "sessão está sem campanha", "sessões estão sem campanha")}.
                  {" "}
                </>
              )}
              {unofficialAttributionSessions > 0 && (
                <>
                  {pluralize(unofficialAttributionSessions, "sessão usa identidade não oficial", "sessões usam identidade não oficial")}.
                  {" "}
                </>
              )}
              Elas aparecem no tráfego geral, porém não entram no custo de uma campanha cadastrada.
            </p>
            <Link className="button button-secondary button-small" to="/admin/trafego-pago">
              Corrigir rastreamento
            </Link>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Estatísticas</p>
            <h2>Distribuição do investimento</h2>
            <p className="muted">Compare rapidamente onde o orçamento do período está concentrado.</p>
          </div>
        </div>
        <MarketingBarChart
          title="Investimento por campanha"
          description="Até 8 campanhas, ordenadas pelo maior investimento."
          items={investmentChartItems}
          emptyMessage="Nenhum investimento foi registrado no período selecionado."
        />
      </section>

      <MarketingCostIntegrationsPanel
        onChanged={() => setReloadKey((current) => current + 1)}
      />

      <section className="panel admin-manual-cost-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Lançamento manual</p>
            <h2>Correção pontual de investimento</h2>
            <p className="muted">
              Use apenas como fallback ou correção quando a sincronização automática não estiver disponível.
            </p>
          </div>
          <button
            aria-expanded={manualOpen}
            className="button button-secondary button-small admin-nowrap-button"
            disabled={eligibleManagedCampaigns.length === 0}
            onClick={() => setManualOpen((current) => !current)}
            type="button"
          >
            {manualOpen ? "Fechar lançamento" : "+ Registrar manualmente"}
          </button>
        </div>

        {eligibleManagedCampaigns.length === 0 ? (
          <p className="muted">
            Crie e classifique uma campanha ativa antes de registrar investimento.
          </p>
        ) : manualOpen ? (
          <form className="stack-form" onSubmit={submitExpense}>
            <div className="form-grid">
              <label>
                Campanha
                <select
                  onChange={(event) => updateForm("campanhaId", event.target.value)}
                  required
                  value={form.campanhaId}
                >
                  {eligibleManagedCampaigns.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome} · {objectiveLabel(item.objetivo)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Data do gasto
                <input
                  max={localDateValue()}
                  onChange={(event) => updateForm("dataGasto", event.target.value)}
                  required
                  type="date"
                  value={form.dataGasto}
                />
              </label>

              <label>
                Investimento (R$)
                <input
                  min="0.01"
                  onChange={(event) => updateForm("valor", event.target.value)}
                  placeholder="Ex.: 150.00"
                  required
                  step="0.01"
                  type="number"
                  value={form.valor}
                />
              </label>

              <label>
                Observação
                <input
                  maxLength="240"
                  onChange={(event) => updateForm("observacao", event.target.value)}
                  placeholder="Opcional"
                  value={form.observacao}
                />
              </label>
            </div>

            {formError && <p className="form-error" role="alert">{formError}</p>}
            {message && <p className="form-success">{message}</p>}

            <div className="form-actions">
              <button className="button" disabled={saving} type="submit">
                {saving ? "Salvando..." : "Salvar investimento"}
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Eficiência</p>
            <h2>Custo por campanha</h2>
            <p className="muted">
              CPA é exibido para campanhas de clientes. Campanhas profissionais usam CAC e ROAS na tela de Rentabilidade.
            </p>
          </div>
          {archivedCampaignCostsWithoutActivity.length > 0 && (
            <button
              aria-pressed={showArchivedCosts}
              className="button button-secondary button-small admin-nowrap-button"
              onClick={() => setShowArchivedCosts((current) => !current)}
              type="button"
            >
              {showArchivedCosts
                ? "Ocultar arquivadas"
                : `Mostrar arquivadas (${archivedCampaignCostsWithoutActivity.length})`}
            </button>
          )}
        </div>

        {!visibleCampaignCosts.length ? (
          <p className="muted">
            {campaignCosts.length === 0
              ? "Ainda não há campanhas cadastradas."
              : "Nenhuma campanha ativa. Mostre as arquivadas para revisar o histórico."}
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th>Objetivo</th>
                  <th>Canal</th>
                  <th>Investimento</th>
                  <th>Sessões</th>
                  <th>Cobertura custos</th>
                  <th>Custo/sessão</th>
                  <th>Agendamentos</th>
                  <th>CPA cliente</th>
                </tr>
              </thead>
              <tbody>
                {visibleCampaignCosts.map((item) => (
                  <tr key={item.campanhaId}>
                    <td>
                      <strong>{item.nome}</strong>
                      {item.ativo === false && (
                        <small className="admin-table-secondary">Arquivada</small>
                      )}
                    </td>
                    <td>
                      <span className={`admin-status-badge ${item.objetivo === "indefinido" ? "is-warning" : ""}`}>
                        {objectiveLabel(item.objetivo)}
                      </span>
                    </td>
                    <td>{channelLabel(item.canal)}</td>
                    <td>{formatMoney(item.investimentoCentavos)}</td>
                    <td>{item.sessoes}</td>
                    <td>
                      <strong>{formatMetricPercent(campaignCostCoverage(item))}</strong>
                      <small className="admin-table-secondary">
                        {campaignSessionsWithCost(item)} com custo
                      </small>
                    </td>
                    <td>{formatMoney(item.custoPorSessaoCentavos)}</td>
                    <td>
                      {item.objetivo === "cliente" ? (
                        <>
                          {item.agendamentosConcluidos}
                          <small className="admin-table-secondary">
                            {campaignConversionsWithCost(item)} com custo
                          </small>
                        </>
                      ) : "Não se aplica"}
                    </td>
                    <td>{item.objetivo === "cliente" ? formatMoney(item.cpaCentavos) : "Não se aplica"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Histórico</p>
            <h2>Investimentos registrados</h2>
          </div>
        </div>

        {data.expenses.length === 0 ? (
          <p className="muted">Nenhum investimento registrado neste período.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Campanha</th>
                  <th>Objetivo</th>
                  <th>Canal</th>
                  <th>Fonte</th>
                  <th>Valor</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {data.expenses.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.dataGasto)}</td>
                    <td>{item.campanhaNome || "Campanha indisponível"}</td>
                    <td>{objectiveLabel(item.objetivo)}</td>
                    <td>{channelLabel(item.canal)}</td>
                    <td>{item.fonte || "manual"}</td>
                    <td>{formatMoney(item.valorCentavos)}</td>
                    <td>{item.observacao || "Sem observação"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
