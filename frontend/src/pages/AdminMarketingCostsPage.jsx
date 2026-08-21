import {
  useEffect,
  useMemo,
  useState
} from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { MarketingBarChart } from "../components/MarketingBarChart";
import { MarketingCostIntegrationsPanel } from "../components/MarketingCostIntegrationsPanel";
import {
  ErrorState,
  LoadingState
} from "../components/ScreenState";
import { settleRequestMap } from "../utils/asyncData";
import { countPaidSessionsWithoutCampaign } from "../utils/marketingAttribution";

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

        if (Object.keys(values).length === 0) {
          setError(
            errors[0]?.error?.message ||
              "Não foi possível carregar os custos de marketing."
          );
          return;
        }

        setData((current) => ({
          costs: values.costs || current?.costs || {},
          expenses: values.expenses?.gastos || current?.expenses || [],
          attributionCampaigns:
            values.attribution?.campanhas || current?.attributionCampaigns || [],
          managedCampaigns:
            values.managedCampaigns?.campanhas ||
            current?.managedCampaigns ||
            []
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
    () => countPaidSessionsWithoutCampaign(attributionCampaigns),
    [attributionCampaigns]
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
  const activeCampaignCosts = campaignCosts.filter(
    (item) => item.ativo !== false
  );
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
  const hasClientCampaigns = campaignCosts.some(
    (item) =>
      item.objetivo === "cliente" &&
      Number(item.investimentoCentavos || 0) > 0
  );
  const cards = hasClientCampaigns ? [
    ["Investimento", formatMoney(costs.investimentoCentavos), "gasto total no período"],
    [
      "Custo por sessão",
      formatMoney(costs.custoPorSessaoCentavos),
      pluralize(costs.sessoes ?? 0, "sessão vinculada", "sessões vinculadas")
    ],
    [
      "Agendamentos de clientes",
      costs.agendamentosConcluidos ?? 0,
      "somente campanhas de clientes"
    ],
    [
      "CPA cliente",
      formatMoney(costs.cpaCentavos),
      `${formatMoney(costs.investimentoClientesCentavos)} em campanhas de clientes`
    ]
  ] : [
    ["Investimento", formatMoney(costs.investimentoCentavos), "gasto total no período"],
    [
      "Custo por sessão",
      formatMoney(costs.custoPorSessaoCentavos),
      pluralize(costs.sessoes ?? 0, "sessão vinculada", "sessões vinculadas")
    ],
    [
      "Sessões sem campanha",
      paidWithoutCampaignSessions,
      paidWithoutCampaignSessions > 0
        ? "precisam de correção UTM"
        : "atribuição de campanha completa"
    ],
    [
      "Campanhas com investimento",
      activeCampaignCosts.filter((item) => Number(item.investimentoCentavos || 0) > 0).length,
      `${activeCampaignCosts.length} campanhas ativas`
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
              onClick={() => setPeriod(value)}
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

      {paidWithoutCampaignSessions > 0 && (
        <section className="admin-notice-panel" aria-label="Diagnóstico de atribuição de custos">
          <div>
            <p className="eyebrow">Atribuição pendente</p>
            <strong>
              {pluralize(
                paidWithoutCampaignSessions,
                "sessão paga ainda sem campanha",
                "sessões pagas ainda sem campanha"
              )}
            </strong>
          </div>
          <div className="admin-notice-action">
            <p className="muted">
              A origem paga foi reconhecida, mas a campanha UTM não chegou. Essas sessões aparecem no tráfego geral, porém não entram no custo de uma campanha cadastrada.
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
                    <td>{formatMoney(item.custoPorSessaoCentavos)}</td>
                    <td>{item.objetivo === "cliente" ? item.agendamentosConcluidos : "Não se aplica"}</td>
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
