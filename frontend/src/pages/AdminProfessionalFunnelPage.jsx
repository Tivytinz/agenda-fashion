import {
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
  return item?.campanha === "organico"
    ? "Orgânico / sem campanha"
    : item?.campanha || "Sem campanha";
}

export function AdminProfessionalFunnelPage() {
  const [period, setPeriod] =
    useState("30");
  const [data, setData] =
    useState(null);
  const [error, setError] =
    useState("");
  const [reloadKey, setReloadKey] =
    useState(0);
  const [refreshing, setRefreshing] =
    useState(true);

  useEffect(() => {
    const controller =
      new AbortController();
    let active = true;

    setError("");
    setRefreshing(true);

    apiRequest(
      `/admin/marketing/funil-profissionais?periodo=${period}`,
      { signal: controller.signal }
    )
      .then((result) => {
        if (active) {
          setData(result);
        }
      })
      .catch((requestError) => {
        if (
          active &&
          requestError.name !==
            "AbortError"
        ) {
          setError(
            requestError.message
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

  if (!data && !error) {
    return (
      <main className="workspace-page admin-workspace-page">
        <LoadingState>
          Carregando funil profissional...
        </LoadingState>
      </main>
    );
  }

  if (!data && error) {
    return (
      <main className="workspace-page admin-workspace-page">
        <ErrorState
          message={error}
          onRetry={() =>
            setReloadKey(
              (current) => current + 1
            )
          }
        />
      </main>
    );
  }

  const summary =
    data?.resumo || {};
  const campaigns =
    data?.campanhas || [];

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
      formatMoney(
        summary.investimentoCentavos ?? 0
      ),
      summary.custoCheckoutCentavos === null
        ? "sem custo por checkout calculável"
        : `${formatMoney(summary.custoCheckoutCentavos)} por checkout`
    ],
    [
      "Receita atribuída",
      formatMoney(
        summary.receitaPrimeiroPagamentoCentavos ?? 0
      ),
      "primeiro pagamento válido de cada aquisição"
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
    <main aria-busy={refreshing} className="workspace-page admin-workspace-page">
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">
            Administração do AF
          </p>
          <h1>Funil de profissionais</h1>
          <p>
            Acompanhe quais campanhas trazem profissionais que avançam até negócio publicado, checkout, assinatura e receita.
          </p>
        </div>

        <div
          className="segmented-control"
          aria-label="Período do funil profissional"
        >
          {PERIODS.map(
            ([value, label]) => (
              <button
                aria-pressed={
                  period === value
                }
                className={
                  period === value
                    ? "active"
                    : ""
                }
                key={value}
                onClick={() =>
                  setPeriod(value)
                }
                type="button"
              >
                {label}
              </button>
            )
          )}
        </div>
      </header>

      {refreshing && <p className="data-refresh-status" role="status">Atualizando funil...</p>}
      {error && <p className="form-error" role="alert">{error} Os últimos dados carregados continuam visíveis.</p>}

      <section
        className="metric-grid"
        aria-label="Indicadores do funil profissional"
      >
        {cards.map(
          ([label, value, hint]) => (
            <article
              className="metric-card"
              key={label}
            >
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{hint}</small>
            </article>
          )
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">
              Ativação
            </p>
            <h2>Progressão da coorte</h2>
            <p className="muted">
              O período define quando o profissional entrou na coorte. As etapas mostram o progresso que essas contas já alcançaram.
            </p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Etapa</th>
                <th>Profissionais</th>
                <th>% dos cadastros</th>
              </tr>
            </thead>
            <tbody>
              {stages.map(
                ([label, value, rate]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td>{value}</td>
                    <td>{rate}%</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">
              Aquisição
            </p>
            <h2>Retorno por campanha</h2>
            <p className="muted">
              Investimento é cruzado com a mesma identidade UTM usada no cadastro. Receita considera apenas o primeiro pagamento válido de cada negócio adquirido, sem somar renovações ao ROAS de aquisição.
            </p>
          </div>
        </div>

        {campaigns.length === 0 ? (
          <p className="muted">
            Ainda não há profissionais nesta coorte.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th>Origem</th>
                  <th>Investimento</th>
                  <th>Receita</th>
                  <th>ROAS</th>
                  <th>Cadastros</th>
                  <th>Checkouts</th>
                  <th>Assinaturas</th>
                  <th>Custo cadastro</th>
                  <th>Custo checkout</th>
                  <th>CAC</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(
                  (item) => (
                    <tr
                      key={`${item.origem}-${item.midia}-${item.campanha}`}
                    >
                      <td>
                        {campaignLabel(item)}
                      </td>
                      <td>
                        {item.origem}
                        <br />
                        <small className="muted">
                          {item.midia}
                        </small>
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
                        <strong>
                          {formatRoas(item.roas)}
                        </strong>
                      </td>
                      <td>{item.cadastros}</td>
                      <td>{item.checkoutsIniciados}</td>
                      <td>
                        <strong>
                          {item.assinaturasAtivadas}
                        </strong>
                        <br />
                        <small className="muted">
                          {item.taxaAssinatura}%
                        </small>
                      </td>
                      <td>
                        {formatMoney(
                          item.custoCadastroCentavos
                        )}
                      </td>
                      <td>
                        {formatMoney(
                          item.custoCheckoutCentavos
                        )}
                      </td>
                      <td>
                        {formatMoney(
                          item.cacAssinanteCentavos
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
