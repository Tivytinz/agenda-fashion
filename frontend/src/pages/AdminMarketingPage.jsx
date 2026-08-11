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

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      dateStyle: "short",
      timeStyle: "short"
    }
  ).format(date);
}

function campaignLabel(item) {
  const campaign =
    item?.campanha ||
    "(sem campanha)";

  return campaign === "(sem campanha)"
    ? "Sem nome de campanha"
    : campaign;
}

export function AdminMarketingPage() {
  const [period, setPeriod] =
    useState("30");

  const [data, setData] =
    useState(null);

  const [error, setError] =
    useState("");

  const [reloadKey, setReloadKey] =
    useState(0);

  useEffect(() => {
    const controller =
      new AbortController();

    let active = true;

    setData(null);
    setError("");

    Promise.all([
      apiRequest(
        `/admin/marketing/resumo?periodo=${period}`,
        { signal: controller.signal }
      ),
      apiRequest(
        `/admin/marketing/campanhas?periodo=${period}`,
        { signal: controller.signal }
      ),
      apiRequest(
        `/admin/marketing/conversoes?periodo=${period}`,
        { signal: controller.signal }
      )
    ])
      .then(([
        summary,
        campaigns,
        conversions
      ]) => {
        if (!active) return;

        setData({
          summary,
          campaigns:
            campaigns.campanhas || [],
          conversions:
            conversions.conversoes || []
        });
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
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [period, reloadKey]);

  function selectPeriod(value) {
    if (value === period) return;
    setPeriod(value);
  }

  if (!data && !error) {
    return (
      <main className="container page-content">
        <LoadingState>
          Carregando marketing...
        </LoadingState>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container page-content">
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
    data.summary || {};

  const cards = [
    [
      "Sessões atribuídas",
      summary.sessoes ?? 0,
      "visitas com origem identificada"
    ],
    [
      "Campanhas",
      summary.campanhas ?? 0,
      "origem + mídia + campanha"
    ],
    [
      "Agendamentos iniciados",
      summary.agendamentosIniciados ?? 0,
      "entraram no fluxo"
    ],
    [
      "Agendamentos concluídos",
      summary.agendamentosConcluidos ?? 0,
      `${summary.taxaConversao ?? 0}% das sessões`
    ]
  ];

  return (
    <main className="container page-content">
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">
            Administração do AF
          </p>
          <h1>Marketing e tráfego pago</h1>
          <p>
            Acompanhe de onde chegam as sessões e quais campanhas terminam em agendamento.
          </p>
        </div>

        <div
          className="segmented-control"
          aria-label="Período do marketing"
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
                  selectPeriod(value)
                }
                type="button"
              >
                {label}
              </button>
            )
          )}
        </div>
      </header>

      <section
        className="metric-grid"
        aria-label="Indicadores de marketing"
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
              Aquisição
            </p>
            <h2>Desempenho por campanha</h2>
          </div>
        </div>

        {data.campaigns.length === 0 ? (
          <p className="muted">
            Ainda não há sessões atribuídas neste período.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th>Origem</th>
                  <th>Mídia</th>
                  <th>Sessões</th>
                  <th>Perfis</th>
                  <th>Iniciados</th>
                  <th>Concluídos</th>
                  <th>Conversão</th>
                </tr>
              </thead>
              <tbody>
                {data.campaigns.map(
                  (item, index) => (
                    <tr
                      key={`${item.origem}-${item.midia}-${item.campanha}-${index}`}
                    >
                      <td>
                        {campaignLabel(item)}
                      </td>
                      <td>{item.origem}</td>
                      <td>{item.midia}</td>
                      <td>{item.sessoes}</td>
                      <td>
                        {item.perfisVisualizados}
                      </td>
                      <td>
                        {item.agendamentosIniciados}
                      </td>
                      <td>
                        {item.agendamentosConcluidos}
                      </td>
                      <td>
                        {item.taxaConversao}%
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">
              Conversões
            </p>
            <h2>Agendamentos atribuídos</h2>
          </div>
        </div>

        {data.conversions.length === 0 ? (
          <p className="muted">
            Nenhum agendamento atribuído neste período.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Campanha</th>
                  <th>Negócio</th>
                  <th>Agendamento</th>
                  <th>Landing page</th>
                </tr>
              </thead>
              <tbody>
                {data.conversions.map(
                  (item) => (
                    <tr key={item.eventoId}>
                      <td>
                        {formatDateTime(
                          item.createdAt
                        )}
                      </td>
                      <td>
                        {campaignLabel(item)}
                      </td>
                      <td>
                        {item.negocioNome ||
                          "Negócio indisponível"}
                      </td>
                      <td>
                        {item.agendamentoId
                          ? `#${item.agendamentoId}`
                          : "—"}
                      </td>
                      <td>
                        {item.landingPage || "—"}
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
