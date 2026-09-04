import { useEffect } from "react";
import { Link } from "react-router-dom";
import { track } from "../analytics/track";
import { PublicShareButton } from "./PublicShareButton";

const ALLOWED_DESTINATIONS = new Set([
  "/painel/agenda",
  "/painel/servicos",
  "/painel/horarios",
  "/painel/negocio",
]);

const TRACKING_CONTEXT = Object.freeze({
  page: "dashboard_dono",
  mission: "gerenciar_crescimento",
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
  const opportunity = normalizedInsight(insight);
  const opportunityCode = opportunity?.codigo || "";
  const opportunityCategory = opportunity?.categoria || "";

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
      </div>
    </section>
  );
}
