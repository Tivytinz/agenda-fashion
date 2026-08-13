import {
  Fragment,
  useEffect,
  useState
} from "react";
import { apiRequest } from "../api/client";
import {
  ErrorState,
  LoadingState
} from "../components/ScreenState";

const PERIODS = [
  ["today", "Hoje"],
  ["7", "7 dias"],
  ["30", "30 dias"],
  ["month", "Este mês"],
  ["all", "Todo período"]
];

function formatMoney(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL"
    }
  ).format(Number(value) / 100);
}

function formatRoas(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  return `${new Intl.NumberFormat(
    "pt-BR",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  ).format(Number(value))}x`;
}

function campaignLabel(item) {
  const campaign = String(
    item?.campanha || ""
  ).trim();
  const source = String(
    item?.origem || ""
  ).trim().toLowerCase();
  const medium = String(
    item?.midia || ""
  ).trim().toLowerCase();

  if (
    !campaign ||
    campaign.toLowerCase() === "organico"
  ) {
    if (
      source === "organico" &&
      (!medium || medium === "none")
    ) {
      return "Orgânico / sem campanha";
    }

    return "Sem UTM de campanha";
  }

  return campaign;
}

function campaignKey(item) {
  return `${item.origem}-${item.midia}-${item.campanha}`;
}

function decisionBadgeClass(code) {
  const safeCode = String(
    code || "sem_dados"
  ).replace(/[^a-z_]/g, "");

  return `admin-status-badge admin-decision-badge is-${safeCode}`;
}

function sourceMeta(item) {
  const source = String(item?.origem || "").trim().toLowerCase();

  if (source === "google") return { code: "google", label: "Google Ads" };
  if (["meta", "facebook", "instagram"].includes(source)) {
    return { code: "meta", label: "Meta Ads" };
  }
  if (source === "pinterest") return { code: "pinterest", label: "Pinterest" };
  if (source === "tiktok") return { code: "tiktok", label: "TikTok" };
  if (source === "organico") return { code: "organico", label: "Orgânico" };

  return {
    code: "outro",
    label: source ? source.charAt(0).toUpperCase() + source.slice(1) : "Origem não identificada"
  };
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

    apiRequest(
      `/admin/marketing/funil-profissionais?periodo=${period}`,
      { signal: controller.signal }
    )
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

  if (!data && !error) {
    return (
      <main className="workspace-page admin-workspace-page admin-marketing-page admin-professional-funnel-page">
        <LoadingState>
          Carregando rentabilidade profissional...
        </LoadingState>
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

  const summary = data?.resumo || {};
  const decision = data?.decisao || {};
  const decisionCounts = decision?.contagem || {};
  const campaigns = data?.campanhas || [];

  const cards = [
    [
      "Cadastros profissionais",
      summary.cadastros ?? 0,
      summary.custoCadastroCentavos === null
        ? "coorte adquirida no período"
        : `${formatMoney(summary.custoCadastroCentavos)} por cadastro`
    ],
    [
      "Negócios publicados",
      summary.negociosPublicados ?? 0,
      `${summary.taxaPublicacao ?? 0}% dos cadastros`
    ],
    [
      "Assinaturas ativadas",
      summary.assinaturasAtivadas ?? 0,
      summary.cacAssinanteCentavos === null
        ? `${summary.taxaAssinatura ?? 0}% dos cadastros`
        : `CAC ${formatMoney(summary.cacAssinanteCentavos)}`
    ],
    [
      "Investimento",
      formatMoney(summary.investimentoCentavos ?? 0),
      summary.custoCheckoutCentavos === null
        ? "sem custo por checkout calculável"
        : `${formatMoney(summary.custoCheckoutCentavos)} por checkout`
    ],
    [
      "Receita atribuída",
      formatMoney(summary.receitaPrimeiroPagamentoCentavos ?? 0),
      "primeiro pagamento da aquisição; reembolso zera a receita"
    ],
    [
      "ROAS de aquisição",
      formatRoas(summary.roas),
      "receita atribuída ÷ investimento"
    ]
  ];

  const stages = [
    ["Cadastro", summary.cadastros ?? 0, 100],
    ["Negócio criado", summary.negociosCriados ?? 0, summary.taxaNegocio ?? 0],
    ["Serviço criado", summary.servicosCriados ?? 0, summary.cadastros ? Number(((summary.servicosCriados / summary.cadastros) * 100).toFixed(2)) : 0],
    ["Agenda configurada", summary.agendasConfiguradas ?? 0, summary.cadastros ? Number(((summary.agendasConfiguradas / summary.cadastros) * 100).toFixed(2)) : 0],
    ["Negócio publicado", summary.negociosPublicados ?? 0, summary.taxaPublicacao ?? 0],
    ["Checkout iniciado", summary.checkoutsIniciados ?? 0, summary.taxaCheckout ?? 0],
    ["Assinatura ativada", summary.assinaturasAtivadas ?? 0, summary.taxaAssinatura ?? 0]
  ];

  return (
    <main aria-busy={refreshing} className="workspace-page admin-workspace-page admin-marketing-page admin-professional-funnel-page">
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">Administração do AF</p>
          <h1>Rentabilidade de profissionais</h1>
          <p>
            Acompanhe o funil de aquisição, CAC, ROAS e quais campanhas merecem escala, revisão ou pausa.
          </p>
        </div>

        <div
          className="segmented-control"
          aria-label="Período do funil profissional"
        >
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

      {refreshing && <p className="data-refresh-status" role="status">Atualizando rentabilidade...</p>}
      {error && <p className="form-error" role="alert">{error} Os últimos dados carregados continuam visíveis.</p>}

      <section
        className="metric-grid"
        aria-label="Indicadores do funil profissional"
      >
        {cards.map(([label, value, hint]) => (
          <article className="metric-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
          </article>
        ))}
      </section>

      <section className="admin-decision-summary" aria-label="Resumo das recomendações de campanha">
        <div>
          <span>Para escalar</span>
          <strong>{decisionCounts.escalar ?? 0}</strong>
          <small>
            {decision.faixaEscalaRoas
              ? `ROAS a partir de ${formatRoas(decision.faixaEscalaRoas)}`
              : "aguardando régua"}
          </small>
        </div>
        <div>
          <span>Para pausar</span>
          <strong>{decisionCounts.pausar ?? 0}</strong>
          <small>somente com amostra mínima atingida</small>
        </div>
        <div className="admin-decision-rule">
          <span>Régua de decisão</span>
          <strong>
            {decision.minimoCadastros ?? "—"} cadastros · {decision.minimoAssinaturas ?? "—"} assinaturas
          </strong>
          <small>
            meta de ROAS {formatRoas(decision.metaRoas)} · escala em {formatRoas(decision.faixaEscalaRoas)}
          </small>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Ativação</p>
            <h2>Marcos alcançados pela coorte</h2>
            <p className="muted">
              O período define quando o profissional entrou na coorte. Cada marco é medido independentemente e não representa uma sequência obrigatória.
            </p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
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
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Aquisição</p>
            <h2>Retorno e decisão por campanha</h2>
            <p className="muted">
              Compare retorno e CAC sem perder a leitura principal. Cadastros, checkouts e custos intermediários ficam disponíveis nos detalhes de cada campanha. A receita usa somente o primeiro pagamento da aquisição; se ele for reembolsado, a receita atribuída fica zerada e renovações posteriores não entram no ROAS de aquisição.
            </p>
            <p className="muted">
              A recomendação é somente analítica e não altera campanhas automaticamente.
            </p>
          </div>
        </div>

        {campaigns.length === 0 ? (
          <p className="muted">
            Ainda não há profissionais nesta coorte.
          </p>
        ) : (
          <div className="table-wrap">
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

                  return (
                    <Fragment key={key}>
                      <tr>
                        <td>
                          <strong>{campaignLabel(item)}</strong>
                          <div className="admin-campaign-source">
                            <span className={`admin-status-badge admin-source-badge is-${source.code}`}>
                              {source.label}
                            </span>
                            <small className="muted">{item.midia || "none"}</small>
                          </div>
                        </td>
                        <td>
                          {item.investimentoCentavos > 0
                            ? formatMoney(item.investimentoCentavos)
                            : "—"}
                        </td>
                        <td>
                          {item.receitaPrimeiroPagamentoCentavos > 0
                            ? formatMoney(item.receitaPrimeiroPagamentoCentavos)
                            : "—"}
                        </td>
                        <td>
                          <strong>{formatRoas(item.roas)}</strong>
                        </td>
                        <td>{formatMoney(item.cacAssinanteCentavos)}</td>
                        <td className="admin-decision-cell">
                          <span className={decisionBadgeClass(item.decisao?.codigo)}>
                            {item.decisao?.rotulo || "Sem dados"}
                          </span>
                          <small className="muted">
                            Confiança {item.decisao?.confianca || "—"}
                          </small>
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
                                <span>Assinaturas</span>
                                <strong>{item.assinaturasAtivadas} · {item.taxaAssinatura}%</strong>
                              </div>
                              <div>
                                <span>Custo por cadastro</span>
                                <strong>{formatMoney(item.custoCadastroCentavos)}</strong>
                              </div>
                              <div>
                                <span>Custo por checkout</span>
                                <strong>{formatMoney(item.custoCheckoutCentavos)}</strong>
                              </div>
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