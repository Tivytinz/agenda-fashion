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

function localDateValue() {
  const now = new Date();
  const local = new Date(
    now.getTime() -
    now.getTimezoneOffset() * 60000
  );

  return local
    .toISOString()
    .slice(0, 10);
}

function formatMoney(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  const cents = Number(value);

  if (!Number.isFinite(cents)) {
    return "—";
  }

  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL"
    }
  ).format(cents / 100);
}

function formatDate(value) {
  if (!value) return "—";

  const [year, month, day] =
    String(value)
      .slice(0, 10)
      .split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function moneyToCents(value) {
  const amount = Number(value);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return null;
  }

  return Math.round(amount * 100);
}

export function AdminMarketingCostsPage() {
  const [period, setPeriod] =
    useState("30");

  const [data, setData] =
    useState(null);

  const [error, setError] =
    useState("");

  const [reloadKey, setReloadKey] =
    useState(0);

  const [form, setForm] =
    useState({
      campanhaId: "",
      dataGasto: localDateValue(),
      valor: "",
      observacao: ""
    });

  const [saving, setSaving] =
    useState(false);

  const [formError, setFormError] =
    useState("");

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    const controller =
      new AbortController();

    let active = true;

    setData(null);
    setError("");

    Promise.all([
      apiRequest(
        `/admin/marketing/custos?periodo=${period}`,
        { signal: controller.signal }
      ),
      apiRequest(
        `/admin/marketing/gastos?periodo=${period}`,
        { signal: controller.signal }
      ),
      apiRequest(
        "/admin/marketing/gestao-campanhas",
        { signal: controller.signal }
      )
    ])
      .then(([
        costs,
        expenses,
        managedCampaigns
      ]) => {
        if (!active) return;

        setData({
          costs,
          expenses:
            expenses.gastos || [],
          managedCampaigns:
            managedCampaigns.campanhas || []
        });

        setForm((current) => {
          if (
            current.campanhaId ||
            !managedCampaigns.campanhas?.length
          ) {
            return current;
          }

          const firstActive =
            managedCampaigns.campanhas.find(
              (item) => item.ativo
            ) ||
            managedCampaigns.campanhas[0];

          return {
            ...current,
            campanhaId:
              String(firstActive.id)
          };
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

  function updateForm(field, value) {
    setFormError("");
    setMessage("");

    setForm(
      (current) => ({
        ...current,
        [field]: value
      })
    );
  }

  async function submitExpense(event) {
    event.preventDefault();

    if (saving) return;

    const cents =
      moneyToCents(form.valor);

    if (!cents) {
      setFormError(
        "Informe um valor de investimento maior que zero."
      );
      return;
    }

    if (!form.campanhaId) {
      setFormError(
        "Selecione uma campanha."
      );
      return;
    }

    setSaving(true);
    setFormError("");
    setMessage("");

    try {
      await apiRequest(
        "/admin/marketing/gastos",
        {
          method: "POST",
          body: {
            campanhaId:
              Number(form.campanhaId),
            dataGasto:
              form.dataGasto,
            valorCentavos: cents,
            observacao:
              form.observacao
          }
        }
      );

      setForm(
        (current) => ({
          ...current,
          valor: "",
          observacao: ""
        })
      );

      setMessage(
        "Investimento salvo. Se já existia valor manual para esta campanha e data, ele foi corrigido."
      );

      setReloadKey(
        (current) => current + 1
      );
    } catch (requestError) {
      setFormError(
        requestError.message
      );
    } finally {
      setSaving(false);
    }
  }

  if (!data && !error) {
    return (
      <main className="workspace-page admin-workspace-page">
        <LoadingState>
          Carregando custos de marketing...
        </LoadingState>
      </main>
    );
  }

  if (error) {
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

  const costs = data.costs || {};

  const cards = [
    [
      "Investimento",
      formatMoney(
        costs.investimentoCentavos
      ),
      "gasto registrado no período"
    ],
    [
      "Custo por sessão",
      formatMoney(
        costs.custoPorSessaoCentavos
      ),
      `${costs.sessoes ?? 0} sessões atribuídas`
    ],
    [
      "Agendamentos",
      costs.agendamentosConcluidos ?? 0,
      "conversões concluídas"
    ],
    [
      "CPA",
      formatMoney(
        costs.cpaCentavos
      ),
      "investimento por agendamento"
    ]
  ];

  return (
    <main className="workspace-page admin-workspace-page">
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">
            Administração do AF
          </p>
          <h1>Investimento e CPA</h1>
          <p>
            Registre o gasto real das campanhas e compare custo por sessão e por agendamento concluído.
          </p>
        </div>

        <div
          className="segmented-control"
          aria-label="Período dos custos"
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

      <section
        className="metric-grid"
        aria-label="Indicadores de custo de marketing"
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
              Lançamento manual
            </p>
            <h2>Registrar investimento</h2>
            <p className="muted">
              O valor representa o gasto real daquela campanha no dia. Repetir campanha + data corrige o lançamento anterior.
            </p>
          </div>
        </div>

        {data.managedCampaigns.length === 0 ? (
          <p className="muted">
            Crie uma campanha rastreável antes de registrar investimento.
          </p>
        ) : (
          <form
            className="stack-form"
            onSubmit={submitExpense}
          >
            <div className="form-grid">
              <label>
                Campanha
                <select
                  onChange={(event) =>
                    updateForm(
                      "campanhaId",
                      event.target.value
                    )
                  }
                  required
                  value={form.campanhaId}
                >
                  {data.managedCampaigns.map(
                    (item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item.nome}
                        {item.ativo
                          ? ""
                          : " (arquivada)"}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Data do gasto
                <input
                  onChange={(event) =>
                    updateForm(
                      "dataGasto",
                      event.target.value
                    )
                  }
                  required
                  type="date"
                  value={form.dataGasto}
                />
              </label>

              <label>
                Investimento (R$)
                <input
                  min="0.01"
                  onChange={(event) =>
                    updateForm(
                      "valor",
                      event.target.value
                    )
                  }
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
                  onChange={(event) =>
                    updateForm(
                      "observacao",
                      event.target.value
                    )
                  }
                  placeholder="Opcional"
                  value={form.observacao}
                />
              </label>
            </div>

            {formError && (
              <p
                className="form-error"
                role="alert"
              >
                {formError}
              </p>
            )}

            {message && (
              <p className="form-success">
                {message}
              </p>
            )}

            <div className="form-actions">
              <button
                className="button"
                disabled={saving}
                type="submit"
              >
                {saving
                  ? "Salvando..."
                  : "Salvar investimento"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">
              Eficiência
            </p>
            <h2>CPA por campanha</h2>
          </div>
        </div>

        {!costs.campanhas?.length ? (
          <p className="muted">
            Ainda não há campanhas cadastradas.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th>Canal</th>
                  <th>Investimento</th>
                  <th>Sessões</th>
                  <th>Custo/sessão</th>
                  <th>Agendamentos</th>
                  <th>CPA</th>
                </tr>
              </thead>
              <tbody>
                {costs.campanhas.map(
                  (item) => (
                    <tr key={item.campanhaId}>
                      <td>{item.nome}</td>
                      <td>{item.canal}</td>
                      <td>
                        {formatMoney(
                          item.investimentoCentavos
                        )}
                      </td>
                      <td>{item.sessoes}</td>
                      <td>
                        {formatMoney(
                          item.custoPorSessaoCentavos
                        )}
                      </td>
                      <td>
                        {item.agendamentosConcluidos}
                      </td>
                      <td>
                        {formatMoney(
                          item.cpaCentavos
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

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">
              Histórico
            </p>
            <h2>Investimentos registrados</h2>
          </div>
        </div>

        {data.expenses.length === 0 ? (
          <p className="muted">
            Nenhum investimento registrado neste período.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Campanha</th>
                  <th>Canal</th>
                  <th>Valor</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {data.expenses.map(
                  (item) => (
                    <tr key={item.id}>
                      <td>
                        {formatDate(
                          item.dataGasto
                        )}
                      </td>
                      <td>
                        {item.campanhaNome || "—"}
                      </td>
                      <td>{item.canal || "—"}</td>
                      <td>
                        {formatMoney(
                          item.valorCentavos
                        )}
                      </td>
                      <td>
                        {item.observacao || "—"}
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
