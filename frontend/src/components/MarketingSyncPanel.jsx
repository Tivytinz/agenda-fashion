import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

import { apiRequest } from "../api/client";

const PROVIDERS = {
  google_ads: { label: "Google Ads" },
  meta_ads: { label: "Meta Ads" }
};

const OBJECTIVES = {
  profissional: "Aquisição de profissionais",
  cliente: "Aquisição de clientes"
};

const EXTERNAL_STATUS = {
  ENABLED: "Ativa",
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  REMOVED: "Removida",
  DELETED: "Excluída",
  ARCHIVED: "Arquivada",
  IN_PROCESS: "Em processamento",
  WITH_ISSUES: "Com problemas"
};

function formatTimestamp(value) {
  if (!value) return "Nunca sincronizado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Nunca sincronizado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function normalizeExternalId(value) {
  return String(value || "")
    .replace(/^act_/i, "")
    .replace(/\D/g, "");
}

function externalKey(provider, accountId, campaignId) {
  const account = normalizeExternalId(accountId);
  const campaign = normalizeExternalId(campaignId);
  return account && campaign
    ? `${provider}:${account}:${campaign}`
    : "";
}

function healthClass(provider) {
  const level = String(provider?.saude?.nivel || "").toLowerCase();
  const code = String(provider?.saude?.codigo || "").toLowerCase();
  if (level === "sucesso" || code === "saudavel") return "is-success";
  if (level === "erro" || code === "erro") return "is-critical";
  if (level === "aviso") return "is-warning";
  return "is-muted";
}

function providerStatus(provider) {
  return provider?.saude?.rotulo ||
    (provider?.configurado ? "Configurado" : "Configuração pendente");
}

export function MarketingSyncPanel({ onChanged }) {
  const [data, setData] = useState(null);
  const [externalCampaigns, setExternalCampaigns] = useState({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState("");
  const [classifying, setClassifying] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const status = await apiRequest("/admin/marketing/custos-integracoes");
      setData(status);
      const configured = (status?.provedores || [])
        .filter((item) => item.configurado);
      const results = await Promise.allSettled(
        configured.map(async (item) => [
          item.provedor,
          await apiRequest(
            `/admin/marketing/custos-integracoes/${item.provedor}/campanhas`
          )
        ])
      );
      const campaigns = {};
      const failures = [];
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          const [provider, payload] = result.value;
          campaigns[provider] = payload;
        } else {
          failures.push(result.reason?.message || "Falha ao listar campanhas.");
        }
      });
      setExternalCampaigns(campaigns);
      if (failures.length > 0) {
        setError(
          "A saúde das integrações foi carregada, mas parte das campanhas externas está indisponível."
        );
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const linksByExternal = useMemo(() => {
    const map = new Map();
    (data?.vinculos || []).forEach((link) => {
      const key = externalKey(
        link.provedor,
        link.conta_externa_id,
        link.campanha_externa_id
      );
      if (key) map.set(key, link);
    });
    return map;
  }, [data?.vinculos]);

  async function sync(provider) {
    if (syncing) return;
    setSyncing(provider);
    setError("");
    setMessage("");
    try {
      const result = await apiRequest(
        `/admin/marketing/custos-integracoes/${provider}/sincronizar`,
        { method: "POST", body: {} }
      );
      const imported = Number(result.campanhasImportadas || 0);
      const linked = Number(result.vinculosAutomaticos || 0);
      const pending = Number(result.campanhasNaoVinculadas || 0);
      const unclassified = Number(result.campanhasSemObjetivo || 0);
      const label = PROVIDERS[provider]?.label || provider;

      setMessage(
        pending > 0
          ? `${label} sincronizado. ${imported} campanha(s) importada(s), ${linked} vínculo(s) automático(s) e ${pending} pendência(s) de vínculo.`
          : unclassified > 0
            ? `${label} sincronizado. ${imported} campanha(s) importada(s). ${unclassified} campanha(s) ainda precisam ter o objetivo classificado.`
            : `${label} sincronizado. ${imported} campanha(s) importada(s) e ${linked} vínculo(s) automático(s).`
      );
      await load();
      onChanged?.();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSyncing("");
    }
  }

  async function classify(link, objective) {
    if (classifying) return;
    const label = OBJECTIVES[objective];
    if (!label) return;
    const confirmed = window.confirm(
      `Definir “${link.campanha_nome}” como ${label}? O objetivo fica travado para preservar o histórico.`
    );
    if (!confirmed) return;

    setClassifying(link.campanha_id);
    setError("");
    setMessage("");
    try {
      await apiRequest(
        `/admin/marketing/gestao-campanhas/${link.campanha_id}`,
        { method: "PATCH", body: { objetivo: objective } }
      );
      setMessage(`Objetivo de “${link.campanha_nome}” definido como ${label}.`);
      await load();
      onChanged?.();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setClassifying(null);
    }
  }

  if (loading && !data) {
    return (
      <section className="panel marketing-sync-panel" id="sincronizacao-marketing">
        <p className="muted">Carregando sincronização das plataformas...</p>
      </section>
    );
  }

  const providers = data?.provedores || [];

  return (
    <section className="panel marketing-sync-panel" id="sincronizacao-marketing">
      <div className="marketing-sync-heading">
        <div>
          <p className="eyebrow">Sincronização + análise</p>
          <h2>Google Ads e Meta Ads</h2>
          <p className="muted">
            O AF reconhece as campanhas reais das plataformas e mantém os vínculos usados por custos e atribuição. Você só classifica o objetivo quando ele ainda não estiver definido.
          </p>
        </div>
        <span className="marketing-sync-automation">
          {data?.sincronizacaoAutomatica?.habilitado
            ? "Atualização automática ativa"
            : "Sincronização manual disponível"}
        </span>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}

      <div className="marketing-provider-grid">
        {providers.map((provider) => {
          const providerData = externalCampaigns[provider.provedor];
          const accountId = providerData?.contaExternaId || provider.contaExternaId;
          const campaigns = providerData?.campanhas || [];
          const linkedCount = campaigns.filter((campaign) =>
            linksByExternal.has(
              externalKey(provider.provedor, accountId, campaign.id)
            )
          ).length;

          return (
            <article className="marketing-provider-card" key={provider.provedor}>
              <div className="marketing-provider-card-head">
                <div>
                  <span className="marketing-provider-name">
                    {provider.nome || PROVIDERS[provider.provedor]?.label}
                  </span>
                  <strong>
                    {provider.configurado
                      ? `${linkedCount} de ${campaigns.length} campanhas reconhecidas`
                      : "Integração ainda não configurada"}
                  </strong>
                </div>
                <span className={`admin-status-badge ${healthClass(provider)}`}>
                  {providerStatus(provider)}
                </span>
              </div>

              <p className="muted">
                {provider.ultimaSincronizacao?.finished_at
                  ? `Última sincronização ${formatTimestamp(provider.ultimaSincronizacao.finished_at)}`
                  : "Ainda não houve sincronização concluída."}
              </p>

              {provider.saude?.detalhe && provider.saude?.codigo !== "saudavel" && (
                <p className="marketing-provider-note">{provider.saude.detalhe}</p>
              )}

              <button
                className="button button-secondary"
                disabled={!provider.configurado || Boolean(syncing)}
                onClick={() => sync(provider.provedor)}
                type="button"
              >
                {syncing === provider.provedor ? "Sincronizando..." : "Sincronizar agora"}
              </button>
            </article>
          );
        })}
      </div>

      <div className="marketing-synced-campaigns">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Campanhas reconhecidas</p>
            <h3>O AF acompanha o que existe nas plataformas</h3>
            <p className="muted">
              Campanhas novas entram na próxima sincronização. Quando o objetivo estiver indefinido, classifique uma vez para separar profissionais e clientes.
            </p>
          </div>
        </div>

        <div className="marketing-campaign-card-grid">
          {providers.flatMap((provider) => {
            const payload = externalCampaigns[provider.provedor];
            const accountId = payload?.contaExternaId || provider.contaExternaId;

            return (payload?.campanhas || []).map((campaign) => {
              const link = linksByExternal.get(
                externalKey(provider.provedor, accountId, campaign.id)
              );
              const objective = link?.objetivo || "indefinido";

              return (
                <article
                  className="marketing-campaign-card"
                  key={`${provider.provedor}-${campaign.id}`}
                >
                  <div className="marketing-campaign-card-head">
                    <div>
                      <strong>{campaign.nome}</strong>
                      <small>
                        {provider.nome || PROVIDERS[provider.provedor]?.label}
                        {" · "}
                        {EXTERNAL_STATUS[String(campaign.status || "").toUpperCase()] ||
                          campaign.status ||
                          "Status não informado"}
                      </small>
                    </div>
                    <span className={`admin-status-badge ${link ? "is-success" : "is-warning"}`}>
                      {link ? "Sincronizada" : "Aguardando sync"}
                    </span>
                  </div>

                  <div className="marketing-campaign-meta">
                    <span>ID {campaign.id}</span>
                    <span>{OBJECTIVES[objective] || "Objetivo pendente"}</span>
                  </div>

                  {link && !OBJECTIVES[objective] && (
                    <div className="marketing-objective-actions">
                      <span>Essa campanha traz:</span>
                      <button
                        className="button button-secondary button-small"
                        disabled={classifying === link.campanha_id}
                        onClick={() => classify(link, "profissional")}
                        type="button"
                      >
                        Profissionais
                      </button>
                      <button
                        className="button button-secondary button-small"
                        disabled={classifying === link.campanha_id}
                        onClick={() => classify(link, "cliente")}
                        type="button"
                      >
                        Clientes
                      </button>
                    </div>
                  )}
                </article>
              );
            });
          })}
        </div>
      </div>
    </section>
  );
}
