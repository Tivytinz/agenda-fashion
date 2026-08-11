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

const CHANNELS = {
  meta: {
    label: "Meta",
    source: "meta",
    medium: "cpc"
  },
  google: {
    label: "Google",
    source: "google",
    medium: "cpc"
  },
  pinterest: {
    label: "Pinterest",
    source: "pinterest",
    medium: "cpc"
  },
  tiktok: {
    label: "TikTok",
    source: "tiktok",
    medium: "cpc"
  },
  outro: {
    label: "Outro",
    source: "",
    medium: "cpc"
  }
};

const INITIAL_CAMPAIGN = {
  nome: "",
  canal: "meta",
  utmSource: "meta",
  utmMedium: "cpc",
  utmCampaign: "",
  utmContent: "",
  utmTerm: "",
  destinoPath: "/"
};

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

function tokenPreview(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 140);
}

async function copyText(value) {
  if (
    navigator.clipboard?.writeText
  ) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea =
    document.createElement("textarea");

  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  const copied =
    document.execCommand("copy");

  textarea.remove();

  if (!copied) {
    throw new Error(
      "Não foi possível copiar o link."
    );
  }
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

  const [campaignForm, setCampaignForm] =
    useState(INITIAL_CAMPAIGN);

  const [campaignStatus, setCampaignStatus] =
    useState("idle");

  const [campaignMessage, setCampaignMessage] =
    useState("");

  const [campaignError, setCampaignError] =
    useState("");

  const [campaignActionId, setCampaignActionId] =
    useState(null);

  const [copiedCampaignId, setCopiedCampaignId] =
    useState(null);

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
      ),
      apiRequest(
        "/admin/marketing/gestao-campanhas",
        { signal: controller.signal }
      )
    ])
      .then(([
        summary,
        campaigns,
        conversions,
        managedCampaigns
      ]) => {
        if (!active) return;

        setData({
          summary,
          campaigns:
            campaigns.campanhas || [],
          conversions:
            conversions.conversoes || [],
          managedCampaigns:
            managedCampaigns.campanhas || []
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

  function updateCampaignForm(
    field,
    value
  ) {
    setCampaignMessage("");
    setCampaignError("");

    if (field === "canal") {
      const preset =
        CHANNELS[value] ||
        CHANNELS.outro;

      setCampaignForm(
        (current) => ({
          ...current,
          canal: value,
          utmSource:
            preset.source,
          utmMedium:
            preset.medium
        })
      );
      return;
    }

    setCampaignForm(
      (current) => ({
        ...current,
        [field]: value
      })
    );
  }

  async function submitCampaign(event) {
    event.preventDefault();

    if (campaignStatus === "loading") {
      return;
    }

    setCampaignStatus("loading");
    setCampaignError("");
    setCampaignMessage("");

    const payload = {
      nome:
        campaignForm.nome,
      canal:
        campaignForm.canal,
      utmSource:
        campaignForm.utmSource,
      utmMedium:
        campaignForm.utmMedium,
      destinoPath:
        campaignForm.destinoPath,
      utmContent:
        campaignForm.utmContent,
      utmTerm:
        campaignForm.utmTerm,
      ...(campaignForm.utmCampaign.trim()
        ? {
            utmCampaign:
              campaignForm.utmCampaign
          }
        : {})
    };

    try {
      const result =
        await apiRequest(
          "/admin/marketing/gestao-campanhas",
          {
            method: "POST",
            body: payload
          }
        );

      setData(
        (current) => ({
          ...current,
          managedCampaigns: [
            result.campanha,
            ...(current?.managedCampaigns || [])
              .filter(
                (item) =>
                  item.id !==
                  result.campanha.id
              )
          ]
        })
      );

      setCampaignForm(
        INITIAL_CAMPAIGN
      );
      setCampaignMessage(
        "Campanha criada. O link rastreável já está pronto para uso."
      );
    } catch (requestError) {
      setCampaignError(
        requestError.message
      );
    } finally {
      setCampaignStatus("idle");
    }
  }

  async function toggleCampaign(item) {
    if (campaignActionId) {
      return;
    }

    setCampaignActionId(item.id);
    setCampaignError("");
    setCampaignMessage("");

    try {
      const result =
        await apiRequest(
          `/admin/marketing/gestao-campanhas/${item.id}`,
          {
            method: "PATCH",
            body: {
              ativo:
                !item.ativo
            }
          }
        );

      setData(
        (current) => ({
          ...current,
          managedCampaigns:
            (current?.managedCampaigns || [])
              .map(
                (campaign) =>
                  campaign.id === item.id
                    ? result.campanha
                    : campaign
              )
        })
      );
    } catch (requestError) {
      setCampaignError(
        requestError.message
      );
    } finally {
      setCampaignActionId(null);
    }
  }

  async function copyCampaignLink(item) {
    setCampaignError("");

    try {
      await copyText(
        item.linkRastreavel
      );
      setCopiedCampaignId(item.id);
    } catch (copyError) {
      setCampaignError(
        copyError.message
      );
    }
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

  const campaignIdentifier =
    campaignForm.utmCampaign.trim() ||
    tokenPreview(
      campaignForm.nome
    );

  return (
    <main className="container page-content">
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">
            Administração do AF
          </p>
          <h1>Marketing e tráfego pago</h1>
          <p>
            Crie links de campanha e acompanhe quais origens terminam em agendamento.
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

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">
              Nova campanha
            </p>
            <h2>Gerar link rastreável</h2>
            <p className="muted">
              O destino precisa ser uma página interna do AF. A identidade UTM fica preservada depois da criação.
            </p>
          </div>
        </div>

        <form
          className="stack-form"
          onSubmit={submitCampaign}
        >
          <div className="form-grid">
            <label>
              Nome da campanha
              <input
                maxLength="140"
                onChange={(event) =>
                  updateCampaignForm(
                    "nome",
                    event.target.value
                  )
                }
                placeholder="Ex.: Cílios Goiânia Agosto"
                required
                value={campaignForm.nome}
              />
            </label>

            <label>
              Canal
              <select
                onChange={(event) =>
                  updateCampaignForm(
                    "canal",
                    event.target.value
                  )
                }
                value={campaignForm.canal}
              >
                {Object.entries(CHANNELS)
                  .map(
                    ([value, item]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {item.label}
                      </option>
                    )
                  )}
              </select>
            </label>

            <label>
              Origem UTM
              <input
                maxLength="80"
                onChange={(event) =>
                  updateCampaignForm(
                    "utmSource",
                    event.target.value
                  )
                }
                placeholder="Ex.: meta"
                required
                value={campaignForm.utmSource}
              />
            </label>

            <label>
              Mídia UTM
              <input
                maxLength="80"
                onChange={(event) =>
                  updateCampaignForm(
                    "utmMedium",
                    event.target.value
                  )
                }
                placeholder="Ex.: cpc"
                required
                value={campaignForm.utmMedium}
              />
            </label>

            <label className="field-wide">
              Destino dentro do AF
              <input
                maxLength="500"
                onChange={(event) =>
                  updateCampaignForm(
                    "destinoPath",
                    event.target.value
                  )
                }
                placeholder="/ ou /negocio/nome-do-negocio"
                required
                value={campaignForm.destinoPath}
              />
              <small>
                Use apenas caminhos internos iniciados por /.
              </small>
            </label>

            <label>
              Identificador UTM
              <input
                maxLength="140"
                onChange={(event) =>
                  updateCampaignForm(
                    "utmCampaign",
                    event.target.value
                  )
                }
                placeholder={
                  tokenPreview(
                    campaignForm.nome
                  ) ||
                  "gerado pelo nome"
                }
                value={campaignForm.utmCampaign}
              />
              <small>
                {campaignIdentifier
                  ? `Será usado: ${campaignIdentifier}`
                  : "Se ficar vazio, será gerado pelo nome."}
              </small>
            </label>

            <label>
              Conteúdo / criativo
              <input
                maxLength="140"
                onChange={(event) =>
                  updateCampaignForm(
                    "utmContent",
                    event.target.value
                  )
                }
                placeholder="Ex.: video_01"
                value={campaignForm.utmContent}
              />
            </label>

            <label>
              Termo UTM
              <input
                maxLength="140"
                onChange={(event) =>
                  updateCampaignForm(
                    "utmTerm",
                    event.target.value
                  )
                }
                placeholder="Opcional"
                value={campaignForm.utmTerm}
              />
            </label>
          </div>

          {campaignError && (
            <p
              className="form-error"
              role="alert"
            >
              {campaignError}
            </p>
          )}

          {campaignMessage && (
            <p
              className="form-success"
              role="status"
            >
              {campaignMessage}
            </p>
          )}

          <div className="form-actions">
            <button
              className="button"
              disabled={
                campaignStatus ===
                "loading"
              }
              type="submit"
            >
              {campaignStatus === "loading"
                ? "Criando..."
                : "Criar campanha e link"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">
              Links do AF
            </p>
            <h2>Campanhas cadastradas</h2>
          </div>
        </div>

        {data.managedCampaigns.length === 0 ? (
          <p className="muted">
            Nenhuma campanha cadastrada ainda.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th>Canal</th>
                  <th>UTM</th>
                  <th>Destino</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.managedCampaigns.map(
                  (item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>
                          {item.nome}
                        </strong>
                      </td>
                      <td>
                        {CHANNELS[item.canal]
                          ?.label ||
                          item.canal}
                      </td>
                      <td>
                        <code>
                          {item.utmSource}/
                          {item.utmMedium}/
                          {item.utmCampaign}
                        </code>
                      </td>
                      <td>
                        {item.destinoPath}
                      </td>
                      <td>
                        {item.ativo
                          ? "Ativa"
                          : "Arquivada"}
                      </td>
                      <td>
                        <div className="quick-actions">
                          <button
                            className="button button-secondary button-small"
                            onClick={() =>
                              copyCampaignLink(
                                item
                              )
                            }
                            type="button"
                          >
                            {copiedCampaignId === item.id
                              ? "Copiado"
                              : "Copiar link"}
                          </button>
                          <button
                            className="text-button"
                            disabled={
                              campaignActionId ===
                              item.id
                            }
                            onClick={() =>
                              toggleCampaign(
                                item
                              )
                            }
                            type="button"
                          >
                            {campaignActionId === item.id
                              ? "Salvando..."
                              : item.ativo
                                ? "Arquivar"
                                : "Reativar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
