import {
  useEffect,
  useMemo,
  useState
} from "react";
import { apiRequest } from "../api/client";
import { MarketingBarChart } from "../components/MarketingBarChart";
import { MarketingExecutivePanel } from "../components/MarketingExecutivePanel";
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
import {
  formatMetricPercent,
  metricPercentage,
  paidAttributionQuality
} from "../utils/marketingMetrics";

const PERIODS = [
  ["today", "Hoje"],
  ["7", "7 dias"],
  ["30", "30 dias"],
  ["month", "Este mês"],
  ["all", "Todo período"]
];

const CHANNELS = {
  meta: { label: "Meta Ads", source: "meta", medium: "cpc" },
  google: { label: "Google Ads", source: "google", medium: "cpc" },
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
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function pluralize(count, singular, plural) {
  return `${count} ${Number(count) === 1 ? singular : plural}`;
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function titleCase(value) {
  const text = String(value || "").trim();
  if (!text) return "Não identificada";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function sourceLabel(value) {
  const source = normalize(value);
  if (source === "google") return "Google Ads";
  if (["meta", "facebook", "instagram"].includes(source)) return "Meta Ads";
  if (source === "pinterest") return "Pinterest";
  if (source === "tiktok") return "TikTok";
  if (["organico", "orgânico"].includes(source)) return "Orgânico";
  return titleCase(source);
}

function mediumLabel(value) {
  const medium = normalize(value);
  const labels = {
    cpc: "CPC",
    ppc: "PPC",
    paid: "Mídia paga",
    paid_search: "Busca paga",
    paid_social: "Social pago",
    "paid-social": "Social pago",
    social_paid: "Social pago",
    display: "Display"
  };

  return labels[medium] || titleCase(medium.replaceAll("_", " "));
}

function sourceCode(value) {
  const source = normalize(value);
  if (source === "google") return "google";
  if (["meta", "facebook", "instagram"].includes(source)) return "meta";
  if (source === "pinterest") return "pinterest";
  if (source === "tiktok") return "tiktok";
  if (["organico", "orgânico"].includes(source)) return "organico";
  return "outro";
}

function canonicalSource(value) {
  return managedChannelForSource(value) || normalize(value);
}

function performanceIdentity(item) {
  return [
    canonicalSource(item?.origem),
    normalize(item?.midia),
    normalize(item?.campanha)
  ].join("|");
}

function managedIdentity(item) {
  return [
    canonicalSource(item?.utmSource),
    normalize(item?.utmMedium),
    normalize(item?.utmCampaign)
  ].join("|");
}

function hasBackendAttributionClassification(item) {
  return Object.prototype.hasOwnProperty.call(
    item || {},
    "oficial"
  );
}

function isMissingCampaign(value) {
  return ["", "(sem campanha)", "sem campanha"].includes(normalize(value));
}

function campaignLabel(item) {
  const campaign = String(item?.campanha || "").trim();
  return campaign && !isMissingCampaign(campaign)
    ? campaign
    : "Campanha não identificada";
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

function aggregateBySource(campaigns) {
  const groups = new Map();

  campaigns.forEach((item) => {
    const key = canonicalSource(item.origem) || "nao_identificada";
    const current = groups.get(key) || {
      key,
      label: sourceLabel(item.origem),
      sessoes: 0,
      perfisVisualizados: 0,
      campaignKeys: new Set()
    };

    current.sessoes += Number(item.sessoes || 0);
    current.perfisVisualizados += Number(item.perfisVisualizados || 0);
    current.campaignKeys.add(performanceIdentity(item));
    groups.set(key, current);
  });

  return [...groups.values()]
    .map(({ campaignKeys, ...item }) => ({
      ...item,
      campanhas: campaignKeys.size
    }))
    .sort((a, b) => b.sessoes - a.sessoes);
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
  const [campaignCreatorOpen, setCampaignCreatorOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

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

        const criticalKeys = [
          "summary",
          "campaigns",
          "managedCampaigns"
        ];
        const criticalDataReady = criticalKeys.every(
          (key) => Object.prototype.hasOwnProperty.call(values, key)
        );

        if (!criticalDataReady) {
          const criticalError = errors.find(({ key }) =>
            criticalKeys.includes(key)
          );
          setError(
            criticalError?.error?.message ||
              "Não foi possível carregar os dados de marketing."
          );
          return;
        }

        setData({
          summary: values.summary,
          campaigns: values.campaigns?.campanhas || [],
          conversions: values.conversions?.conversoes || [],
          managedCampaigns:
            values.managedCampaigns?.campanhas || []
        });

        if (errors.some(({ error: itemError }) => itemError?.name !== "AbortError")) {
          setError("Parte dos dados de marketing está temporariamente indisponível.");
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
    if (value === period) return;
    setData(null);
    setError("");
    setPeriod(value);
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
      setCampaignMessage("Campanha oficial criada. O link rastreável já está pronto para uso.");
      setCampaignCreatorOpen(false);
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
    const updated = await updateCampaign(item, { ativo: !item.ativo });
    if (updated) {
      setCampaignMessage(
        updated.ativo
          ? "Campanha oficial reativada."
          : "Campanha arquivada. O histórico continua nos indicadores oficiais."
      );
    }
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

  const summary = data?.summary || {};
  const managedCampaigns = data?.managedCampaigns || [];
  const campaigns = data?.campaigns || [];
  const conversions = data?.conversions || [];

  const activeOfficialCampaigns = useMemo(
    () => managedCampaigns.filter((item) => item.ativo !== false),
    [managedCampaigns]
  );

  const officialIdentitySet = useMemo(
    () => new Set(managedCampaigns.map(managedIdentity)),
    [managedCampaigns]
  );

  const objectiveByIdentity = useMemo(
    () => new Map(
      managedCampaigns.map((item) => [
        managedIdentity(item),
        item.objetivo || "indefinido"
      ])
    ),
    [managedCampaigns]
  );

  const officialPerformance = useMemo(
    () => campaigns.filter(
      (item) => hasBackendAttributionClassification(item)
        ? item.oficial === true
        : officialIdentitySet.has(performanceIdentity(item))
    ),
    [campaigns, officialIdentitySet]
  );

  const paidWithoutCampaign = useMemo(
    () => campaigns.filter(isPaidTrafficWithoutCampaign),
    [campaigns]
  );

  const paidWithoutCampaignSessions = useMemo(
    () => countPaidSessionsWithoutCampaign(campaigns),
    [campaigns]
  );

  const unofficialAttributed = useMemo(
    () => campaigns.filter(
      (item) => {
        if (hasBackendAttributionClassification(item)) {
          return item.classificacaoAtribuicao ===
            "identidade_nao_oficial";
        }

        return !officialIdentitySet.has(performanceIdentity(item)) &&
          !isPaidTrafficWithoutCampaign(item);
      }
    ),
    [campaigns, officialIdentitySet]
  );

  const unofficialAttributedSessions = useMemo(
    () => unofficialAttributed.reduce(
      (total, item) => total + Number(item.sessoes || 0),
      0
    ),
    [unofficialAttributed]
  );

  const officialConversions = useMemo(
    () => conversions.filter(
      (item) => {
        const official = hasBackendAttributionClassification(item)
          ? item.oficial === true
          : officialIdentitySet.has(performanceIdentity(item));
        const objective = item.objetivo ||
          objectiveByIdentity.get(performanceIdentity(item));

        return official && objective === "cliente";
      }
    ),
    [conversions, objectiveByIdentity, officialIdentitySet]
  );

  const acquisitionBySource = useMemo(
    () => aggregateBySource(officialPerformance),
    [officialPerformance]
  );

  const unclassifiedCampaigns = useMemo(
    () => activeOfficialCampaigns.filter((item) => !OBJECTIVES[item.objetivo]),
    [activeOfficialCampaigns]
  );

  const archivedCampaigns = useMemo(
    () => managedCampaigns.filter((item) => item.ativo === false),
    [managedCampaigns]
  );

  const visibleManagedCampaigns = useMemo(
    () => showArchived
      ? managedCampaigns
      : activeOfficialCampaigns,
    [managedCampaigns, activeOfficialCampaigns, showArchived]
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

    const candidates = activeOfficialCampaigns.filter(
      (item) => item.canal === channels[0]
    );
    return candidates.length === 1 ? candidates[0] : null;
  }, [activeOfficialCampaigns, paidWithoutCampaign]);

  const officialSessions = useMemo(
    () => officialPerformance.reduce(
      (total, item) => total + Number(item.sessoes || 0),
      0
    ),
    [officialPerformance]
  );

  const assistedOfficialSessions = useMemo(
    () => officialPerformance.reduce(
      (total, item) =>
        total + Math.min(
          Number(item.sessoes || 0),
          Math.max(0, Number(item.sessoesAtribuicaoAssistida || 0))
        ),
      0
    ),
    [officialPerformance]
  );

  const directOfficialSessions = Math.max(
    0,
    officialSessions - assistedOfficialSessions
  );

  const officialCompleted = useMemo(
    () => officialPerformance
      .filter((item) => (
        item.objetivo || objectiveByIdentity.get(performanceIdentity(item))
      ) === "cliente")
      .reduce(
        (total, item) => total + Number(item.agendamentosConcluidos || 0),
        0
      ),
    [objectiveByIdentity, officialPerformance]
  );

  const autonomousSessions = Number(summary.sessoesSemAtribuicao || 0);
  const attributionQuality = paidAttributionQuality({
    official: officialSessions,
    missingCampaign: paidWithoutCampaignSessions,
    unofficialIdentity: unofficialAttributedSessions
  });
  const attributionTone = attributionQuality.detectedPaidSessions === 0
    ? "neutral"
    : attributionQuality.coverage < 80
      ? "critical"
      : attributionQuality.coverage < 100
        ? "warning"
        : "success";
  const attributionStatus = attributionQuality.detectedPaidSessions === 0
    ? "Sem volume pago"
    : attributionQuality.coverage < 80
      ? "Atribuição crítica"
      : attributionQuality.coverage < 100
        ? "Atribuição em atenção"
        : "Atribuição saudável";

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

  const cards = [
    [
      "Sessões atribuídas",
      officialSessions,
      assistedOfficialSessions > 0
        ? `${directOfficialSessions} diretas + ${assistedOfficialSessions} assistidas`
        : "visitas vinculadas diretamente a campanhas verificadas"
    ],
    [
      "Cobertura de atribuição",
      formatMetricPercent(attributionQuality.coverage),
      `${attributionQuality.officialSessions} de ${attributionQuality.detectedPaidSessions} sessões detectadas`
    ],
    [
      "Campanhas monitoradas",
      activeOfficialCampaigns.length,
      "estado atual das campanhas oficiais"
    ],
    [
      "Conversões de clientes",
      officialCompleted,
      "somente campanhas com objetivo cliente"
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
            Monitore aquisição, cobertura de atribuição e conversões sem misturar acessos orgânicos ou diretos.
          </p>
        </div>

        <div className="admin-heading-actions">
          <button
            aria-expanded={campaignCreatorOpen}
            className="button button-secondary admin-new-campaign-button"
            onClick={() => setCampaignCreatorOpen((current) => !current)}
            type="button"
          >
            {campaignCreatorOpen ? "Fechar criação" : "+ Nova campanha oficial"}
          </button>
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
        </div>
      </header>

      {refreshing && (
        <p className="data-refresh-status" role="status">
          Atualizando dados de marketing...
        </p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {campaignError && <p className="form-error" role="alert">{campaignError}</p>}
      {campaignMessage && <p className="form-success" role="status">{campaignMessage}</p>}

      <section className="metric-grid" aria-label="Indicadores de marketing">
        {cards.map(([label, value, hint]) => (
          <article className="metric-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
          </article>
        ))}
      </section>

      <MarketingExecutivePanel
        action={attributionQuality.pendingSessions > 0
          ? "use somente o link oficial nas campanhas e valide se utm_campaign ou o identificador de clique chega à landing page."
          : assistedOfficialSessions > 0
            ? "mantenha os vínculos com as plataformas atualizados; eles recuperam sessões sem UTM de campanha sem esconder a origem da resolução."
            : "acompanhe o avanço por objetivo e mantenha as UTMs oficiais sem alterações."}
        metrics={[
          {
            label: "Atribuição direta",
            value: directOfficialSessions,
            hint: "UTM oficial reconhecida"
          },
          {
            label: "Atribuição assistida",
            value: assistedOfficialSessions,
            hint: "vínculo verificado da plataforma"
          },
          {
            label: "Pendências reais",
            value: attributionQuality.pendingSessions,
            hint: "sem resolução segura"
          },
          {
            label: "Acessos autônomos",
            value: autonomousSessions,
            hint: "direto, orgânico ou link compartilhado"
          }
        ]}
        status={attributionStatus}
        summary={attributionQuality.detectedPaidSessions === 0
          ? "Ainda não existe tráfego pago detectado no período selecionado."
          : attributionQuality.pendingSessions > 0
            ? `${formatMetricPercent(attributionQuality.coverage)} do tráfego pago detectado está ligado a campanhas verificadas. Resultados por campanha podem estar subestimados até a correção das pendências.`
            : assistedOfficialSessions > 0
              ? `Cobertura integral: ${directOfficialSessions} sessões foram atribuídas diretamente e ${assistedOfficialSessions} por vínculo verificado com a plataforma.`
              : "Todo o tráfego pago detectado está ligado diretamente a campanhas verificadas e pronto para análise por objetivo."}
        title="Qualidade da medição paga"
        tone={attributionTone}
      />

      <section className="panel" aria-label="Como o AF classifica os acessos">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Como ler o painel</p>
            <h2>Atribuído, autônomo ou pendente</h2>
            <p className="muted">
              Cada acesso entra em uma categoria diferente. Uma categoria nunca é somada à outra.
            </p>
            <p className="muted">
              A atribuição usa o primeiro contato registrado em uma janela fixa de 30 dias. O último contato também é preservado para auditoria.
            </p>
          </div>
        </div>

        <div className="admin-pending-list">
          <div className="admin-pending-item">
            <div>
              <strong>Campanha atribuída</strong>
              <small>
                Reconhecida pela UTM oficial ou por um vínculo único e verificado com a plataforma. Entra nos KPIs de mídia paga.
              </small>
            </div>
          </div>

          <div className="admin-pending-item">
            <div>
              <strong>Acesso autônomo · {autonomousSessions}</strong>
              <small>
                Chegou sem origem, campanha UTM ou identificador de anúncio. Pode ser acesso direto, busca orgânica ou link compartilhado. Não é considerado anúncio pago.
              </small>
            </div>
          </div>

          <div className="admin-pending-item">
            <div>
              <strong>Rastreamento incompleto</strong>
              <small>
                Existe sinal de mídia paga, mas não há uma campanha oficial identificada. Pode ser um anúncio real sem a etiqueta da campanha e fica fora dos KPIs até ser identificado.
              </small>
            </div>
          </div>
        </div>
      </section>

      {(paidWithoutCampaignSessions > 0 || unofficialAttributedSessions > 0 || unclassifiedCampaigns.length > 0) && (
        <section className="admin-pending-strip" aria-label="Pendências de rastreamento">
          <div className="admin-pending-strip-heading">
            <p className="eyebrow">Atenção operacional</p>
            <strong>Dados excluídos dos KPIs oficiais</strong>
          </div>

          <div className="admin-pending-list">
            {paidWithoutCampaignSessions > 0 && (
              <div className="admin-pending-item">
                <div>
                  <strong>
                    {pluralize(
                      paidWithoutCampaignSessions,
                      "sessão paga com rastreamento incompleto",
                      "sessões pagas com rastreamento incompleto"
                    )}
                  </strong>
                  <small>
                    Não são acessos autônomos. Há sinal de mídia paga, mas a campanha oficial não foi recebida. Pode ser anúncio real sem etiqueta.
                  </small>
                </div>
                {suggestedCampaign && (
                  <button
                    aria-label={`Copiar link correto de ${suggestedCampaign.nome}`}
                    className="button button-secondary button-small"
                    onClick={() => copyCampaignLink(suggestedCampaign)}
                    type="button"
                  >
                    {copiedCampaignId === suggestedCampaign.id
                      ? "Link copiado"
                      : "Copiar link oficial"}
                  </button>
                )}
              </div>
            )}

            {unofficialAttributedSessions > 0 && (
              <div className="admin-pending-item">
                <div>
                  <strong>
                    {pluralize(
                      unofficialAttributedSessions,
                      "sessão com identidade não oficial",
                      "sessões com identidade não oficial"
                    )}
                  </strong>
                  <small>
                    Revise a origem e o identificador antes de associar. Enquanto não houver evidência, essas sessões ficam fora do desempenho principal.
                  </small>
                  <ul
                    aria-label="Identidades não oficiais detectadas"
                    className="admin-pending-identities"
                  >
                    {unofficialAttributed.map((item) => (
                      <li key={performanceIdentity(item)}>
                        <div>
                          <code>{campaignLabel(item)}</code>
                          <span>
                            {sourceLabel(item.origem)} · {mediumLabel(item.midia)}
                          </span>
                        </div>
                        <small>
                          {pluralize(
                            item.sessoes,
                            "sessão detectada",
                            "sessões detectadas"
                          )} · última interação {formatDateTime(item.ultimaInteracao)}
                        </small>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {unclassifiedCampaigns.length > 0 && (
              <div className="admin-pending-item">
                <div>
                  <strong>
                    {pluralize(
                      unclassifiedCampaigns.length,
                      "campanha oficial sem objetivo",
                      "campanhas oficiais sem objetivo"
                    )}
                  </strong>
                  <small>Defina o objetivo para manter CAC, CPA e ROAS no relatório correto.</small>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {campaignCreatorOpen && (
        <section className="panel admin-primary-action-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Nova campanha oficial</p>
              <h2>Gerar link rastreável</h2>
              <p className="muted">
                Campanhas criadas aqui passam a ser reconhecidas como oficiais pelo painel.
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
                  placeholder="Ex.: Profissionais Goiânia Agosto"
                  required
                  value={campaignForm.nome}
                />
              </label>

              <label>
                Objetivo
                <select
                  onChange={(event) => updateCampaignForm("objetivo", event.target.value)}
                  required
                  value={campaignForm.objetivo}
                >
                  <option value="">Selecione o objetivo</option>
                  {Object.entries(OBJECTIVES).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <small>Profissionais mede assinatura; clientes mede agendamento.</small>
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
                  onChange={(event) => updateCampaignForm("destinoPath", event.target.value)}
                  placeholder="/ ou /para-profissionais"
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
                    required
                    value={campaignForm.utmSource}
                  />
                </label>
                <label>
                  Mídia UTM
                  <input
                    maxLength="80"
                    onChange={(event) => updateCampaignForm("utmMedium", event.target.value)}
                    required
                    value={campaignForm.utmMedium}
                  />
                </label>
                <label>
                  Identificador UTM
                  <input
                    maxLength="140"
                    onChange={(event) => updateCampaignForm("utmCampaign", event.target.value)}
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
                    onChange={(event) => updateCampaignForm("utmContent", event.target.value)}
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

            <div className="form-actions">
              <button
                className="button"
                disabled={campaignStatus === "loading"}
                type="submit"
              >
                {campaignStatus === "loading" ? "Criando..." : "Criar campanha oficial"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="panel" id="campanhas-cadastradas">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Operação</p>
            <h2>Campanhas oficiais</h2>
            <p className="muted">
              Somente campanhas cadastradas aqui são consideradas oficiais nos indicadores.
            </p>
          </div>
          {archivedCampaigns.length > 0 && (
            <button
              aria-pressed={showArchived}
              className="button button-secondary button-small admin-nowrap-button"
              onClick={() => setShowArchived((current) => !current)}
              type="button"
            >
              {showArchived
                ? "Ocultar arquivadas"
                : `Mostrar arquivadas (${archivedCampaigns.length})`}
            </button>
          )}
        </div>

        {visibleManagedCampaigns.length === 0 ? (
          <p className="muted">Nenhuma campanha oficial ativa.</p>
        ) : (
          <div className="table-wrap admin-campaign-table">
            <table>
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th>Objetivo</th>
                  <th>Rastreamento</th>
                  <th>Destino</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {visibleManagedCampaigns.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.nome}</strong></td>
                    <td className="admin-objective-cell">
                      {OBJECTIVES[item.objetivo] ? (
                        <span className="admin-status-badge">
                          {OBJECTIVES[item.objetivo]}
                        </span>
                      ) : (
                        <div className="admin-classification-actions">
                          <span className="admin-status-badge is-warning">Sem objetivo</span>
                          {classifyingCampaignId === item.id ? (
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
                          ) : (
                            <button
                              className="button button-secondary button-small admin-classify-trigger"
                              onClick={() => setClassifyingCampaignId(item.id)}
                              type="button"
                            >
                              Definir objetivo
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="admin-campaign-source">
                        <span className={`admin-status-badge admin-source-badge is-${sourceCode(item.utmSource)}`}>
                          {CHANNELS[item.canal]?.label || sourceLabel(item.utmSource)}
                        </span>
                        <span className="admin-medium-label">
                          {String(item.utmMedium || "").toUpperCase()}
                        </span>
                      </div>
                      <details className="admin-inline-details">
                        <summary>Ver UTM oficial</summary>
                        <code>{item.utmSource}/{item.utmMedium}/{item.utmCampaign}</code>
                      </details>
                    </td>
                    <td>{item.destinoPath}</td>
                    <td>
                      <span className={`admin-status-badge ${item.ativo ? "is-success" : "is-muted"}`}>
                        {item.ativo ? "Oficial ativa" : "Arquivada"}
                      </span>
                    </td>
                    <td>
                      <div className="quick-actions">
                        <button
                          className="button button-secondary button-small"
                          onClick={() => copyCampaignLink(item)}
                          type="button"
                        >
                          {copiedCampaignId === item.id ? "Copiado" : "Copiar link oficial"}
                        </button>
                        <details className="admin-more-actions">
                          <summary
                            aria-label={`Mais ações de ${item.nome}`}
                            className="button button-secondary button-small"
                          >
                            ⋯
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
            <p className="eyebrow">Estatísticas oficiais</p>
            <h2>Distribuição do tráfego atribuído</h2>
            <p className="muted">
              Volume por origem sem misturar cadastros profissionais com agendamentos de clientes.
            </p>
          </div>
        </div>

        <div className="admin-insights-grid">
          <MarketingBarChart
            title="Sessões atribuídas por origem"
            description="Volume ligado a campanhas verificadas, com atribuição direta ou assistida."
            items={acquisitionBySource.map((item) => ({
              key: item.key,
              label: item.label,
              value: item.sessoes,
              formattedValue: pluralize(item.sessoes, "sessão", "sessões"),
              secondary: `${formatMetricPercent(metricPercentage(item.sessoes, officialSessions))} do tráfego atribuído`
            }))}
            emptyMessage="Nenhuma sessão foi atribuída a campanhas neste período."
          />

          <div className="admin-stat-table-card">
            <div className="admin-stat-table-heading">
              <strong>Resumo atribuído por origem</strong>
              <small>Participação calculada somente sobre sessões vinculadas a campanhas verificadas.</small>
            </div>
            {acquisitionBySource.length === 0 ? (
              <p className="muted">Sem dados oficiais de aquisição no período.</p>
            ) : (
              <div className="table-wrap">
                <table className="admin-compact-table">
                  <thead>
                    <tr>
                      <th>Origem</th>
                      <th>Sessões</th>
                      <th>Participação</th>
                      <th>Campanhas</th>
                      <th>Perfis vistos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acquisitionBySource.map((item) => (
                      <tr key={item.key}>
                        <td>{item.label}</td>
                        <td>{item.sessoes}</td>
                        <td>{formatMetricPercent(metricPercentage(item.sessoes, officialSessions))}</td>
                        <td>{item.campanhas}</td>
                        <td>{item.perfisVisualizados}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Aquisição paga</p>
            <h2>Desempenho das campanhas oficiais</h2>
            <p className="muted">
              Identidades não cadastradas e tráfego pago sem campanha ficam apenas nas pendências de rastreamento.
            </p>
          </div>
        </div>

        {officialPerformance.length === 0 ? (
          <p className="muted">Nenhuma campanha oficial teve sessões neste período.</p>
        ) : (
          <div className="table-wrap">
            <table className="admin-performance-table admin-attribution-performance-table">
              <caption className="sr-only">
                Desempenho de tráfego e conversão por campanha atribuída
              </caption>
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th>Objetivo</th>
                  <th>Canal</th>
                  <th className="admin-numeric-cell">Sessões</th>
                  <th className="admin-numeric-cell">Perfis visualizados</th>
                  <th className="admin-numeric-cell">Conversões</th>
                  <th className="admin-numeric-cell">Taxa de conversão</th>
                </tr>
              </thead>
              <tbody>
                {officialPerformance.map((item, index) => {
                  const objective = item.objetivo ||
                    objectiveByIdentity.get(performanceIdentity(item)) ||
                    "indefinido";
                  const clientCampaign = objective === "cliente";
                  const sessions = Number(item.sessoes || 0);
                  const assistedSessions = Math.min(
                    sessions,
                    Math.max(0, Number(item.sessoesAtribuicaoAssistida || 0))
                  );
                  const directSessions = Math.max(0, sessions - assistedSessions);

                  return (
                    <tr key={`${item.origem}-${item.midia}-${item.campanha}-${index}`}>
                      <td>
                        <strong>{campaignLabel(item)}</strong>
                        <small className="admin-table-secondary">
                          {assistedSessions > 0
                            ? `${directSessions} diretas · ${assistedSessions} assistidas`
                            : `${directSessions} por atribuição direta`}
                        </small>
                      </td>
                      <td>{OBJECTIVES[objective] || "Não classificado"}</td>
                      <td>
                        <div className="admin-campaign-source">
                          <span className={`admin-status-badge admin-source-badge is-${sourceCode(item.origem)}`}>
                            {sourceLabel(item.origem)}
                          </span>
                          <span className="admin-medium-label">
                            {String(item.midia || "Não identificada").toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="admin-numeric-cell">{sessions}</td>
                      <td className="admin-numeric-cell">{item.perfisVisualizados}</td>
                      <td className="admin-numeric-cell">
                        {clientCampaign
                          ? (
                              <>
                                <strong>{item.agendamentosConcluidos}</strong>
                                <small className="admin-table-secondary">
                                  {item.agendamentosIniciados} iniciadas
                                </small>
                              </>
                            )
                          : <span className="admin-data-empty">Não se aplica</span>}
                      </td>
                      <td className="admin-numeric-cell">
                        {clientCampaign
                          ? formatMetricPercent(item.taxaConversao)
                          : <span className="admin-data-empty">Analisar em Rentabilidade</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Conversões oficiais</p>
            <h2>Agendamentos de campanhas de clientes</h2>
            <p className="muted">
              Cadastros de profissionais são analisados em Rentabilidade. Aqui entram apenas agendamentos de campanhas oficiais com objetivo cliente.
            </p>
          </div>
        </div>

        {officialConversions.length === 0 ? (
          <p className="muted">Nenhum agendamento de campanha de clientes neste período.</p>
        ) : (
          <div className="table-wrap">
            <table className="admin-conversion-table">
              <caption className="sr-only">
                Agendamentos atribuídos a campanhas de aquisição de clientes
              </caption>
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
                {officialConversions.map((item) => (
                  <tr key={item.eventoId}>
                    <td>{formatDateTime(item.createdAt)}</td>
                    <td>
                      <strong>{campaignLabel(item)}</strong>
                      <small className="admin-table-secondary">
                        {item.atribuicaoAssistida
                          ? "Atribuição assistida"
                          : "Atribuição direta"}
                      </small>
                    </td>
                    <td>{item.negocioNome || "Negócio indisponível"}</td>
                    <td>{item.agendamentoId ? `#${item.agendamentoId}` : "Sem ID"}</td>
                    <td>{item.landingPage || "Não registrada"}</td>
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
