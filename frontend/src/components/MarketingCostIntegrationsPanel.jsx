import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

import { apiRequest } from "../api/client";

const PROVIDER_LABELS = {
  google_ads: "Google Ads",
  meta_ads: "Meta Ads"
};

const EXTERNAL_STATUS_LABELS = {
  ENABLED: "Ativa",
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  REMOVED: "Removida",
  DELETED: "Excluída",
  ARCHIVED: "Arquivada",
  IN_PROCESS: "Em processamento",
  WITH_ISSUES: "Com problemas",
  CAMPAIGN_PAUSED: "Campanha pausada",
  ADSET_PAUSED: "Conjunto pausado",
  DISAPPROVED: "Reprovada",
  PENDING_REVIEW: "Em análise",
  PENDING_BILLING_INFO: "Aguardando faturamento",
  UNKNOWN: "Status desconhecido"
};

function statusLabel(provider) {
  if (provider?.saude?.rotulo) return provider.saude.rotulo;
  if (provider?.configurado) return "Configurado";
  if (provider?.habilitado) return "Configuração incompleta";
  return "Desativado";
}

function externalStatusLabel(value) {
  const status = String(value || "UNKNOWN").toUpperCase();
  return EXTERNAL_STATUS_LABELS[status] || status;
}

function formatTimestamp(value) {
  if (!value) return "Nunca sincronizado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Nunca sincronizado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function pluralize(count, singular, plural) {
  return `${count} ${Number(count) === 1 ? singular : plural}`;
}

function linkCountLabel(count) {
  const value = Number(count || 0);
  if (value === 0) return "Nenhuma campanha vinculada";
  return pluralize(value, "campanha vinculada", "campanhas vinculadas");
}

function canalEsperado(provedor) {
  if (provedor === "google_ads") return "google";
  if (provedor === "meta_ads") return "meta";
  return "";
}

function connectionSummary(connection) {
  if (!connection?.conectado) return "";
  return [
    connection.nomeConta || `Conta ${connection.contaExternaId}`,
    connection.moeda,
    connection.fusoHorario,
    connection.apiVersion
  ]
    .filter(Boolean)
    .join(" · ");
}

function scheduleSummary(config) {
  if (!config) return "Status do agendamento automático indisponível.";
  if (config.habilitado) {
    return `Atualização a cada ${config.intervaloHoras}h · alerta após ${config.limiteDesatualizadoHoras}h sem sincronização.`;
  }
  return `Sincronização manual disponível · alerta após ${config.limiteDesatualizadoHoras || 24}h sem atualização.`;
}

function syncDetail(item) {
  const sync = item?.ultimaSincronizacao;
  if (!sync) return "";
  const imported = Number(sync.registros_importados || 0);
  const unlinked = Number(sync.campanhas_nao_vinculadas || 0);
  const importedLabel = pluralize(imported, "registro importado", "registros importados");
  if (!unlinked) return importedLabel;
  return `${importedLabel} · ${pluralize(unlinked, "campanha externa sem vínculo", "campanhas externas sem vínculo")}`;
}

function shouldShowHealthDetail(item) {
  const state = String(
    item?.saude?.codigo ||
      item?.saude?.estado ||
      ""
  ).toLowerCase();
  return Boolean(
    item?.saude?.detalhe &&
      !["saudavel", "nao_sincronizado"].includes(state)
  );
}

function healthBadgeClass(item) {
  const level = String(item?.saude?.nivel || "").toLowerCase();
  const code = String(
    item?.saude?.codigo ||
      item?.saude?.estado ||
      ""
  ).toLowerCase();

  if (level === "sucesso" || code === "saudavel") return "is-success";
  if (level === "erro" || code === "erro") return "is-critical";
  if (level === "aviso" || [
    "configuracao_incompleta",
    "nao_sincronizado",
    "parcial",
    "desatualizado"
  ].includes(code)) {
    return "is-warning";
  }

  return "is-muted";
}

export function MarketingCostIntegrationsPanel({ onChanged }) {
  const [data, setData] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [provider, setProvider] = useState("google_ads");
  const [campaignId, setCampaignId] = useState("");
  const [externalCampaigns, setExternalCampaigns] = useState([]);
  const [externalAccountId, setExternalAccountId] = useState("");
  const [externalCampaignId, setExternalCampaignId] = useState("");
  const [externalCampaignName, setExternalCampaignName] = useState("");
  const [loadingExternalCampaigns, setLoadingExternalCampaigns] = useState(false);
  const [connections, setConnections] = useState({});
  const [testingProvider, setTestingProvider] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const [integrationsResult, managedResult] = await Promise.allSettled([
      apiRequest("/admin/marketing/custos-integracoes"),
      apiRequest("/admin/marketing/gestao-campanhas")
    ]);
    const errors = [];

    if (integrationsResult.status === "fulfilled") {
      setData(integrationsResult.value);
    } else {
      errors.push(
        integrationsResult.reason?.message || "Falha ao carregar integrações."
      );
    }

    if (managedResult.status === "fulfilled") {
      setCampaigns(managedResult.value?.campanhas || []);
    } else {
      errors.push(
        managedResult.reason?.message || "Falha ao carregar campanhas do AF."
      );
    }

    if (errors.length > 0) {
      setError(
        errors.length === 2
          ? errors[0]
          : `Parte do painel está temporariamente indisponível. ${errors[0]}`
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedProvider = useMemo(
    () => data?.provedores?.find((item) => item.provedor === provider) || null,
    [data, provider]
  );

  const eligibleCampaigns = useMemo(() => {
    const expected = canalEsperado(provider);
    return campaigns.filter(
      (item) =>
        item.ativo !== false &&
        ["profissional", "cliente"].includes(item.objetivo) &&
        (!expected || item.canal === expected)
    );
  }, [campaigns, provider]);

  const selectedExternalCampaign = useMemo(
    () =>
      externalCampaigns.find(
        (item) => String(item.id) === String(externalCampaignId)
      ) || null,
    [externalCampaignId, externalCampaigns]
  );

  const providerLabel = PROVIDER_LABELS[provider] || provider;

  useEffect(() => {
    if (
      campaignId &&
      eligibleCampaigns.some((item) => String(item.id) === String(campaignId))
    ) {
      return;
    }
    setCampaignId(String(eligibleCampaigns[0]?.id || ""));
  }, [campaignId, eligibleCampaigns]);

  useEffect(() => {
    if (!externalAccountId && selectedProvider?.contaExternaId) {
      setExternalAccountId(String(selectedProvider.contaExternaId));
    }
  }, [externalAccountId, selectedProvider]);

  useEffect(() => {
    if (!selectedProvider?.configurado) {
      setExternalCampaigns([]);
      setLoadingExternalCampaigns(false);
      return undefined;
    }

    let active = true;
    setLoadingExternalCampaigns(true);

    apiRequest(`/admin/marketing/custos-integracoes/${provider}/campanhas`)
      .then((result) => {
        if (!active) return;
        setExternalCampaigns(result?.campanhas || []);
        setExternalAccountId(
          String(result?.contaExternaId || selectedProvider.contaExternaId || "")
        );
      })
      .catch((requestError) => {
        if (!active) return;
        setExternalCampaigns([]);
        setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoadingExternalCampaigns(false);
      });

    return () => {
      active = false;
    };
  }, [provider, selectedProvider?.configurado, selectedProvider?.contaExternaId]);

  function changeProvider(value) {
    setProvider(value);
    setExternalCampaigns([]);
    setExternalAccountId("");
    setExternalCampaignId("");
    setExternalCampaignName("");
    setError("");
    setMessage("");
  }

  function changeExternalCampaign(value) {
    setExternalCampaignId(value);
    const campaign = externalCampaigns.find(
      (item) => String(item.id) === String(value)
    );
    setExternalCampaignName(campaign?.nome || "");
  }

  async function testConnection(provedor) {
    if (testingProvider) return;
    setTestingProvider(provedor);
    setError("");
    setMessage("");
    try {
      const result = await apiRequest(
        `/admin/marketing/custos-integracoes/${provedor}/testar`,
        { method: "POST", body: {} }
      );
      setConnections((current) => ({ ...current, [provedor]: result }));
      setMessage(
        `${PROVIDER_LABELS[provedor] || provedor} conectado com sucesso.` +
          (connectionSummary(result) ? ` ${connectionSummary(result)}.` : "")
      );
    } catch (requestError) {
      setConnections((current) => ({ ...current, [provedor]: null }));
      setError(requestError.message);
    } finally {
      setTestingProvider("");
    }
  }

  async function saveLink(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiRequest("/admin/marketing/custos-integracoes/vinculos", {
        method: "POST",
        body: {
          campanhaId: Number(campaignId),
          provedor: provider,
          contaExternaId: externalAccountId,
          campanhaExternaId: externalCampaignId,
          campanhaExternaNome: externalCampaignName
        }
      });
      setExternalCampaignId("");
      setExternalCampaignName("");
      setMessage(`Vínculo salvo com a campanha real do ${providerLabel}.`);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function sync(provedor) {
    if (syncing) return;
    setSyncing(provedor);
    setError("");
    setMessage("");
    try {
      const result = await apiRequest(
        `/admin/marketing/custos-integracoes/${provedor}/sincronizar`,
        { method: "POST", body: {} }
      );
      const imported = Number(result.registrosImportados || 0);
      const unlinked = Number(result.campanhasNaoVinculadas || 0);
      const reconciled = result.reconciliacaoCampanhasCompleta === true;
      setMessage(
        `${PROVIDER_LABELS[provedor] || provedor}: ${pluralize(imported, "registro importado", "registros importados")}.` +
          (unlinked
            ? ` ${pluralize(unlinked, "campanha externa ainda sem vínculo", "campanhas externas ainda sem vínculo")}.`
            : reconciled
              ? " Reconciliação completa das campanhas externas."
              : "")
      );
      await load();
      onChanged?.();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSyncing("");
    }
  }

  function liveStatus(link) {
    if (link.provedor !== provider) return "Não carregado";
    const campaign = externalCampaigns.find(
      (item) => String(item.id) === String(link.campanha_externa_id)
    );
    return campaign ? externalStatusLabel(campaign.status) : "Não carregado";
  }

  const scheduleEnabled = Boolean(data?.sincronizacaoAutomatica?.habilitado);
  const platformReady = Boolean(selectedProvider?.configurado && externalAccountId);
  const afCampaignReady = Boolean(campaignId);
  const externalReady = Boolean(selectedExternalCampaign);
  const canSaveLink = Boolean(
    !saving &&
      platformReady &&
      afCampaignReady &&
      externalReady &&
      !loadingExternalCampaigns
  );

  let linkBlockReason = "";
  if (!selectedProvider?.configurado) {
    linkBlockReason = `Complete a configuração do ${providerLabel} antes de vincular campanhas.`;
  } else if (!platformReady) {
    linkBlockReason = `A conta externa do ${providerLabel} não foi identificada. Teste a conexão antes de continuar.`;
  } else if (eligibleCampaigns.length === 0) {
    linkBlockReason =
      `Crie ou classifique uma campanha ativa do AF para ${providerLabel} antes de continuar.`;
  } else if (loadingExternalCampaigns) {
    linkBlockReason = "Aguarde o carregamento das campanhas externas.";
  } else if (!externalCampaignId) {
    linkBlockReason = `Selecione uma campanha real do ${providerLabel} para continuar.`;
  }

  return (
    <section
      aria-busy={loading || loadingExternalCampaigns}
      className="panel"
      id="integracoes-custos"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Integrações de mídia</p>
          <h2>Campanhas e custos das plataformas</h2>
          <p className="muted">
            Valide as contas, conecte campanhas do AF às campanhas reais e acompanhe a atualização dos custos.
          </p>
          <div className="integration-schedule-status" role="status">
            <span className={`admin-status-badge ${scheduleEnabled ? "is-success" : "is-warning"}`}>
              {scheduleEnabled ? "Custos automáticos ativos" : "Custos automáticos desativados"}
            </span>
            <span className="muted">{scheduleSummary(data?.sincronizacaoAutomatica)}</span>
          </div>
        </div>
      </div>

      {loading && <p className="muted">Carregando integrações...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}

      {!loading && (
        <>
          <div className="integration-health-grid" aria-label="Saúde das integrações de custos">
            {(data?.provedores || []).map((item) => {
              const hasLinks = Number(item.vinculos || 0) > 0;
              const hasSync = Boolean(item.ultimaSincronizacao);

              return (
                <article className="integration-health-card" key={item.provedor}>
                  <div className="integration-health-card-heading">
                    <span>{item.nome}</span>
                    <span className={`admin-status-badge ${healthBadgeClass(item)}`}>
                      {statusLabel(item)}
                    </span>
                  </div>
                  <p className="integration-health-summary">
                    <strong>{linkCountLabel(item.vinculos)}</strong>
                    <span aria-hidden="true"> · </span>
                    <span className="muted">
                      {hasSync
                        ? `Última sincronização ${formatTimestamp(item.ultimaSincronizacao?.finished_at)}`
                        : "Nunca sincronizado"}
                    </span>
                  </p>
                  {hasSync && <p className="muted integration-health-detail">{syncDetail(item)}</p>}
                  {shouldShowHealthDetail(item) && (
                    <p className="muted integration-health-detail">{item.saude.detalhe}</p>
                  )}
                  {connections[item.provedor]?.conectado && (
                    <p className="muted integration-health-detail">
                      {connectionSummary(connections[item.provedor])}
                    </p>
                  )}
                  {!hasLinks && item.configurado && (
                    <small className="muted integration-health-hint">
                      Vincule uma campanha para liberar a sincronização de custos.
                    </small>
                  )}
                  <div className="integration-health-actions">
                    <button
                      className="button button-secondary button-small"
                      disabled={!item.configurado || Boolean(testingProvider) || Boolean(syncing)}
                      onClick={() => testConnection(item.provedor)}
                      type="button"
                    >
                      {testingProvider === item.provedor ? "Testando..." : "Testar conexão"}
                    </button>
                    {hasLinks && (
                      <button
                        className="button button-secondary button-small"
                        disabled={!item.configurado || Boolean(syncing) || Boolean(testingProvider)}
                        onClick={() => sync(item.provedor)}
                        type="button"
                      >
                        {syncing === item.provedor ? "Sincronizando..." : "Sincronizar 30 dias"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="integration-link-section-heading">
            <div>
              <span className="eyebrow">Vincular campanha</span>
              <strong>Conecte o AF à campanha real</strong>
            </div>
            <small className="muted">Três passos. O vínculo só é salvo após selecionar a campanha externa.</small>
          </div>

          <form className="stack-form" onSubmit={saveLink}>
            <div className="integration-link-flow">
              <section
                className={`integration-link-step ${platformReady ? "is-complete" : "is-pending"}`}
                aria-labelledby="integration-step-platform"
              >
                <div className="integration-step-heading">
                  <span className="integration-step-number">{platformReady ? "✓" : "1"}</span>
                  <span className="integration-step-label" id="integration-step-platform">Plataforma</span>
                  <span className={`integration-step-state ${platformReady ? "is-complete" : "is-pending"}`}>
                    {platformReady ? "Concluído" : "Pendente"}
                  </span>
                </div>
                <div className="form-grid">
                  <label>
                    Plataforma
                    <select value={provider} onChange={(event) => changeProvider(event.target.value)}>
                      <option value="google_ads">Google Ads</option>
                      <option value="meta_ads">Meta Ads</option>
                    </select>
                  </label>
                </div>
              </section>

              <section
                className={`integration-link-step ${afCampaignReady ? "is-complete" : "is-pending"}`}
                aria-labelledby="integration-step-af"
              >
                <div className="integration-step-heading">
                  <span className="integration-step-number">{afCampaignReady ? "✓" : "2"}</span>
                  <span className="integration-step-label" id="integration-step-af">Campanha do AF</span>
                  <span className={`integration-step-state ${afCampaignReady ? "is-complete" : "is-pending"}`}>
                    {afCampaignReady ? "Concluído" : "Pendente"}
                  </span>
                </div>
                <div className="form-grid">
                  <label>
                    Campanha do AF
                    <select
                      required
                      value={campaignId}
                      onChange={(event) => setCampaignId(event.target.value)}
                    >
                      <option value="">Selecione</option>
                      {eligibleCampaigns.map((item) => (
                        <option key={item.id} value={item.id}>{item.nome}</option>
                      ))}
                    </select>
                    {eligibleCampaigns.length === 0 && (
                      <small>Crie primeiro uma campanha do AF para este canal.</small>
                    )}
                  </label>
                </div>
              </section>

              <section
                className={`integration-link-step ${externalReady ? "is-complete" : "is-pending"}`}
                aria-labelledby="integration-step-external"
              >
                <div className="integration-step-heading">
                  <span className="integration-step-number">{externalReady ? "✓" : "3"}</span>
                  <span className="integration-step-label" id="integration-step-external">Campanha externa</span>
                  <span className={`integration-step-state ${externalReady ? "is-complete" : "is-pending"}`}>
                    {externalReady ? "Concluído" : "Pendente"}
                  </span>
                </div>
                <div className="form-grid">
                  <label>
                    Campanha real do {providerLabel}
                    <select
                      disabled={!selectedProvider?.configurado || loadingExternalCampaigns}
                      required
                      value={externalCampaignId}
                      onChange={(event) => changeExternalCampaign(event.target.value)}
                    >
                      <option value="">
                        {loadingExternalCampaigns ? "Carregando campanhas..." : "Selecione"}
                      </option>
                      {externalCampaigns.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nome} · {externalStatusLabel(item.status)} · {item.id}
                        </option>
                      ))}
                    </select>
                    {!selectedProvider?.configurado && (
                      <small>Complete as credenciais do {providerLabel} no backend para listar campanhas reais.</small>
                    )}
                  </label>
                </div>
              </section>
            </div>

            <div className="form-actions integration-link-actions">
              <div>
                {!canSaveLink && !saving && linkBlockReason && (
                  <p className="muted" role="status">{linkBlockReason}</p>
                )}
              </div>
              <button className="button" disabled={!canSaveLink} type="submit">
                {saving ? "Salvando vínculo..." : "Vincular campanha"}
              </button>
            </div>
          </form>

          {(data?.vinculos || []).length > 0 && (
            <div className="integration-linked-campaigns">
              <div className="admin-stat-table-heading">
                <strong>Campanhas vinculadas</strong>
                <small>Relação entre a campanha do AF e a campanha externa.</small>
              </div>
              <div className="table-wrap">
                <table className="admin-compact-table">
                  <thead>
                    <tr>
                      <th>Campanha AF</th>
                      <th>Plataforma</th>
                      <th>Campanha externa</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.vinculos.map((item) => (
                      <tr key={item.id}>
                        <td>{item.campanha_nome}</td>
                        <td>{PROVIDER_LABELS[item.provedor] || item.provedor}</td>
                        <td>
                          <strong>{item.campanha_externa_nome || "Sem nome"}</strong>
                          <small className="admin-row-note">ID {item.campanha_externa_id}</small>
                        </td>
                        <td>{liveStatus(item)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
