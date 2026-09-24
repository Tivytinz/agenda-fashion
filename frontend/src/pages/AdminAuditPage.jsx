import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/ScreenState";
import "../styles/admin-refinements.css";

function formattedDate(value) {
  if (!value) return "Ainda não registrado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo"
  }).format(date);
}

export function AdminAuditPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number.parseInt(params.get("pagina") || "1", 10) || 1);
  const action = params.get("acao") || "";
  const result = params.get("resultado") || "";
  const actorId = params.get("atorId") || "";
  const [actorInput, setActorInput] = useState(actorId);
  const [data, setData] = useState(null);
  const [actions, setActions] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => { setActorInput(actorId); }, [actorId]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setData(null);
    setError("");
    const query = new URLSearchParams({ pagina: String(page), limite: "25" });
    if (action) query.set("acao", action);
    if (result) query.set("resultado", result);
    if (actorId) query.set("atorId", actorId);
    apiRequest(`/admin/auditoria?${query}`, { signal: controller.signal })
      .then((response) => {
        if (active) {
          setData(response);
          setActions(response.acoes || []);
        }
      })
      .catch((err) => {
        if (active && err.name !== "AbortError") {
          setError(err.status === 403
            ? "A consulta da auditoria é restrita ao superadministrador."
            : err.message || "Não foi possível carregar a auditoria.");
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [page, action, result, actorId, reload]);

  function change(next) {
    const query = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value) query.set(key, String(value));
      else query.delete(key);
    }
    setParams(query);
  }

  const events = data?.eventos || [];
  const pagination = data?.paginacao || {};
  return (
    <main className="workspace-page admin-workspace-page admin-command-page admin-operation-page" aria-busy={loading}>
      <header className="workspace-heading admin-command-heading">
        <div>
          <p className="eyebrow">Operação</p>
          <h1>Auditoria administrativa</h1>
          <p>Consulte ações críticas por administrador e resultado. Uma tentativa pendente precisa de investigação.</p>
          <Link to="/admin/operacao">Voltar à operação</Link>
        </div>
        <button className="button button-secondary button-small" type="button" disabled={loading}
          onClick={() => setReload((value) => value + 1)}>Atualizar</button>
      </header>

      <form className="admin-operation-search" onSubmit={(event) => {
        event.preventDefault();
        change({ atorId: actorInput.trim(), pagina: "" });
      }}>
        <label htmlFor="audit-action">Ação</label>
        <select id="audit-action" value={action} onChange={(event) => change({ acao: event.target.value, pagina: "" })}>
          <option value="">Todas as ações</option>
          {actions.map((value) => (
            <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
          ))}
        </select>
        <label htmlFor="audit-result">Resultado</label>
        <select id="audit-result" value={result} onChange={(event) => change({ resultado: event.target.value, pagina: "" })}>
          <option value="">Todos os resultados</option>
          <option value="PENDENTE">Pendente</option>
          <option value="HTTP_OK">Resposta sem erro</option>
          <option value="HTTP_ERRO">Resposta com erro</option>
        </select>
        <label htmlFor="audit-actor">ID do administrador</label>
        <div className="admin-operation-search-row">
          <input id="audit-actor" type="number" min="1" step="1" value={actorInput}
            onChange={(event) => setActorInput(event.target.value)} />
          <button className="button button-secondary button-small" type="submit">Filtrar</button>
        </div>
      </form>

      {loading && !data && <LoadingState>Carregando auditoria...</LoadingState>}
      {error && <ErrorState message={error} onRetry={() => setReload((value) => value + 1)} />}
      {!loading && !error && events.length === 0 && (
        <EmptyState title="Nenhuma ação encontrada">Ajuste os filtros ou consulte outro período.</EmptyState>
      )}
      {!error && events.length > 0 && (
        <section aria-label="Eventos de auditoria">
          <p>{pagination.total} tentativas encontradas.</p>
          <div className="admin-operation-grid">
            {events.map((event) => (
              <article className="admin-operation-card admin-audit-card" key={event.tentativaId}>
                <strong>{event.acao.replaceAll("_", " ")}</strong>
                <p>{event.resultado === "PENDENTE" ? "Pendente de investigação" : event.resultado === "HTTP_OK" ? "Resposta sem erro" : "Resposta com erro"}</p>
                <dl>
                  <div><dt>Administrador</dt><dd>#{event.atorUsuarioId} · {event.papelAdmin}</dd></div>
                  <div><dt>Alvo</dt><dd>{event.alvoTipo}{event.alvoId ? ` #${event.alvoId}` : ""}{event.alvoCodigo ? ` · ${event.alvoCodigo}` : ""}</dd></div>
                  <div><dt>Início</dt><dd>{formattedDate(event.iniciadoEm)}</dd></div>
                  <div><dt>Resultado</dt><dd>{formattedDate(event.finalizadoEm)}{event.httpStatus ? ` · HTTP ${event.httpStatus}` : ""}</dd></div>
                  <div><dt>Hash da requisição</dt><dd>{event.requestId || "Sem identificador"}</dd></div>
                  <div><dt>ID da tentativa</dt><dd>{event.tentativaId}</dd></div>
                </dl>
              </article>
            ))}
          </div>
          <div className="admin-operation-search-row">
            <button className="button button-secondary button-small" type="button"
              disabled={loading || page <= 1} onClick={() => change({ pagina: page - 1 })}>Anterior</button>
            <span>Página {page} de {pagination.totalPaginas || 1}</span>
            <button className="button button-secondary button-small" type="button"
              disabled={loading || page >= pagination.totalPaginas} onClick={() => change({ pagina: page + 1 })}>Próxima</button>
          </div>
        </section>
      )}
    </main>
  );
}
