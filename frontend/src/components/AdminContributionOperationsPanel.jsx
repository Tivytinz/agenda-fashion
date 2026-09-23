import {
  useEffect,
  useState
} from "react";
import { apiRequest } from "../api/client";
import {
  ErrorState,
  LoadingState
} from "./ScreenState";

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
  ).format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "—";

  return String(value)
    .slice(0, 10)
    .split("-")
    .reverse()
    .join("/");
}

const EMPTY_SOURCE = {
  codigo: "",
  nome: "",
  categoria: "",
  obrigatoriaParaMargem: true,
  motivo: ""
};

const EMPTY_COST = {
  fonteCodigo: "",
  negocioId: "",
  chaveOrigem: "",
  tipo: "DEBITO",
  valor: "",
  ocorridoEm: "",
  custoReferenciadoId: "",
  motivo: ""
};

const EMPTY_COVERAGE = {
  fonteCodigo: "",
  inicioCobertura: "",
  cobertoAte: "",
  status: "INCOMPLETA",
  motivo: ""
};

export function AdminContributionOperationsPanel() {
  const [data, setData] =
    useState(null);
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
  const [sourceForm, setSourceForm] =
    useState(EMPTY_SOURCE);
  const [costForm, setCostForm] =
    useState(EMPTY_COST);
  const [
    coverageForm,
    setCoverageForm
  ] = useState(
    EMPTY_COVERAGE
  );

  useEffect(() => {
    const controller =
      new AbortController();
    let active = true;

    setLoading(true);
    setError("");

    apiRequest(
      "/admin/financeiro/contribuicao",
      {
        signal:
          controller.signal
      }
    )
      .then((result) => {
        if (!active) return;

        setData(result);

        const primeiraFonte =
          result?.fontes?.find(
            (item) =>
              item.ativa !== false
          )?.codigo || "";

        if (primeiraFonte) {
          setCostForm(
            (current) => ({
              ...current,
              fonteCodigo:
                current.fonteCodigo ||
                primeiraFonte
            })
          );
          setCoverageForm(
            (current) => ({
              ...current,
              fonteCodigo:
                current.fonteCodigo ||
                primeiraFonte
            })
          );
        }
      })
      .catch(
        (requestError) => {
          if (
            active &&
            requestError.name !==
              "AbortError"
          ) {
            setError(
              requestError.message ||
              "Não foi possível carregar as fontes de contribuição."
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

  function atualizar(
    setter,
    campo,
    valor
  ) {
    setError("");
    setMessage("");
    setter(
      (current) => ({
        ...current,
        [campo]: valor
      })
    );
  }

  async function enviar(
    tipo,
    path,
    body,
    limpar
  ) {
    if (saving) return;

    setSaving(tipo);
    setError("");
    setMessage("");

    try {
      await apiRequest(
        path,
        {
          method: "POST",
          body
        }
      );

      limpar();
      setMessage(
        "Operação registrada com trilha de auditoria."
      );
      setReloadKey(
        (current) =>
          current + 1
      );
    } catch (requestError) {
      setError(
        requestError.message ||
        "Não foi possível concluir a operação financeira."
      );
    } finally {
      setSaving("");
    }
  }

  if (loading && !data) {
    return (
      <section className="panel">
        <LoadingState>
          Carregando fontes de contribuição...
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
              (current) =>
                current + 1
            )
          }
        />
      </section>
    );
  }

  const fontes =
    Array.isArray(data?.fontes)
      ? data.fontes
      : [];
  const custos =
    Array.isArray(data?.custos)
      ? data.custos
      : [];
  const podeEditar =
    data?.podeEditar === true;

  return (
    <section
      className="panel"
      aria-label="Fontes factuais de contribuição"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">
            Wave 31
          </p>
          <h2>
            Fontes factuais de contribuição
          </h2>
          <p className="muted">
            Custos variáveis entram na margem somente com fonte real, lançamento factual e cobertura declarada. Correções usam crédito append-only.
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

      {fontes.length === 0 ? (
        <div
          className="admin-command-alert is-warning"
          role="status"
        >
          <strong>
            Nenhuma fonte factual cadastrada.
          </strong>
          <p className="muted">
            Margem, LTV de contribuição e retorno de contribuição permanecem indisponíveis. Não cadastre uma fonte sem contrato, fatura ou regra factual verificável.
          </p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fonte</th>
                <th>Categoria</th>
                <th>Cobertura</th>
                <th>Lançamentos</th>
                <th>Custo líquido observado</th>
              </tr>
            </thead>
            <tbody>
              {fontes.map(
                (fonte) => (
                  <tr key={fonte.id}>
                    <td>
                      <strong>
                        {fonte.nome}
                      </strong>
                      <small>
                        {fonte.codigo}
                        {fonte.obrigatoriaParaMargem
                          ? " · obrigatória"
                          : " · não obrigatória"}
                      </small>
                    </td>
                    <td>
                      {fonte.categoria}
                    </td>
                    <td>
                      {fonte.coberturaStatus ||
                        "Sem cobertura"}
                      <small>
                        {fonte.inicioCobertura
                          ? `${formatDate(
                              fonte.inicioCobertura
                            )} → ${formatDate(
                              fonte.cobertoAte
                            )}`
                          : "Intervalo não declarado"}
                      </small>
                    </td>
                    <td>
                      {Number(
                        fonte.lancamentos ||
                        0
                      )}
                    </td>
                    <td>
                      {formatMoney(
                        fonte.custoLiquidoObservado
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {!podeEditar && (
        <p className="muted">
          A consulta está disponível para administradores. Criação de fonte, custo, crédito e cobertura são restritos ao superadministrador no backend.
        </p>
      )}

      {podeEditar && (
        <>
          <details className="admin-metric-definition">
            <summary>
              Cadastrar fonte factual
            </summary>
            <form
              className="stack-form"
              onSubmit={(event) => {
                event.preventDefault();
                enviar(
                  "fonte",
                  "/admin/financeiro/contribuicao/fontes",
                  sourceForm,
                  () =>
                    setSourceForm(
                      EMPTY_SOURCE
                    )
                );
              }}
            >
              <div className="form-grid">
                <label>
                  Código imutável
                  <input
                    maxLength="80"
                    onChange={(event) =>
                      atualizar(
                        setSourceForm,
                        "codigo",
                        event.target.value
                      )
                    }
                    pattern="[a-z0-9][a-z0-9_-]{1,79}"
                    placeholder="ex.: whatsapp_variavel"
                    required
                    value={sourceForm.codigo}
                  />
                </label>
                <label>
                  Nome
                  <input
                    maxLength="140"
                    onChange={(event) =>
                      atualizar(
                        setSourceForm,
                        "nome",
                        event.target.value
                      )
                    }
                    required
                    value={sourceForm.nome}
                  />
                </label>
                <label>
                  Categoria
                  <input
                    maxLength="80"
                    onChange={(event) =>
                      atualizar(
                        setSourceForm,
                        "categoria",
                        event.target.value
                      )
                    }
                    placeholder="ex.: comunicacao_variavel"
                    required
                    value={sourceForm.categoria}
                  />
                </label>
                <label>
                  Motivo / evidência
                  <input
                    maxLength="240"
                    minLength="4"
                    onChange={(event) =>
                      atualizar(
                        setSourceForm,
                        "motivo",
                        event.target.value
                      )
                    }
                    required
                    value={sourceForm.motivo}
                  />
                </label>
              </div>
              <label>
                <input
                  checked={
                    sourceForm
                      .obrigatoriaParaMargem
                  }
                  onChange={(event) =>
                    atualizar(
                      setSourceForm,
                      "obrigatoriaParaMargem",
                      event.target.checked
                    )
                  }
                  type="checkbox"
                />
                Fonte obrigatória para margem de contribuição
              </label>
              <div className="form-actions">
                <button
                  className="button"
                  disabled={
                    saving ===
                    "fonte"
                  }
                  type="submit"
                >
                  {saving === "fonte"
                    ? "Salvando..."
                    : "Cadastrar fonte"}
                </button>
              </div>
            </form>
          </details>

          {fontes.length > 0 && (
            <>
              <details className="admin-metric-definition">
                <summary>
                  Registrar débito ou crédito
                </summary>
                <form
                  className="stack-form"
                  onSubmit={(event) => {
                    event.preventDefault();

                    enviar(
                      "custo",
                      "/admin/financeiro/contribuicao/custos",
                      {
                        ...costForm,
                        negocioId:
                          Number(
                            costForm.negocioId
                          ),
                        valor:
                          Number(
                            costForm.valor
                          ),
                        ocorridoEm:
                          new Date(
                            costForm.ocorridoEm
                          ).toISOString(),
                        custoReferenciadoId:
                          costForm.tipo ===
                            "CREDITO"
                            ? Number(
                                costForm
                                  .custoReferenciadoId
                              )
                            : null
                      },
                      () =>
                        setCostForm(
                          (current) => ({
                            ...EMPTY_COST,
                            fonteCodigo:
                              current
                                .fonteCodigo
                          })
                        )
                    );
                  }}
                >
                  <div className="form-grid">
                    <label>
                      Fonte
                      <select
                        onChange={(event) =>
                          atualizar(
                            setCostForm,
                            "fonteCodigo",
                            event.target.value
                          )
                        }
                        required
                        value={costForm.fonteCodigo}
                      >
                        {fontes
                          .filter(
                            (item) =>
                              item.ativa !==
                              false
                          )
                          .map(
                            (item) => (
                              <option
                                key={item.id}
                                value={item.codigo}
                              >
                                {item.nome}
                              </option>
                            )
                          )}
                      </select>
                    </label>
                    <label>
                      Negócio ID
                      <input
                        min="1"
                        onChange={(event) =>
                          atualizar(
                            setCostForm,
                            "negocioId",
                            event.target.value
                          )
                        }
                        required
                        type="number"
                        value={costForm.negocioId}
                      />
                    </label>
                    <label>
                      Tipo
                      <select
                        onChange={(event) =>
                          atualizar(
                            setCostForm,
                            "tipo",
                            event.target.value
                          )
                        }
                        value={costForm.tipo}
                      >
                        <option value="DEBITO">
                          Débito
                        </option>
                        <option value="CREDITO">
                          Crédito / correção
                        </option>
                      </select>
                    </label>
                    <label>
                      Valor (R$)
                      <input
                        min="0.01"
                        onChange={(event) =>
                          atualizar(
                            setCostForm,
                            "valor",
                            event.target.value
                          )
                        }
                        required
                        step="0.01"
                        type="number"
                        value={costForm.valor}
                      />
                    </label>
                    <label>
                      Ocorrido em
                      <input
                        onChange={(event) =>
                          atualizar(
                            setCostForm,
                            "ocorridoEm",
                            event.target.value
                          )
                        }
                        required
                        type="datetime-local"
                        value={costForm.ocorridoEm}
                      />
                    </label>
                    <label>
                      Chave de origem
                      <input
                        maxLength="160"
                        onChange={(event) =>
                          atualizar(
                            setCostForm,
                            "chaveOrigem",
                            event.target.value
                          )
                        }
                        required
                        value={costForm.chaveOrigem}
                      />
                    </label>
                    {costForm.tipo ===
                      "CREDITO" && (
                      <label>
                        Débito referenciado ID
                        <input
                          min="1"
                          onChange={(event) =>
                            atualizar(
                              setCostForm,
                              "custoReferenciadoId",
                              event.target.value
                            )
                          }
                          required
                          type="number"
                          value={
                            costForm
                              .custoReferenciadoId
                          }
                        />
                      </label>
                    )}
                    <label>
                      Motivo / evidência
                      <input
                        maxLength="240"
                        minLength="4"
                        onChange={(event) =>
                          atualizar(
                            setCostForm,
                            "motivo",
                            event.target.value
                          )
                        }
                        required
                        value={costForm.motivo}
                      />
                    </label>
                  </div>
                  <div className="form-actions">
                    <button
                      className="button"
                      disabled={
                        saving ===
                        "custo"
                      }
                      type="submit"
                    >
                      {saving === "custo"
                        ? "Registrando..."
                        : "Registrar lançamento"}
                    </button>
                  </div>
                </form>
              </details>

              <details className="admin-metric-definition">
                <summary>
                  Atualizar cobertura da fonte
                </summary>
                <form
                  className="stack-form"
                  onSubmit={(event) => {
                    event.preventDefault();

                    enviar(
                      "cobertura",
                      "/admin/financeiro/contribuicao/cobertura",
                      {
                        ...coverageForm,
                        cobertoAte:
                          coverageForm.cobertoAte ||
                          null
                      },
                      () =>
                        setCoverageForm(
                          (current) => ({
                            ...EMPTY_COVERAGE,
                            fonteCodigo:
                              current
                                .fonteCodigo
                          })
                        )
                    );
                  }}
                >
                  <div className="form-grid">
                    <label>
                      Fonte
                      <select
                        onChange={(event) =>
                          atualizar(
                            setCoverageForm,
                            "fonteCodigo",
                            event.target.value
                          )
                        }
                        required
                        value={
                          coverageForm
                            .fonteCodigo
                        }
                      >
                        {fontes
                          .filter(
                            (item) =>
                              item.ativa !==
                              false
                          )
                          .map(
                            (item) => (
                              <option
                                key={item.id}
                                value={item.codigo}
                              >
                                {item.nome}
                              </option>
                            )
                          )}
                      </select>
                    </label>
                    <label>
                      Início da cobertura
                      <input
                        onChange={(event) =>
                          atualizar(
                            setCoverageForm,
                            "inicioCobertura",
                            event.target.value
                          )
                        }
                        required
                        type="date"
                        value={
                          coverageForm
                            .inicioCobertura
                        }
                      />
                    </label>
                    <label>
                      Coberto até
                      <input
                        onChange={(event) =>
                          atualizar(
                            setCoverageForm,
                            "cobertoAte",
                            event.target.value
                          )
                        }
                        type="date"
                        value={
                          coverageForm
                            .cobertoAte
                        }
                      />
                    </label>
                    <label>
                      Status
                      <select
                        onChange={(event) =>
                          atualizar(
                            setCoverageForm,
                            "status",
                            event.target.value
                          )
                        }
                        value={
                          coverageForm
                            .status
                        }
                      >
                        <option value="INCOMPLETA">
                          Incompleta
                        </option>
                        <option value="COMPLETA">
                          Completa
                        </option>
                      </select>
                    </label>
                    <label>
                      Motivo / conciliação
                      <input
                        maxLength="240"
                        minLength="4"
                        onChange={(event) =>
                          atualizar(
                            setCoverageForm,
                            "motivo",
                            event.target.value
                          )
                        }
                        required
                        value={
                          coverageForm
                            .motivo
                        }
                      />
                    </label>
                  </div>
                  <div className="form-actions">
                    <button
                      className="button"
                      disabled={
                        saving ===
                        "cobertura"
                      }
                      type="submit"
                    >
                      {saving ===
                      "cobertura"
                        ? "Atualizando..."
                        : "Atualizar cobertura"}
                    </button>
                  </div>
                </form>
              </details>
            </>
          )}
        </>
      )}

      {custos.length > 0 && (
        <details className="admin-metric-definition">
          <summary>
            Últimos lançamentos factuais
          </summary>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fonte</th>
                  <th>Negócio</th>
                  <th>Tipo</th>
                  <th>Valor</th>
                  <th>Chave</th>
                </tr>
              </thead>
              <tbody>
                {custos
                  .slice(0, 20)
                  .map(
                    (custo) => (
                      <tr key={custo.id}>
                        <td>
                          {custo.fonteNome ||
                            custo.fonteCodigo}
                        </td>
                        <td>
                          {custo.negocioNome ||
                            custo.negocioId}
                        </td>
                        <td>
                          {custo.tipo}
                        </td>
                        <td>
                          {formatMoney(
                            custo.valor
                          )}
                        </td>
                        <td>
                          {custo.chaveOrigem}
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
