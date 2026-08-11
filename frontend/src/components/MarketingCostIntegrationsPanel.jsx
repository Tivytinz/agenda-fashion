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

function statusLabel(provider) {
  if (provider?.configurado) return "Configurado";
  if (provider?.habilitado) return "Configuração incompleta";
  return "Desativado";
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

export function MarketingCostIntegrationsPanel({ onChanged }) {
  const [data, setData] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [provider, setProvider] = useState("google_ads");
  const [campaignId, setCampaignId] = useState("");
  const [externalAccountId, setExternalAccountId] = useState("");
  const [externalCampaignId, setExternalCampaignId] = useState("");
  const [externalCampaignName, setExternalCampaignName] = useState("");
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
      setCampaignId((current) => current || String(managed?.campanhas?.[0]?.id || ""));
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

  useEffect(() => {
    if (!externalAccountId && selectedProvider?.contaExternaId) {
      setExternalAccountId(String(selectedProvider.contaExternaId));
    }
  }, [externalAccountId, selectedProvider]);

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
      setMessage("Vínculo salvo. A próxima sincronização poderá importar o custo dessa campanha.");
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

  return (
    <section className="panel" aria-busy={loading}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Importação automática</p>
          <h2>Custos das plataformas</h2>
          <p className="muted">
            Vincule a campanha do Agenda Fashion ao ID da campanha externa. Tokens e credenciais ficam somente no backend.
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
                <select value={provider} onChange={(event) => {
                  setProvider(event.target.value);
                  setExternalAccountId("");
                }}>
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
                  {campaigns.map((item) => (
                    <option key={item.id} value={item.id}>{item.nome}</option>
                  ))}
                </select>
              </label>

              <label>
                ID da conta externa
                <input
                  required
                  maxLength="120"
                  placeholder={provider === "meta_ads" ? "Ex.: 123456789" : "Ex.: 6770207927"}
                  value={externalAccountId}
                  onChange={(event) => setExternalAccountId(event.target.value)}
                />
              </label>

              <label>
                ID da campanha externa
                <input
                  required
                  maxLength="120"
                  value={externalCampaignId}
                  onChange={(event) => setExternalCampaignId(event.target.value)}
                />
              </label>

              <label>
                Nome externo (opcional)
                <input
                  maxLength="240"
                  value={externalCampaignName}
                  onChange={(event) => setExternalCampaignName(event.target.value)}
                />
              </label>
            </div>

            <div className="form-actions">
              <button className="button" disabled={saving || campaigns.length === 0} type="submit">
                {saving ? "Salvando vínculo..." : "Salvar vínculo"}
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
                  </tr>
                </thead>
                <tbody>
                  {data.vinculos.map((item) => (
                    <tr key={item.id}>
                      <td>{item.campanha_nome}</td>
                      <td>{PROVIDER_LABELS[item.provedor] || item.provedor}</td>
                      <td>{item.campanha_externa_id}</td>
                      <td>{item.campanha_externa_nome || "—"}</td>
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
