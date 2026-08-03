import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { ErrorState, LoadingState } from "../components/ScreenState";
import { formatCurrency } from "../utils/format";

const PERIODS = [
  ["hoje", "Hoje"],
  ["7dias", "7 dias"],
  ["30dias", "30 dias"],
  ["mes", "Este mês"]
];

export function DashboardPage() {
  const [period, setPeriod] = useState("7dias");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setError("");
    apiRequest(`/dashboard-dono?periodo=${period}`, {
      signal: controller.signal
    })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((requestError) => {
        if (active && requestError.name !== "AbortError") {
          setError(requestError.message);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [period, reloadKey]);

  function selectPeriod(value) {
    if (value === period) return;
    setData(null);
    setPeriod(value);
  }

  if (!data && !error) return <div className="workspace-page"><LoadingState>Montando seu painel...</LoadingState></div>;
  if (error) return <div className="workspace-page"><ErrorState message={error} onRetry={() => setReloadKey((current) => current + 1)} /></div>;

  const summary = data.resumo || {};
  const performance = data.performance || {};
  const cards = [
    ["Agendamentos", summary.agendamentos_periodo ?? 0, "no período"],
    ["Faturamento", formatCurrency(summary.faturamento_periodo), "previsto"],
    ["Clientes novos", summary.clientes_novos ?? 0, "descobriram você"],
    ["Conversão", `${performance.taxa_conversao ?? 0}%`, "visita → agenda"]
  ];

  return (
    <main className="workspace-page">
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

      <section className="metric-grid" aria-label="Indicadores">
        {cards.map(([label, value, hint]) => (
          <article className="metric-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Aquisição</p><h2>Seu perfil está trabalhando</h2></div>
          </div>
          <dl className="data-list">
            <div><dt>Visitas ao perfil</dt><dd>{performance.visitas_perfil ?? 0}</dd></div>
            <div><dt>Cliques no WhatsApp</dt><dd>{performance.cliques_whatsapp ?? 0}</dd></div>
            <div><dt>Cliques no mapa</dt><dd>{performance.cliques_maps ?? 0}</dd></div>
            <div><dt>Favoritos recebidos</dt><dd>{performance.favoritos_recebidos ?? 0}</dd></div>
          </dl>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Próxima ação</p><h2>Mantenha a agenda pronta</h2></div>
          </div>
          <p className="muted">Serviços claros e horários atualizados ajudam clientes a confirmar sem voltar ao WhatsApp.</p>
          <div className="quick-actions">
            <Link className="button" to="/painel/agenda">Abrir agenda</Link>
            <Link className="button button-secondary" to="/painel/servicos">Gerenciar serviços</Link>
          </div>
        </article>
      </section>

      {Array.isArray(data.ranking_servicos) && data.ranking_servicos.length > 0 && (
        <section className="panel">
          <div className="panel-heading"><h2>Serviços que mais cresceram</h2></div>
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
