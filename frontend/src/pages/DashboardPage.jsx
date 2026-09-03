import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { DashboardNextAction } from "../components/DashboardNextAction";
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

function customerOriginHint(item) {
  if (item?.codigo === "autonomo") {
    return "Sem sinal de anúncio, referência externa ou link rastreável do AF. Pode ser acesso direto, favorito ou link manual sem identificação.";
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
  const [whatsappReminders, setWhatsappReminders] = useState({
    enabled: null,
    operationalEnabled: null,
    error: "",
    saving: false
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

    apiRequest("/conta", { signal: controller.signal })
      .then((result) => {
        if (!active) return;

        setWhatsappReminders((current) => ({
          ...current,
          enabled:
            result.usuario?.aceita_lembretes_whatsapp === true,
          operationalEnabled:
            result.usuario?.aceita_alertas_operacionais_whatsapp === true,
          error: ""
        }));
      })
      .catch((requestError) => {
        if (active && requestError.name !== "AbortError") {
          setWhatsappReminders((current) => ({
            ...current,
            enabled: null,
            operationalEnabled: null
          }));
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  async function enableWhatsappReminders() {
    setWhatsappReminders((current) => ({
      ...current,
      error: "",
      saving: true
    }));

    try {
      const result = await apiRequest(
        "/conta/preferencias-whatsapp",
        {
          method: "PUT",
          body: {
            aceitaLembretes: true,
            origem: "painel"
          }
        }
      );

      setWhatsappReminders((current) => ({
        ...current,
        enabled:
          result.preferencia?.aceita_lembretes_whatsapp === true,
        operationalEnabled:
          result.preferencia?.aceita_alertas_operacionais_whatsapp === undefined
            ? current.operationalEnabled
            : result.preferencia?.aceita_alertas_operacionais_whatsapp === true,
        error: "",
        saving: false
      }));
    } catch (requestError) {
      setWhatsappReminders((current) => ({
        ...current,
        error: requestError.message,
        saving: false
      }));
    }
  }

  async function enableOperationalWhatsappAlerts() {
    setWhatsappReminders((current) => ({
      ...current,
      error: "",
      saving: true
    }));

    try {
      const result = await apiRequest(
        "/conta/preferencias-whatsapp",
        {
          method: "PUT",
          body: {
            aceitaAlertasOperacionais: true,
            origem: "painel"
          }
        }
      );

      setWhatsappReminders((current) => ({
        ...current,
        operationalEnabled:
          result.preferencia?.aceita_alertas_operacionais_whatsapp === true,
        error: "",
        saving: false
      }));
    } catch (requestError) {
      setWhatsappReminders((current) => ({
        ...current,
        error: requestError.message,
        saving: false
      }));
    }
  }

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

      {whatsappReminders.operationalEnabled === false && (
        <section
          aria-labelledby="whatsapp-operational-title"
          className="panel whatsapp-reminders-panel"
        >
          <div>
            <p className="eyebrow">Avisos de agendamento</p>
            <h2 id="whatsapp-operational-title">
              Acompanhe sua agenda pelo WhatsApp
            </h2>
            <p className="muted">
              Autorize avisos operacionais do Agenda Fashion sobre novos
              agendamentos, lembretes, alterações e cancelamentos. Não inclui
              promoções e você pode desativar quando quiser.
            </p>
          </div>
          <div className="whatsapp-reminders-actions">
            <button
              className="button"
              disabled={whatsappReminders.saving}
              onClick={enableOperationalWhatsappAlerts}
              type="button"
            >
              {whatsappReminders.saving
                ? "Ativando..."
                : "Ativar avisos de agendamento"}
            </button>
            <Link className="text-button" to="/conta">
              Gerenciar em Minha conta
            </Link>
          </div>
        </section>
      )}

      {whatsappReminders.enabled === false && (
        <section
          aria-labelledby="whatsapp-reminders-title"
          className="panel whatsapp-reminders-panel"
        >
          <div>
            <p className="eyebrow">Acompanhamento pelo WhatsApp</p>
            <h2 id="whatsapp-reminders-title">
              Não deixe seu negócio parado
            </h2>
            <p className="muted">
              Autorize até três orientações, com intervalo mínimo de três dias,
              para cadastrar seu primeiro serviço e, quando sua agenda estiver pronta,
              divulgar seu perfil.
              Você pode desativar em Minha conta ou responder PARAR MARKETING.
            </p>
          </div>
          <div className="whatsapp-reminders-actions">
            <button
              className="button"
              disabled={whatsappReminders.saving}
              onClick={enableWhatsappReminders}
              type="button"
            >
              {whatsappReminders.saving
                ? "Ativando..."
                : "Ativar lembretes no WhatsApp"}
            </button>
            <Link className="text-button" to="/conta">
              Gerenciar em Minha conta
            </Link>
          </div>
          {whatsappReminders.error && (
            <p className="form-error" role="alert">
              {whatsappReminders.error}
            </p>
          )}
        </section>
      )}

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
              <strong>Tráfego pago</strong> exige sinal confiável de anúncio, como identificador de clique ou UTM de mídia paga. <strong>Tráfego orgânico</strong> inclui busca, rede social, referência externa e links rastreáveis compartilhados pelo próprio AF sem sinal de anúncio. <strong>Acesso autônomo</strong> fica reservado para visitas sem anúncio, sem referência externa e sem link rastreável do AF. <strong>Origem não identificada</strong> é histórico sem dados suficientes para concluir.
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

        <DashboardNextAction
          copilot={data.copilot_ativacao}
          businessId={data.negocio?.negocio_id}
          businessName={data.negocio?.nome}
          businessSlug={data.negocio?.slug}
        />
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
