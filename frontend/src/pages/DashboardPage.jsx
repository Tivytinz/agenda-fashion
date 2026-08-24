import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { ProfessionalOnboardingChecklist } from "../components/ProfessionalOnboardingChecklist";
import { ErrorState, LoadingState } from "../components/ScreenState";
import { formatCurrency } from "../utils/format";

const PERIODS = [
  ["hoje", "Hoje"],
  ["7dias", "7 dias"],
  ["30dias", "30 dias"],
  ["mes", "Este mês"]
];

function formatPercent(value) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1
  }).format(Number(value) || 0);
}

function buildNextAction({ completedBookings, profileVisits }) {
  if (profileVisits >= 5 && completedBookings === 0) {
    return {
      title: "Transforme visitas em agendamentos",
      description: `${profileVisits} pessoas visitaram seu perfil, mas ainda não houve agendamentos. Revise serviços, preços e horários.`,
      primary: { label: "Gerenciar serviços", to: "/painel/servicos" },
      secondary: { label: "Abrir agenda", to: "/painel/agenda" }
    };
  }

  if (profileVisits > 0 && completedBookings > 0) {
    return {
      title: "Mantenha o ritmo",
      description: `Seu perfil recebeu ${profileVisits} visitas e gerou ${completedBookings} ${completedBookings === 1 ? "agendamento" : "agendamentos"}. Continue com serviços e horários atualizados.`,
      primary: { label: "Abrir agenda", to: "/painel/agenda" },
      secondary: { label: "Gerenciar serviços", to: "/painel/servicos" }
    };
  }

  return {
    title: "Deixe a agenda pronta",
    description: "Serviços claros e horários atualizados ajudam clientes a confirmar sem voltar ao WhatsApp.",
    primary: { label: "Abrir agenda", to: "/painel/agenda" },
    secondary: { label: "Gerenciar serviços", to: "/painel/servicos" }
  };
}

function customerOriginHint(item) {
  if (item?.codigo === "autonomo") {
    return "Sem sinal de anúncio e sem referência externa identificável. Pode ser acesso direto, favorito ou link compartilhado.";
  }

  if (item?.codigo === "nao_identificado") {
    return "O agendamento existe, mas faltou rastreamento histórico suficiente para identificar a origem.";
  }

  return item?.descricao || "Origem identificada pelo primeiro agendamento conhecido.";
}

function customerOriginCategoryLabel(category) {
  return {
    pago: "Tráfego pago",
    organico: "Tráfego orgânico",
    autonomo: "Acesso autônomo",
    rastreado: "Origem rastreada",
    incompleto: "Rastreamento incompleto"
  }[category] || "Origem";
}

export function DashboardPage() {
  const [period, setPeriod] = useState("7dias");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(true);
  const [onboarding, setOnboarding] = useState({
    businessSlug: "",
    loading: true,
    publication: null
  });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setError("");
    setRefreshing(true);

    Promise.all([
      apiRequest(`/dashboard-dono?periodo=${period}`, {
        signal: controller.signal
      }),
      apiRequest(`/dashboard-dono/origem-clientes?periodo=${period}`, {
        signal: controller.signal
      }).catch((requestError) => {
        if (requestError.name === "AbortError") throw requestError;
        return null;
      })
    ])
      .then(([result, customerOrigin]) => {
        if (active) {
          setData({
            ...result,
            origem_clientes: customerOrigin
          });
        }
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

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    apiRequest("/configuracoes", { signal: controller.signal })
      .then((businessResult) => {
        if (!active) return;

        const business = businessResult.negocio || businessResult.configuracoes || {};
        setOnboarding({
          businessSlug: business.slug || "",
          loading: false,
          publication: businessResult.publicacao || {
            publicado: business.publicado === true,
            pode_publicar: false,
            pendencias: []
          }
        });
      })
      .catch((requestError) => {
        if (active && requestError.name !== "AbortError") {
          setOnboarding((current) => ({ ...current, loading: false }));
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  function selectPeriod(value) {
    if (value === period) return;
    setPeriod(value);
  }

  if (!data && !error) return <div className="workspace-page"><LoadingState>Montando seu painel...</LoadingState></div>;
  if (!data && error) return <div className="workspace-page"><ErrorState message={error} onRetry={() => setReloadKey((current) => current + 1)} /></div>;

  const summary = data.resumo || {};
  const performance = data.performance || {};
  const hasCustomerOrigin = Boolean(data.origem_clientes);
  const customerOrigin = data.origem_clientes || {};
  const customerOriginSummary = customerOrigin.resumo || {};
  const customerOrigins = Array.isArray(customerOrigin.origens)
    ? customerOrigin.origens
    : [];
  const newClients = Number(summary.clientes_novos) || 0;
  const profileVisits = Number(performance.visitas_perfil) || 0;
  const completedBookings = Number(performance.agendamentos_concluidos) || 0;
  const visitLabel = profileVisits === 1 ? "visita" : "visitas";
  const bookingLabel = completedBookings === 1 ? "agendamento" : "agendamentos";
  const nextAction = buildNextAction({ completedBookings, profileVisits });
  const cards = [
    ["Agendamentos", summary.agendamentos_periodo ?? 0, "no período"],
    ["Faturamento", formatCurrency(summary.faturamento_periodo), "previsto"],
    ["Clientes novos", newClients, newClients === 1 ? "descobriu você" : "descobriram você"],
    [
      "Conversão",
      `${formatPercent(performance.taxa_conversao)}%`,
      `${completedBookings} ${bookingLabel} em ${profileVisits} ${visitLabel}`
    ]
  ];

  return (
    <main aria-busy={refreshing} className="workspace-page dashboard-page">
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">Seu crescimento</p>
          <h1>Visão geral</h1>
          <p>Cada agendamento é um passo para tornar seu negócio mais forte.</p>
        </div>
        <div className="segmented-control" aria-label="Período">
          {PERIODS.map(([value, label]) => (
            <button aria-pressed={period === value} className={period === value ? "active" : ""} key={value} onClick={() => selectPeriod(value)} type="button">
              {label}
            </button>
          ))}
        </div>
      </header>

      {refreshing && <p className="data-refresh-status" role="status">Atualizando indicadores...</p>}
      {error && <p className="form-error" role="alert">{error} Os últimos dados carregados continuam visíveis.</p>}

      <ProfessionalOnboardingChecklist
        businessSlug={onboarding.businessSlug}
        loading={onboarding.loading}
        publication={onboarding.publication}
      />

      <section className="metric-grid" aria-label="Indicadores">
        {cards.map(([label, value, hint]) => (
          <article className="metric-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
          </article>
        ))}
      </section>

      <section className="panel" aria-label="Origem dos clientes">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Aquisição de clientes</p>
            <h2>De onde vieram seus clientes</h2>
            <p className="muted">
              Cada pessoa conta uma vez. Pago, orgânico e acesso autônomo ficam separados para você enxergar o que realmente trouxe clientes.
            </p>
          </div>
        </div>

        {hasCustomerOrigin ? (
          <>
            <dl className="data-list">
              <div>
                <dt>Clientes no período</dt>
                <dd>{customerOriginSummary.clientes ?? 0}</dd>
              </div>
              <div>
                <dt>Tráfego pago</dt>
                <dd>
                  {customerOriginSummary.clientesPagos ?? 0}
                  <small> · {formatPercent(customerOriginSummary.percentualPago)}%</small>
                </dd>
              </div>
              <div>
                <dt>Tráfego orgânico</dt>
                <dd>
                  {customerOriginSummary.clientesOrganicos ?? 0}
                  <small> · {formatPercent(customerOriginSummary.percentualOrganico)}%</small>
                </dd>
              </div>
              <div>
                <dt>Acesso autônomo</dt>
                <dd>
                  {customerOriginSummary.clientesAutonomos ?? 0}
                  <small> · {formatPercent(customerOriginSummary.percentualAutonomo)}%</small>
                </dd>
              </div>
            </dl>

            {(Number(customerOriginSummary.clientesPagos) > 0 || Number(customerOriginSummary.clientesOrganicos) > 0) && (
              <dl className="data-list" aria-label="Resultado por tipo de tráfego">
                <div>
                  <dt>Pago · agendamentos</dt>
                  <dd>{customerOriginSummary.agendamentosPagos ?? 0}</dd>
                </div>
                <div>
                  <dt>Pago · faturamento</dt>
                  <dd>{formatCurrency(customerOriginSummary.faturamentoPago)}</dd>
                </div>
                <div>
                  <dt>Orgânico · agendamentos</dt>
                  <dd>{customerOriginSummary.agendamentosOrganicos ?? 0}</dd>
                </div>
                <div>
                  <dt>Orgânico · faturamento</dt>
                  <dd>{formatCurrency(customerOriginSummary.faturamentoOrganico)}</dd>
                </div>
              </dl>
            )}

            {customerOrigins.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Origem</th>
                      <th>Clientes</th>
                      <th>Participação</th>
                      <th>Agendamentos</th>
                      <th>Faturamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerOrigins.map((item) => (
                      <tr key={item.codigo}>
                        <td>
                          <strong>{item.rotulo}</strong>
                          <div><small className="muted">{customerOriginCategoryLabel(item.categoria)} · {customerOriginHint(item)}</small></div>
                        </td>
                        <td>{item.clientes ?? 0}</td>
                        <td>{formatPercent(item.percentualClientes)}%</td>
                        <td>{item.agendamentos ?? 0}</td>
                        <td>{formatCurrency(item.faturamento)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">Ainda não há clientes suficientes para mostrar a origem neste período.</p>
            )}

            <p className="muted">
              <strong>Tráfego pago</strong> exige sinal confiável de anúncio, como identificador de clique ou UTM de mídia paga. <strong>Tráfego orgânico</strong> vem de busca, rede social ou referência externa sem sinal de anúncio. <strong>Acesso autônomo</strong> fica reservado para visitas sem anúncio e sem referência externa identificável. <strong>Origem não identificada</strong> é histórico sem dados suficientes para concluir.
            </p>
          </>
        ) : (
          <p className="muted">A origem dos clientes está temporariamente indisponível. Os demais indicadores continuam válidos.</p>
        )}
      </section>

      <section className="dashboard-grid">
        <article className="panel dashboard-performance-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Aquisição</p><h2>Desempenho do perfil</h2></div>
          </div>
          <dl className="data-list">
            <div><dt>Visitas ao perfil</dt><dd>{performance.visitas_perfil ?? 0}</dd></div>
            <div><dt>Cliques no WhatsApp</dt><dd>{performance.cliques_whatsapp ?? 0}</dd></div>
            <div><dt>Cliques no mapa</dt><dd>{performance.cliques_maps ?? 0}</dd></div>
            <div><dt>Favoritos recebidos</dt><dd>{performance.favoritos_recebidos ?? 0}</dd></div>
          </dl>
        </article>

        <article className="panel dashboard-action-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Próxima ação</p><h2>{nextAction.title}</h2></div>
          </div>
          <p className="muted dashboard-action-copy">{nextAction.description}</p>
          <div className="quick-actions dashboard-quick-actions">
            <Link className="button" to={nextAction.primary.to}>{nextAction.primary.label}</Link>
            <Link className="button button-secondary" to={nextAction.secondary.to}>{nextAction.secondary.label}</Link>
          </div>
        </article>
      </section>

      {Array.isArray(data.ranking_servicos) && data.ranking_servicos.length > 0 && (
        <section className="panel">
          <div className="panel-heading"><h2>Serviços mais agendados</h2></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Serviço</th><th>Agendamentos</th><th>Faturamento</th></tr></thead>
              <tbody>
                {data.ranking_servicos.map((item, index) => (
                  <tr key={item.id || item.servico_id || index}>
                    <td>{item.nome || item.servico_nome || "Serviço"}</td>
                    <td>{item.total ?? item.quantidade ?? 0}</td>
                    <td>{formatCurrency(item.faturamento ?? item.valor_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
