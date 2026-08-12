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

const GOOGLE_STATUS_LABELS = {
  ENABLED: "Ativa",
  PAUSED: "Pausada",
  REMOVED: "Removida",
  UNKNOWN: "Status desconhecido"
};

function statusLabel(provider) {
  if (provider?.configurado) return "Configurado";
  if (provider?.habilitado) return "Configuração incompleta";
  return "Desativado";
}

function googleStatusLabel(value) {
  const status = String(value || "UNKNOWN").toUpperCase();
  return GOOGLE_STATUS_LABELS[status] || status;
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [integrations, managed] = await Promise.all([
        apiRequest("/admin/marketing/custos-integracoes"),
        apiRequest("/admin/marketing/gestao-campanhas")
      ]);
      setData(integrations);
      setCampaigns(managed?.campanhas || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
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
    () => externalCampaigns.find((item) => String(item.id) === String(externalCampaignId)) || null,
    [externalCampaignId, externalCampaigns]
  );

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
    if (provider !== "google_ads" || !selectedProvider?.configurado) {
      setLoadingExternalCampaigns(false);
      return undefined;
    }

    let active = true;
    setLoadingExternalCampaigns(true);
    setError("");

    apiRequest("/admin/marketing/custos-integracoes/google_ads/campanhas")
      .then((result) => {
        if (!active) return;
        setExternalCampaigns(result?.campanhas || []);
        setExternalAccountId(String(result?.contaExternaId || selectedProvider.contaExternaId || ""));
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
    setExternalAccountId("");
    setExternalCampaignId("");
    setExternalCampaignName("");
    setError("");
    setMessage("");
  }

  function changeExternalCampaign(value) {
    setExternalCampaignId(value);
    const campaign = externalCampaigns.find((item) => String(item.id) === String(value));
    setExternalCampaignName(campaign?.nome || "");
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
        provider === "google_ads"
          ? "Vínculo verificado e salvo com a campanha real do Google Ads."
          : "Vínculo salvo. A próxima sincronização poderá importar o custo dessa campanha."
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
    if (link.provedor !== "google_ads") return "—";
    const campaign = externalCampaigns.find(
      (item) => String(item.id) === String(link.campanha_externa_id)
    );
    return campaign ? googleStatusLabel(campaign.status) : "Não carregado";
  }

  return (
    <section className="panel" aria-busy={loading || loadingExternalCampaigns}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Importação automática</p>
          <h2>Campanhas e custos das plataformas</h2>
          <p className="muted">
            No Google Ads, escolha uma campanha real da conta configurada. O backend confirma o vínculo antes de salvar e mantém as credenciais fora do navegador.
          </p>
        </div>
      </div>

      {loading && <p className="muted">Carregando integrações...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}

      {!loading && (
        <>
          <div className="metric-grid">
            {(data?.provedores || []).map((item) => (
              <article className="metric-card" key={item.provedor}>
                <span>{item.nome}</span>
                <strong>{statusLabel(item)}</strong>
                <small>
                  {item.vinculos || 0} vínculo(s) · {formatTimestamp(item.ultimaSincronizacao?.finished_at)}
                </small>
                <button
                  className="button button-secondary"
                  disabled={!item.configurado || Boolean(syncing)}
                  onClick={() => sync(item.provedor)}
                  type="button"
                >
                  {syncing === item.provedor ? "Sincronizando..." : "Sincronizar 30 dias"}
                </button>
              </article>
            ))}
          </div>

          <form className="stack-form" onSubmit={saveLink}>
            <div className="form-grid">
              <label>
                Plataforma
                <select value={provider} onChange={(event) => changeProvider(event.target.value)}>
                  <option value="google_ads">Google Ads</option>
                  <option value="meta_ads">Meta Ads</option>
                </select>
              </label>

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

              <label>
                ID da conta externa
                <input
                  required
                  maxLength="120"
                  placeholder={provider === "meta_ads" ? "Ex.: 123456789" : "Conta configurada no backend"}
                  readOnly={provider === "google_ads"}
                  value={externalAccountId}
                  onChange={(event) => setExternalAccountId(event.target.value)}
                />
              </label>

              {provider === "google_ads" ? (
                <label>
                  Campanha real do Google Ads
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
                        {item.nome} · {googleStatusLabel(item.status)} · {item.id}
                      </option>
                    ))}
                  </select>
                  {!selectedProvider?.configurado && (
                    <small>Complete as credenciais do Google Ads no backend para listar campanhas reais.</small>
                  )}
                </label>
              ) : (
                <label>
                  ID da campanha externa
                  <input
                    required
                    maxLength="120"
                    value={externalCampaignId}
                    onChange={(event) => setExternalCampaignId(event.target.value)}
                  />
                </label>
              )}

              <label>
                Nome externo {provider === "meta_ads" ? "(opcional)" : ""}
                <input
                  maxLength="240"
                  readOnly={provider === "google_ads"}
                  value={externalCampaignName}
                  onChange={(event) => setExternalCampaignName(event.target.value)}
                />
              </label>

              {provider === "google_ads" && (
                <label>
                  Status no Google Ads
                  <input
                    readOnly
                    value={selectedExternalCampaign ? googleStatusLabel(selectedExternalCampaign.status) : "—"}
                  />
                </label>
              )}
            </div>

            <div className="form-actions">
              <button
                className="button"
                disabled={
                  saving ||
                  eligibleCampaigns.length === 0 ||
                  (provider === "google_ads" && (!selectedProvider?.configurado || loadingExternalCampaigns || !externalCampaignId))
                }
                type="submit"
              >
                {saving ? "Salvando vínculo..." : provider === "google_ads" ? "Vincular campanha verificada" : "Salvar vínculo"}
              </button>
            </div>
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
