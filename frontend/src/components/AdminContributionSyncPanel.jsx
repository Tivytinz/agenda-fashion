import {
  useEffect,
  useState
} from "react";
import { apiRequest } from "../api/client";
import {
  ErrorState,
  LoadingState
} from "./ScreenState";

function formatDateTime(
  value
) {
  if (!value) return "—";

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
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

export function AdminContributionSyncPanel() {
  const [data, setData] =
    useState(null);
  const [sources, setSources] =
    useState([]);
  const [canEdit, setCanEdit] =
    useState(false);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState("");
  const [message, setMessage] =
    useState("");
  const [saving, setSaving] =
    useState("");
  const [reloadKey, setReloadKey] =
    useState(0);
  const [form, setForm] =
    useState({
      fonteId: "",
      adaptador: "",
      intervaloMinutos: 360,
      ativa: true
    });

  useEffect(() => {
    const controller =
      new AbortController();
    let active = true;

    setLoading(true);
    setError("");

    Promise.all([
      apiRequest(
        "/admin/financeiro/contribuicao/sync",
        {
          signal:
            controller.signal
        }
      ),
      apiRequest(
        "/admin/financeiro/contribuicao",
        {
          signal:
            controller.signal
        }
      )
    ])
      .then(
        ([
          sync,
          contribution
        ]) => {
          if (!active) return;

          setData(sync);
          setSources(
            Array.isArray(
              contribution?.fontes
            )
              ? contribution.fontes
              : []
          );
          setCanEdit(
            contribution
              ?.podeEditar ===
              true
          );

          const firstSource =
            contribution?.fontes
              ?.find(
                (item) =>
                  item.ativa !==
                  false
              )?.id || "";
          const firstAdapter =
            sync?.adaptadores
              ?.find(
                (item) =>
                  item.disponivel ===
                  true
              )?.codigo || "";

          setForm(
            (current) => ({
              ...current,
              fonteId:
                current.fonteId ||
                firstSource,
              adaptador:
                current.adaptador ||
                firstAdapter
            })
          );
        }
      )
      .catch(
        (requestError) => {
          if (
            active &&
            requestError.name !==
              "AbortError"
          ) {
            setError(
              requestError.message ||
              "Não foi possível carregar a sincronização de contribuição."
            );
          }
        }
      )
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadKey]);

  function updateForm(
    field,
    value
  ) {
    setError("");
    setMessage("");
    setForm(
      (current) => ({
        ...current,
        [field]: value
      })
    );
  }

  async function createIntegration(
    event
  ) {
    event.preventDefault();

    if (saving) return;

    setSaving("create");
    setError("");
    setMessage("");

    try {
      await apiRequest(
        "/admin/financeiro/contribuicao/sync/integracoes",
        {
          method: "POST",
          body: {
            fonteId:
              Number(
                form.fonteId
              ),
            adaptador:
              form.adaptador,
            intervaloMinutos:
              Number(
                form
                  .intervaloMinutos
              ),
            ativa:
              form.ativa
          }
        }
      );

      setMessage(
        "Integração factual configurada."
      );
      setReloadKey(
        (value) =>
          value + 1
      );
    } catch (requestError) {
      setError(
        requestError.message ||
        "Não foi possível configurar a integração."
      );
    } finally {
      setSaving("");
    }
  }

  async function runIntegration(
    integrationId
  ) {
    if (saving) return;

    setSaving(
      `run-${integrationId}`
    );
    setError("");
    setMessage("");

    try {
      await apiRequest(
        `/admin/financeiro/contribuicao/sync/integracoes/${integrationId}/executar`,
        {
          method: "POST"
        }
      );

      setMessage(
        "Sincronização concluída."
      );
      setReloadKey(
        (value) =>
          value + 1
      );
    } catch (requestError) {
      setError(
        requestError.message ||
        "Não foi possível sincronizar a fonte."
      );
    } finally {
      setSaving("");
    }
  }

  if (
    loading &&
    !data
  ) {
    return (
      <section className="panel">
        <LoadingState>
          Carregando automação de custos de contribuição...
        </LoadingState>
      </section>
    );
  }

  if (!data && error) {
    return (
      <section className="panel">
        <ErrorState
          message={error}
          onRetry={() =>
            setReloadKey(
              (value) =>
                value + 1
            )
          }
        />
      </section>
    );
  }

  const adapters =
    Array.isArray(
      data?.adaptadores
    )
      ? data.adaptadores
      : [];
  const integrations =
    Array.isArray(
      data?.integracoes
    )
      ? data.integracoes
      : [];
  const executions =
    Array.isArray(
      data?.execucoes
    )
      ? data.execucoes
      : [];
  const availableAdapters =
    adapters.filter(
      (item) =>
        item.disponivel ===
        true
    );

  return (
    <section
      className="panel"
      aria-label="Sincronização automática de contribuição"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">
            Wave 32
          </p>
          <h2>
            Sincronização automática de custos factuais
          </h2>
          <p className="muted">
            Adaptadores só alimentam o ledger existente quando a fonte externa devolve fatos atribuíveis e cobertura reconciliável. Nenhuma integração cria custo por estimativa.
          </p>
        </div>
      </div>

      {error && (
        <p
          className="form-error"
          role="alert"
        >
          {error}
        </p>
      )}

      {message && (
        <p
          className="form-success"
          role="status"
        >
          {message}
        </p>
      )}

      {availableAdapters.length ===
      0 ? (
        <div
          className="admin-command-alert is-warning"
          role="status"
        >
          <strong>
            Nenhum adaptador factual disponível nesta versão.
          </strong>
          <p className="muted">
            O worker permanece sem fonte automática para executar. Custos não são inferidos de WhatsApp, e-mail, infraestrutura ou impostos sem um conector factual específico.
          </p>
        </div>
      ) : (
        <p className="muted">
          Adaptadores disponíveis:{" "}
          {availableAdapters
            .map(
              (item) =>
                item.nome ||
                item.codigo
            )
            .join(", ")}
          .
        </p>
      )}

      <p className="muted">
        Agendamento global:{" "}
        {data?.agendamento
          ?.habilitado
          ? `ativo a cada ${data.agendamento.intervaloHoras}h`
          : "desativado"}
        .
      </p>

      {integrations.length >
      0 ? (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fonte</th>
                <th>Adaptador</th>
                <th>Estado</th>
                <th>Último sucesso</th>
                <th>Último erro</th>
                {canEdit && (
                  <th>Ação</th>
                )}
              </tr>
            </thead>
            <tbody>
              {integrations.map(
                (item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>
                        {item.fonteNome}
                      </strong>
                      <small>
                        {item.fonteCodigo}
                      </small>
                    </td>
                    <td>
                      {item.adaptador}
                      <small>
                        {item.adaptadorDisponivel
                          ? "Disponível"
                          : "Adaptador ausente"}
                      </small>
                    </td>
                    <td>
                      {item.ativa
                        ? "Ativa"
                        : "Inativa"}
                      <small>
                        a cada{" "}
                        {item.intervaloMinutos} min
                      </small>
                    </td>
                    <td>
                      {formatDateTime(
                        item.ultimoSucessoEm
                      )}
                    </td>
                    <td>
                      {item.ultimoErroDetalhe ||
                        "—"}
                    </td>
                    {canEdit && (
                      <td>
                        <button
                          className="button secondary"
                          disabled={
                            !item.ativa ||
                            !item.adaptadorDisponivel ||
                            Boolean(saving)
                          }
                          onClick={() =>
                            runIntegration(
                              item.id
                            )
                          }
                          type="button"
                        >
                          {saving ===
                          `run-${item.id}`
                            ? "Sincronizando..."
                            : "Sincronizar"}
                        </button>
                      </td>
                    )}
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">
          Nenhuma fonte possui integração automática configurada.
        </p>
      )}

      {canEdit &&
        availableAdapters.length >
          0 &&
        sources.length > 0 && (
          <details className="admin-metric-definition">
            <summary>
              Configurar integração factual
            </summary>
            <form
              className="stack-form"
              onSubmit={
                createIntegration
              }
            >
              <div className="form-grid">
                <label>
                  Fonte
                  <select
                    onChange={(event) =>
                      updateForm(
                        "fonteId",
                        event.target
                          .value
                      )
                    }
                    required
                    value={
                      form.fonteId
                    }
                  >
                    {sources
                      .filter(
                        (item) =>
                          item.ativa !==
                          false
                      )
                      .map(
                        (item) => (
                          <option
                            key={item.id}
                            value={item.id}
                          >
                            {item.nome}
                          </option>
                        )
                      )}
                  </select>
                </label>

                <label>
                  Adaptador
                  <select
                    onChange={(event) =>
                      updateForm(
                        "adaptador",
                        event.target
                          .value
                      )
                    }
                    required
                    value={
                      form.adaptador
                    }
                  >
                    {availableAdapters.map(
                      (item) => (
                        <option
                          key={
                            item.codigo
                          }
                          value={
                            item.codigo
                          }
                        >
                          {item.nome ||
                            item.codigo}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  Intervalo (min)
                  <input
                    min="15"
                    max="1440"
                    onChange={(event) =>
                      updateForm(
                        "intervaloMinutos",
                        event.target
                          .value
                      )
                    }
                    required
                    type="number"
                    value={
                      form
                        .intervaloMinutos
                    }
                  />
                </label>
              </div>

              <label>
                <input
                  checked={
                    form.ativa
                  }
                  onChange={(event) =>
                    updateForm(
                      "ativa",
                      event.target
                        .checked
                    )
                  }
                  type="checkbox"
                />
                Ativar sincronização
              </label>

              <div className="form-actions">
                <button
                  className="button"
                  disabled={
                    saving ===
                    "create"
                  }
                  type="submit"
                >
                  {saving === "create"
                    ? "Salvando..."
                    : "Configurar integração"}
                </button>
              </div>
            </form>
          </details>
        )}

      {executions.length >
        0 && (
        <details className="admin-metric-definition">
          <summary>
            Últimas sincronizações
          </summary>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fonte</th>
                  <th>Status</th>
                  <th>Itens</th>
                  <th>Cobertura</th>
                  <th>Finalizada</th>
                </tr>
              </thead>
              <tbody>
                {executions
                  .slice(0, 20)
                  .map(
                    (item) => (
                      <tr
                        key={item.id}
                      >
                        <td>
                          {item.fonteNome ||
                            item.fonteCodigo}
                        </td>
                        <td>
                          {item.status}
                          <small>
                            {item.erroDetalhe ||
                              ""}
                          </small>
                        </td>
                        <td>
                          {item.itensImportados} novos ·{" "}
                          {item.itensReplay} replay
                        </td>
                        <td>
                          {item.coberturaStatus ||
                            "Não avançou"}
                          <small>
                            {item.coberturaAte ||
                              ""}
                          </small>
                        </td>
                        <td>
                          {formatDateTime(
                            item.finalizadoEm
                          )}
                        </td>
                      </tr>
                    )
                  )}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
