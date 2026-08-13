import {
  useEffect,
  useMemo,
  useState
} from "react";
import { apiRequest } from "../api/client";
import {
  ErrorState,
  LoadingState
} from "../components/ScreenState";
import { settleRequestMap } from "../utils/asyncData";
import {
  countPaidSessionsWithoutCampaign,
  isPaidTrafficWithoutCampaign,
  managedChannelForSource
} from "../utils/marketingAttribution";

const PERIODS = [
  ["today", "Hoje"],
  ["7", "7 dias"],
  ["30", "30 dias"],
  ["month", "Este mês"],
  ["all", "Todo período"]
];

const CHANNELS = {
  meta: { label: "Meta", source: "meta", medium: "cpc" },
  google: { label: "Google", source: "google", medium: "cpc" },
  pinterest: { label: "Pinterest", source: "pinterest", medium: "cpc" },
  tiktok: { label: "TikTok", source: "tiktok", medium: "cpc" },
  outro: { label: "Outro", source: "", medium: "cpc" }
};

const OBJECTIVES = {
  profissional: "Aquisição de profissionais",
  cliente: "Aquisição de clientes"
};

const INITIAL_CAMPAIGN = {
  nome: "",
  canal: "meta",
  objetivo: "",
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
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function campaignLabel(item) {
  const campaign = item?.campanha || "(sem campanha)";
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
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Não foi possível copiar o link.");
}

export function AdminMarketingPage() {
  const [period, setPeriod] = useState("30");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(true);
  const [campaignForm, setCampaignForm] = useState(INITIAL_CAMPAIGN);
  const [campaignStatus, setCampaignStatus] = useState("idle");
  const [campaignMessage, setCampaignMessage] = useState("");
  const [campaignError, setCampaignError] = useState("");
  const [campaignActionId, setCampaignActionId] = useState(null);
  const [classifyingCampaignId, setClassifyingCampaignId] = useState(null);
  const [copiedCampaignId, setCopiedCampaignId] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setError("");
    setRefreshing(true);

    settleRequestMap({
      summary: apiRequest(`/admin/marketing/resumo?periodo=${period}`, {
        signal: controller.signal
      }),
      campaigns: apiRequest(`/admin/marketing/campanhas?periodo=${period}`, {
        signal: controller.signal
      }),
      conversions: apiRequest(`/admin/marketing/conversoes?periodo=${period}`, {
        signal: controller.signal
      }),
      managedCampaigns: apiRequest("/admin/marketing/gestao-campanhas", {
        signal: controller.signal
      })
    })
      .then(({ values, errors }) => {
        if (!active) return;

        if (Object.keys(values).length === 0) {
          setError(
            errors[0]?.error?.message ||
              "Não foi possível carregar os dados de marketing."
          );
          return;
        }

        setData((current) => ({
          summary: values.summary || current?.summary || {},
          campaigns: values.campaigns?.campanhas || current?.campaigns || [],
          conversions:
            values.conversions?.conversoes || current?.conversions || [],
          managedCampaigns:
            values.managedCampaigns?.campanhas ||
            current?.managedCampaigns ||
            []
        }));

        if (errors.some(({ error: itemError }) => itemError?.name !== "AbortError")) {
          setError(
            "Parte dos dados de marketing está temporariamente indisponível."
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

  function selectPeriod(value) {
    if (value !== period) setPeriod(value);
  }

  function updateCampaignForm(field, value) {
    setCampaignMessage("");
    setCampaignError("");

    if (field === "canal") {
      const preset = CHANNELS[value] || CHANNELS.outro;
      setCampaignForm((current) => ({
        ...current,
        canal: value,
        utmSource: preset.source,
        utmMedium: preset.medium
      }));
      return;
    }

    setCampaignForm((current) => ({ ...current, [field]: value }));
  }

  async function submitCampaign(event) {
    event.preventDefault();
    if (campaignStatus === "loading") return;

    setCampaignStatus("loading");
    setCampaignError("");
    setCampaignMessage("");

    const payload = {
      nome: campaignForm.nome,
      canal: campaignForm.canal,
      objetivo: campaignForm.objetivo,
      utmSource: campaignForm.utmSource,
      utmMedium: campaignForm.utmMedium,
      destinoPath: campaignForm.destinoPath,
      utmContent: campaignForm.utmContent,
      utmTerm: campaignForm.utmTerm,
      ...(campaignForm.utmCampaign.trim()
        ? { utmCampaign: campaignForm.utmCampaign }
        : {})
    };

    try {
      const result = await apiRequest("/admin/marketing/gestao-campanhas", {
        method: "POST",
        body: payload
      });

      setData((current) => ({
        ...current,
        managedCampaigns: [
          result.campanha,
          ...(current?.managedCampaigns || []).filter(
            (item) => item.id !== result.campanha.id
          )
        ]
      }));
      setCampaignForm(INITIAL_CAMPAIGN);
      setCampaignMessage(
        "Campanha criada. O link rastreável já está pronto para uso."
      );
    } catch (requestError) {
      setCampaignError(requestError.message);
    } finally {
      setCampaignStatus("idle");
    }
  }

  async function updateCampaign(item, body) {
    if (campaignActionId) return null;

    setCampaignActionId(item.id);
    setCampaignError("");
    setCampaignMessage("");

    try {
      const result = await apiRequest(
        `/admin/marketing/gestao-campanhas/${item.id}`,
        { method: "PATCH", body }
      );

      setData((current) => ({
        ...current,
        managedCampaigns: (current?.managedCampaigns || []).map((campaign) =>
          campaign.id === item.id ? result.campanha : campaign
        )
      }));
      return result.campanha;
    } catch (requestError) {
      setCampaignError(requestError.message);
      return null;
    } finally {
      setCampaignActionId(null);
    }
  }

  async function toggleCampaign(item) {
    await updateCampaign(item, { ativo: !item.ativo });
  }

  async function classifyCampaign(item, objetivo) {
    const label = OBJECTIVES[objetivo];
    if (!label) return;

    const confirmed = window.confirm(
      `Definir esta campanha como “${label}”? Essa classificação ficará travada para preservar os relatórios históricos.`
    );
    if (!confirmed) return;

    const updated = await updateCampaign(item, { objetivo });
    if (updated) {
      setClassifyingCampaignId(null);
      setCampaignMessage(`Objetivo definido como ${label}.`);
    }
  }

  async function copyCampaignLink(item) {
    setCampaignError("");
    try {
      await copyText(item.linkRastreavel);
      setCopiedCampaignId(item.id);
    } catch (copyError) {
      setCampaignError(copyError.message);
    }
  }

  function reviewClassification(item) {
    setClassifyingCampaignId(item.id);
    document
      .getElementById("campanhas-cadastradas")
      ?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  const managedCampaigns = data?.managedCampaigns || [];
  const campaigns = data?.campaigns || [];

  const paidWithoutCampaign = useMemo(
    () => campaigns.filter(isPaidTrafficWithoutCampaign),
    [campaigns]
  );
  const paidWithoutCampaignSessions = useMemo(
    () => countPaidSessionsWithoutCampaign(campaigns),
    [campaigns]
  );
  const unclassifiedCampaigns = useMemo(
    () => managedCampaigns.filter((item) => !OBJECTIVES[item.objetivo]),
    [managedCampaigns]
  );
  const suggestedCampaign = useMemo(() => {
    const channels = [
      ...new Set(
        paidWithoutCampaign
          .map((item) => managedChannelForSource(item.origem))
          .filter(Boolean)
      )
    ];
    if (channels.length !== 1) return null;

    const candidates = managedCampaigns.filter(
      (item) => item.ativo && item.canal === channels[0]
    );
    return candidates.length === 1 ? candidates[0] : null;
  }, [managedCampaigns, paidWithoutCampaign]);

  if (!data && !error) {
    return (
      <main className="workspace-page admin-workspace-page admin-marketing-page admin-campaigns-page">
        <LoadingState>Carregando marketing...</LoadingState>
      </main>
    );
  }

  if (!data && error) {
    return (
      <main className="workspace-page admin-workspace-page admin-marketing-page admin-campaigns-page">
        <ErrorState
          message={error}
          onRetry={() => setReloadKey((current) => current + 1)}
        />
      </main>
    );
  }

  const summary = data.summary || {};
  const cards = [
    ["Sessões atribuídas", summary.sessoes ?? 0, "visitas com origem identificada"],
    ["Campanhas", summary.campanhas ?? 0, "origem + mídia + campanha"],
    ["Agendamentos iniciados", summary.agendamentosIniciados ?? 0, "entraram no fluxo"],
    [
      "Agendamentos concluídos",
      summary.agendamentosConcluidos ?? 0,
      `${summary.taxaConversao ?? 0}% das sessões`
    ]
  ];

  const campaignIdentifier =
    campaignForm.utmCampaign.trim() || tokenPreview(campaignForm.nome);

  return (
    <main
      aria-busy={refreshing}
      className="workspace-page admin-workspace-page admin-marketing-page admin-campaigns-page"
    >
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">Administração do AF</p>
          <h1>Campanhas e tráfego pago</h1>
          <p>
            Crie links de aquisição para clientes e profissionais sem misturar o objetivo dos relatórios.
          </p>
        </div>

        <div className="segmented-control" aria-label="Período do marketing">
          {PERIODS.map(([value, label]) => (
            <button
              aria-pressed={period === value}
              className={period === value ? "active" : ""}
              key={value}
              onClick={() => selectPeriod(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {refreshing && (
        <p className="data-refresh-status" role="status">
          Atualizando dados de marketing...
        </p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}

      <section className="metric-grid" aria-label="Indicadores de marketing">
        {cards.map(([label, value, hint]) => (
          <article className="metric-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
          </article>
        ))}
      </section>

      {(paidWithoutCampaignSessions > 0 || unclassifiedCampaigns.length > 0) && (
        <section className="panel" aria-label="Pendências de rastreamento">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Atenção operacional</p>
              <h2>Pendências que afetam a leitura dos KPIs</h2>
            </div>
          </div>

          {paidWithoutCampaignSessions > 0 && (
            <div>
              <strong>
                {paidWithoutCampaignSessions} sessão(ões) paga(s) sem identificação de campanha
              </strong>
              <p className="muted">
                A origem e a mídia foram identificadas, mas o acesso chegou sem utm_campaign. Essas sessões aparecem no tráfego geral, porém não entram no resultado de uma campanha cadastrada.
              </p>
              {suggestedCampaign && (
                <button
                  className="button button-secondary button-small"
                  onClick={() => copyCampaignLink(suggestedCampaign)}
                  type="button"
                >
                  {copiedCampaignId === suggestedCampaign.id
                    ? "Link copiado"
                    : `Copiar link de ${suggestedCampaign.nome}`}
                </button>
              )}
            </div>
          )}

          {paidWithoutCampaignSessions > 0 && unclassifiedCampaigns.length > 0 && <hr />}

          {unclassifiedCampaigns.length > 0 && (
            <div>
              <strong>
                {unclassifiedCampaigns.length} campanha(s) precisa(m) de classificação
              </strong>
              <p className="muted">
                Classifique o objetivo para que investimento, CPA, CAC e ROAS sejam calculados no relatório correto.
              </p>
              <button
                className="button button-secondary button-small"
                onClick={() => reviewClassification(unclassifiedCampaigns[0])}
                type="button"
              >
                Revisar classificação
              </button>
            </div>
          )}
        </section>
      )}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Nova campanha</p>
            <h2>Gerar link rastreável</h2>
            <p className="muted">
              Preencha primeiro o que define a campanha. Os parâmetros UTM técnicos ficam em configurações avançadas e continuam disponíveis quando necessário.
            </p>
          </div>
        </div>

        <form className="stack-form" onSubmit={submitCampaign}>
          <div className="form-grid">
            <label>
              Nome da campanha
              <input
                maxLength="140"
                onChange={(event) => updateCampaignForm("nome", event.target.value)}
                placeholder="Ex.: Cílios Goiânia Agosto"
                required
                value={campaignForm.nome}
              />
            </label>

            <label>
              Objetivo
              <select
                onChange={(event) =>
                  updateCampaignForm("objetivo", event.target.value)
                }
                required
                value={campaignForm.objetivo}
              >
                <option value="">Selecione o objetivo</option>
                {Object.entries(OBJECTIVES).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <small>
                Profissionais mede aquisição e assinatura; clientes mede agendamento.
              </small>
            </label>

            <label>
              Canal
              <select
                onChange={(event) => updateCampaignForm("canal", event.target.value)}
                value={campaignForm.canal}
              >
                {Object.entries(CHANNELS).map(([value, item]) => (
                  <option key={value} value={value}>{item.label}</option>
                ))}
              </select>
            </label>

            <label>
              Destino dentro do AF
              <input
                maxLength="500"
                onChange={(event) =>
                  updateCampaignForm("destinoPath", event.target.value)
                }
                placeholder="/ ou /negocio/nome-do-negocio"
                required
                value={campaignForm.destinoPath}
              />
              <small>Use apenas caminhos internos iniciados por /.</small>
            </label>
          </div>

          <details className="admin-advanced-fields">
            <summary>Configurações avançadas de rastreamento</summary>
            <div className="form-grid">
              <label>
                Origem UTM
                <input
                  maxLength="80"
                  onChange={(event) => updateCampaignForm("utmSource", event.target.value)}
                  placeholder="Ex.: meta"
                  required
                  value={campaignForm.utmSource}
                />
              </label>
              <label>
                Mídia UTM
                <input
                  maxLength="80"
                  onChange={(event) => updateCampaignForm("utmMedium", event.target.value)}
                  placeholder="Ex.: cpc"
                  required
                  value={campaignForm.utmMedium}
                />
              </label>
              <label>
                Identificador UTM
                <input
                  maxLength="140"
                  onChange={(event) =>
                    updateCampaignForm("utmCampaign", event.target.value)
                  }
                  placeholder={tokenPreview(campaignForm.nome) || "gerado pelo nome"}
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
                    updateCampaignForm("utmContent", event.target.value)
                  }
                  placeholder="Ex.: video_01"
                  value={campaignForm.utmContent}
                />
              </label>
              <label>
                Termo UTM
                <input
                  maxLength="140"
                  onChange={(event) => updateCampaignForm("utmTerm", event.target.value)}
                  placeholder="Opcional"
                  value={campaignForm.utmTerm}
                />
              </label>
            </div>
          </details>

          {campaignError && <p className="form-error" role="alert">{campaignError}</p>}
          {campaignMessage && (
            <p className="form-success" role="status">{campaignMessage}</p>
          )}

          <div className="form-actions">
            <button
              className="button"
              disabled={campaignStatus === "loading"}
              type="submit"
            >
              {campaignStatus === "loading" ? "Criando..." : "Criar campanha e link"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel" id="campanhas-cadastradas">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Links do AF</p>
            <h2>Campanhas cadastradas</h2>
            <p className="muted">
              Campanhas antigas precisam ser classificadas uma vez antes de entrarem nos KPIs específicos do objetivo.
            </p>
          </div>
        </div>

        {managedCampaigns.length === 0 ? (
          <p className="muted">Nenhuma campanha cadastrada ainda.</p>
        ) : (
          <div className="table-wrap admin-campaign-table">
            <table>
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th>Objetivo</th>
                  <th>Canal</th>
                  <th>UTM</th>
                  <th>Destino</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {managedCampaigns.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.nome}</strong></td>
                    <td className="admin-objective-cell">
                      {OBJECTIVES[item.objetivo] ? (
                        <span className="admin-status-badge">
                          {OBJECTIVES[item.objetivo]}
                        </span>
                      ) : (
                        <div className="admin-classification-actions">
                          <span className="admin-status-badge is-muted">
                            Não classificado
                          </span>
                          {classifyingCampaignId === item.id ? (
                            <>
                              <small className="muted">
                                Escolha uma vez. Depois o objetivo fica travado para preservar o histórico.
                              </small>
                              <div className="admin-classification-options">
                                <button
                                  className="button button-secondary button-small"
                                  disabled={campaignActionId === item.id}
                                  onClick={() => classifyCampaign(item, "profissional")}
                                  type="button"
                                >
                                  Profissional
                                </button>
                                <button
                                  className="button button-secondary button-small"
                                  disabled={campaignActionId === item.id}
                                  onClick={() => classifyCampaign(item, "cliente")}
                                  type="button"
                                >
                                  Cliente
                                </button>
                                <button
                                  className="text-button"
                                  onClick={() => setClassifyingCampaignId(null)}
                                  type="button"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </>
                          ) : (
                            <button
                              className="button button-secondary button-small"
                              onClick={() => setClassifyingCampaignId(item.id)}
                              type="button"
                            >
                              Classificar campanha
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td>{CHANNELS[item.canal]?.label || item.canal}</td>
                    <td>
                      <code>
                        {item.utmSource}/{item.utmMedium}/{item.utmCampaign}
                      </code>
                    </td>
                    <td>{item.destinoPath}</td>
                    <td>
                      <span
                        className={`admin-status-badge ${item.ativo ? "is-success" : "is-muted"}`}
                      >
                        {item.ativo ? "Ativa" : "Arquivada"}
                      </span>
                    </td>
                    <td>
                      <div className="quick-actions">
                        <button
                          className="button button-secondary button-small"
                          onClick={() => copyCampaignLink(item)}
                          type="button"
                        >
                          {copiedCampaignId === item.id ? "Copiado" : "Copiar link"}
                        </button>
                        <details>
                          <summary className="button button-secondary button-small">
                            Mais
                          </summary>
                          <button
                            className="text-button"
                            disabled={campaignActionId === item.id}
                            onClick={() => toggleCampaign(item)}
                            type="button"
                          >
                            {campaignActionId === item.id
                              ? "Salvando..."
                              : item.ativo
                                ? "Arquivar"
                                : "Reativar"}
                          </button>
                        </details>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Aquisição</p>
            <h2>Desempenho por campanha</h2>
          </div>
        </div>

        {campaigns.length === 0 ? (
          <p className="muted">Ainda não há sessões atribuídas neste período.</p>
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
                {campaigns.map((item, index) => (
                  <tr key={`${item.origem}-${item.midia}-${item.campanha}-${index}`}>
                    <td>
                      {campaignLabel(item)}
                      {isPaidTrafficWithoutCampaign(item) && (
                        <>
                          <br />
                          <small className="muted">Falta utm_campaign</small>
                        </>
                      )}
                    </td>
                    <td>{item.origem}</td>
                    <td>{item.midia}</td>
                    <td>{item.sessoes}</td>
                    <td>{item.perfisVisualizados}</td>
                    <td>{item.agendamentosIniciados}</td>
                    <td>{item.agendamentosConcluidos}</td>
                    <td>{item.taxaConversao}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Conversões</p>
            <h2>Agendamentos atribuídos</h2>
          </div>
        </div>

        {data.conversions.length === 0 ? (
          <p className="muted">Nenhum agendamento atribuído neste período.</p>
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
                {data.conversions.map((item) => (
                  <tr key={item.eventoId}>
                    <td>{formatDateTime(item.createdAt)}</td>
                    <td>{campaignLabel(item)}</td>
                    <td>{item.negocioNome || "Negócio indisponível"}</td>
                    <td>{item.agendamentoId ? `#${item.agendamentoId}` : "—"}</td>
                    <td>{item.landingPage || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
