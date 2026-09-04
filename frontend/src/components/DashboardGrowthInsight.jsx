import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { track } from "../analytics/track";
import { PublicShareButton } from "./PublicShareButton";

const ALLOWED_DESTINATIONS = new Set([
  "/painel/agenda",
  "/painel/servicos",
  "/painel/horarios",
  "/painel/negocio",
]);

const ALLOWED_PERIODS = new Set([
  "hoje",
  "7dias",
  "30dias",
  "mes",
]);

const TRACKING_CONTEXT = Object.freeze({
  page: "dashboard_dono",
  mission: "gerenciar_crescimento",
});

const EMPTY_COMPOSER = Object.freeze({
  status: "idle",
  titulo: "",
  texto: "",
  fonte: "",
  erro: "",
});

function normalizedInsight(insight) {
  if (
    insight?.status !== "OPORTUNIDADE_PRIORIZADA" ||
    !insight?.oportunidade_principal
  ) {
    return null;
  }

  const opportunity = insight.oportunidade_principal;
  const actionType = String(opportunity.acao?.tipo || "");
  const requestedDestination =
    typeof opportunity.acao?.destino === "string"
      ? opportunity.acao.destino
      : "";
  const safeDestination = ALLOWED_DESTINATIONS.has(
    requestedDestination
  )
    ? requestedDestination
    : null;

  return {
    ...opportunity,
    codigo: String(opportunity.codigo || "INDISPONIVEL"),
    categoria: String(opportunity.categoria || "geral"),
    titulo:
      String(opportunity.titulo || "").trim() ||
      "Oportunidade de crescimento",
    mensagem: String(opportunity.mensagem || "").trim(),
    evidencias: Array.isArray(opportunity.evidencias)
      ? opportunity.evidencias.slice(0, 4)
      : [],
    acao: {
      tipo: actionType,
      rotulo: String(opportunity.acao?.rotulo || "").trim(),
      destino: safeDestination,
    },
  };
}

function formatEvidenceValue(item) {
  const value = item?.valor ?? 0;
  return item?.unidade ? `${value}${item.unidade}` : String(value);
}

export function DashboardGrowthInsight({
  insight,
  businessId,
  businessName,
  businessSlug,
}) {
  const [composer, setComposer] = useState(EMPTY_COMPOSER);
  const opportunity = normalizedInsight(insight);
  const opportunityCode = opportunity?.codigo || "";
  const opportunityCategory = opportunity?.categoria || "";
  const period = ALLOWED_PERIODS.has(String(insight?.periodo || ""))
    ? String(insight.periodo)
    : "7dias";
  const canGenerateShare =
    opportunity?.acao?.tipo === "COMPARTILHAR_PERFIL";

  useEffect(() => {
    if (!opportunityCode) return;

    track("oportunidade_crescimento_visualizada", {
      ...TRACKING_CONTEXT,
      businessId,
      properties: {
        codigo_oportunidade: opportunityCode,
        categoria_oportunidade: opportunityCategory,
      },
    });
  }, [businessId, opportunityCategory, opportunityCode]);

  useEffect(() => {
    setComposer(EMPTY_COMPOSER);
  }, [opportunityCode, period]);

  if (!opportunity) return null;

  function trackSelection() {
    track("oportunidade_crescimento_selecionada", {
      ...TRACKING_CONTEXT,
      businessId,
      properties: {
        codigo_oportunidade: opportunity.codigo,
        categoria_oportunidade: opportunity.categoria,
        tipo_acao: opportunity.acao.tipo,
      },
    });
  }

  async function generateShareCopy() {
    if (!canGenerateShare || composer.status === "loading") return;

    track("copilot_divulgacao_solicitada", {
      ...TRACKING_CONTEXT,
      businessId,
      properties: {
        codigo_oportunidade: opportunity.codigo,
        categoria_oportunidade: opportunity.categoria,
        canal_copilot: "whatsapp",
      },
    });

    setComposer({
      ...EMPTY_COMPOSER,
      status: "loading",
    });

    try {
      const result = await apiRequest(
        "/dashboard-dono/copilot/divulgacao",
        {
          method: "POST",
          timeoutMs: 12000,
          body: {
            periodo: period,
            canal: "whatsapp",
          },
        }
      );

      const nextComposer = {
        status: "ready",
        titulo: String(result.titulo || "").trim(),
        texto: String(result.texto || "").trim().slice(0, 600),
        fonte: result.fonte === "openai" ? "openai" : "fallback",
        erro: "",
      };

      setComposer(nextComposer);

      track("copilot_divulgacao_gerada", {
        ...TRACKING_CONTEXT,
        businessId,
        properties: {
          codigo_oportunidade: opportunity.codigo,
          categoria_oportunidade: opportunity.categoria,
          canal_copilot: "whatsapp",
          fonte_copilot: nextComposer.fonte,
        },
      });
    } catch (requestError) {
      setComposer({
        ...EMPTY_COMPOSER,
        status: "error",
        erro:
          requestError?.message ||
          "Não foi possível criar a sugestão agora.",
      });
    }
  }

  return (
    <section
      aria-labelledby="dashboard-growth-insight-title"
      className="panel dashboard-action-panel"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Oportunidade de crescimento</p>
          <h2 id="dashboard-growth-insight-title">
            {opportunity.titulo}
          </h2>
        </div>
      </div>

      {opportunity.mensagem && (
        <p className="muted dashboard-action-copy">
          {opportunity.mensagem}
        </p>
      )}

      {opportunity.evidencias.length > 0 && (
        <dl
          aria-label="Evidências da oportunidade"
          className="data-list"
        >
          {opportunity.evidencias.map((item) => (
            <div key={String(item?.chave || item?.rotulo)}>
              <dt>{item?.rotulo || "Sinal"}</dt>
              <dd>{formatEvidenceValue(item)}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="quick-actions dashboard-quick-actions">
        {opportunity.acao.tipo === "COMPARTILHAR_PERFIL" ? (
          <PublicShareButton
            businessId={businessId}
            businessName={businessName}
            businessSlug={businessSlug}
            className="button"
            label={opportunity.acao.rotulo || "Compartilhar perfil"}
            onIntent={trackSelection}
            trackingMission="gerenciar_crescimento"
            trackingPage="dashboard_dono"
          />
        ) : (
          opportunity.acao.tipo === "NAVEGAR" &&
          opportunity.acao.destino && (
            <Link
              className="button"
              onClick={trackSelection}
              to={opportunity.acao.destino}
            >
              {opportunity.acao.rotulo || "Ver oportunidade"}
            </Link>
          )
        )}

        {canGenerateShare && (
          <button
            className="button"
            disabled={composer.status === "loading"}
            onClick={generateShareCopy}
            type="button"
          >
            {composer.status === "loading"
              ? "Criando sugestão..."
              : "✨ Criar texto de divulgação"}
          </button>
        )}
      </div>

      {composer.status === "error" && (
        <p className="form-error" role="alert">
          {composer.erro}
        </p>
      )}

      {composer.status === "ready" && (
        <div className="dashboard-copilot-composer">
          <p className="eyebrow">
            {composer.fonte === "openai" ? "Copilot AF" : "Sugestão automática"}
          </p>
          <p className="muted">
            Revise o texto antes de enviar. O link rastreável do seu perfil será acrescentado pelo Agenda Fashion no compartilhamento.
          </p>
          <label>
            <span>Texto para WhatsApp</span>
            <textarea
              aria-label="Texto de divulgação"
              onChange={(event) =>
                setComposer((current) => ({
                  ...current,
                  texto: event.target.value.slice(0, 600),
                }))
              }
              rows={5}
              value={composer.texto}
            />
          </label>
          <div className="quick-actions dashboard-quick-actions">
            <PublicShareButton
              businessId={businessId}
              businessName={businessName}
              businessSlug={businessSlug}
              className="button"
              label="Compartilhar texto + perfil"
              shareText={composer.texto}
              shareTitle={composer.titulo}
              trackingMission="gerenciar_crescimento"
              trackingPage="dashboard_dono"
            />
            <button
              className="text-button"
              onClick={generateShareCopy}
              type="button"
            >
              Gerar outra sugestão
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
