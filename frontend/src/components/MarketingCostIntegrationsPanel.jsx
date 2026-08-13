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
  if (!value) return "Ainda não sincronizado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ainda não sincronizado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
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
    return `Execução a cada ${config.intervaloHoras}h · alerta de desatualização após ${config.limiteDesatualizadoHoras}h.`;
  }
  return `Sincronização manual disponível · alerta de desatualização após ${config.limiteDesatualizadoHoras || 24}h.`;
}

function syncDetail(item) {
  const sync = item?.ultimaSincronizacao;
  if (!sync) return "";
  const imported = Number(sync.registros_importados || 0);
  const unlinked = Number(sync.campanhas_nao_vinculadas || 0);
  return `${imported} importado(s) · ${unlinked} sem vínculo`;
}

function shouldShowHealthDetail(item) {
  const state = String(item?.saude?.estado || "");
  return Boolean(
    item?.saude?.detalhe &&
      !["saudavel", "nao_sincronizado"].includes(state)
  );
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
    return campaigns.filter((item) => !expected || item.canal === expected);
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
      setMessage(
        `Vínculo verificado e salvo com a campanha real do ${providerLabel}.`
      );
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
      setMessage(
        `${PROVIDER_LABELS[provedor] || provedor}: ${result.registrosImportados || 0} registro(s) importado(s).` +
          (result.campanhasNaoVinculadas
            ? ` ${result.campanhasNaoVinculadas} campanha(s) externa(s) ainda sem vínculo.`
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
      eligibleCampaigns.length > 0 &&
      selectedProvider?.configurado &&
      !loadingExternalCampaigns &&
      externalCampaignId
  );

  let linkBlockReason = "";
  if (!selectedProvider?.configurado) {
    linkBlockReason = `Complete a configuração do ${providerLabel} antes de vincular campanhas.`;
  } else if (eligibleCampaigns.length === 0) {
    linkBlockReason = `Crie uma campanha do AF para ${providerLabel} antes de continuar.`;
  } else if (loadingExternalCampaigns) {
    linkBlockReason = "Aguarde o carregamento das campanhas externas.";
  } else if (!externalCampaignId) {
    linkBlockReason = `Selecione uma campanha real do ${providerLabel} para continuar.`;
  }

  return (
    <section className="panel" aria-busy={loading || loadingExternalCampaigns}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Importação automática</p>
          <h2>Campanhas e custos das plataformas</h2>
          <p className="muted">
            Confira a saúde das contas e vincule cada campanha do AF à campanha real da plataforma. Credenciais continuam somente no backend.
          </p>
          <p role="status">
            <span
              className={`admin-status-badge ${scheduleEnabled ? "is-success" : "is-muted"}`}
            >
              {scheduleEnabled
                ? "Custos automáticos ativos"
                : "Custos automáticos desativados"}
            </span>{" "}
            <span className="muted">
              {scheduleSummary(data?.sincronizacaoAutomatica)}
            </span>
          </p>
        </div>
      </div>

      {loading && <p className="muted">Carregando integrações...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}

      {!loading && (
        <>
          <div
            className="integration-health-grid"
            aria-label="Saúde das integrações de custos"
          >
            {(data?.provedores || []).map((item) => {
              const hasLinks = Number(item.vinculos || 0) > 0;
              const hasSync = Boolean(item.ultimaSincronizacao);
              const healthy = item.saude?.estado === "saudavel";

              return (
                <article className="integration-health-card" key={item.provedor}>
                  <div className="integration-health-card-heading">
                    <span>{item.nome}</span>
                    <span
                      className={`admin-status-badge ${healthy ? "is-success" : "is-muted"}`}
                    >
                      {statusLabel(item)}
                    </span>
                  </div>
                  <p className="integration-health-summary muted">
                    <strong>{item.vinculos || 0}</strong> campanha(s) vinculada(s)
                    <span aria-hidden="true"> · </span>
                    <span>
                      {hasSync
                        ? formatTimestamp(item.ultimaSincronizacao?.finished_at)
                        : "Nunca sincronizado"}
                    </span>
                  </p>
                  {hasSync && (
                    <p className="muted integration-health-detail">
                      {syncDetail(item)}
                    </p>
                  )}
                  {shouldShowHealthDetail(item) && (
                    <p className="muted integration-health-detail">
                      {item.saude.detalhe}
                    </p>
                  )}
                  {connections[item.provedor]?.conectado && (
                    <p className="muted integration-health-detail">
                      {connectionSummary(connections[item.provedor])}
                    </p>
                  )}
                  {!hasLinks && item.configurado && (
                    <small className="muted integration-health-hint">
                      Vincule pelo menos uma campanha antes de sincronizar custos.
                    </small>
                  )}
                  <div className="integration-health-actions">
                    <button
                      className="button button-secondary button-small"
                      disabled={
                        !item.configurado || Boolean(testingProvider) || Boolean(syncing)
                      }
                      onClick={() => testConnection(item.provedor)}
                      type="button"
                    >
                      {testingProvider === item.provedor
                        ? "Testando conexão..."
                        : "Testar conexão"}
                    </button>
                    <button
                      className="button button-secondary button-small"
                      disabled={
                        !item.configurado ||
                        !hasLinks ||
                        Boolean(syncing) ||
                        Boolean(testingProvider)
                      }
                      onClick={() => sync(item.provedor)}
                      type="button"
                    >
                      {syncing === item.provedor
                        ? "Sincronizando..."
                        : "Sincronizar 30 dias"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <form className="stack-form" onSubmit={saveLink}>
            <div className="integration-link-flow">
              <section
                className={`integration-link-step ${platformReady ? "is-complete" : "is-pending"}`}
                aria-labelledby="integration-step-platform"
              >
                <div className="integration-step-heading">
                  <span className="integration-step-number">
                    {platformReady ? "✓" : "1"}
                  </span>
                  <span className="integration-step-label" id="integration-step-platform">
                    Plataforma
                  </span>
                  <span className={`integration-step-state ${platformReady ? "is-complete" : "is-pending"}`}>
                    {platformReady ? "Concluído" : "Pendente"}
                  </span>
                </div>
                <div className="form-grid">
                  <label>
                    Plataforma
                    <select
                      value={provider}
                      onChange={(event) => changeProvider(event.target.value)}
                    >
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
                  <span className="integration-step-number">
                    {afCampaignReady ? "✓" : "2"}
                  </span>
                  <span className="integration-step-label" id="integration-step-af">
                    Campanha do AF
                  </span>
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
                  <span className="integration-step-number">
                    {externalReady ? "✓" : "3"}
                  </span>
                  <span className="integration-step-label" id="integration-step-external">
                    Campanha externa
                  </span>
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
                        {loadingExternalCampaigns
                          ? "Carregando campanhas..."
                          : "Selecione"}
                      </option>
                      {externalCampaigns.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nome} · {externalStatusLabel(item.status)} · {item.id}
                        </option>
                      ))}
                    </select>
                    {!selectedProvider?.configurado && (
                      <small>
                        Complete as credenciais do {providerLabel} no backend para listar campanhas reais.
                      </small>
                    )}
                  </label>
                </div>
              </section>
            </div>

            <div className="form-actions">
              <button className="button" disabled={!canSaveLink} type="submit">
                {saving ? "Salvando vínculo..." : "Vincular campanha verificada"}
              </button>
            </div>
            {!canSaveLink && !saving && linkBlockReason && (
              <p className="muted" role="status">{linkBlockReason}</p>
            )}
          </form>

          {(data?.vinculos || []).length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Campanha AF</th>
                    <th>Plataforma</th>
                    <th>ID externo</th>
                    <th>Nome externo</th>
                    <th>Status externo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.vinculos.map((item) => (
                    <tr key={item.id}>
                      <td>{item.campanha_nome}</td>
                      <td>{PROVIDER_LABELS[item.provedor] || item.provedor}</td>
                      <td>{item.campanha_externa_id}</td>
                      <td>{item.campanha_externa_nome || "—"}</td>
                      <td>{liveStatus(item)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}