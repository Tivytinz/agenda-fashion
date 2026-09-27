import { useEffect } from "react";
import { Link } from "react-router-dom";
import { track } from "../analytics/track";
import { formatCurrency } from "../utils/format";
import { planFeatures } from "../utils/plans";

function normalizeText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

export function PlanUpgradeOpportunity({
  upgrade,
  source,
  trigger,
  trackingPage,
  title,
  description,
}) {
  const available = upgrade?.disponivel === true;
  const currentPlan = upgrade?.plano_atual || null;
  const targetPlan = upgrade?.plano_destino || null;
  const sourceCode = normalizeText(source, "contextual");
  const triggerCode = normalizeText(trigger, sourceCode);
  const page = normalizeText(trackingPage, "minha_assinatura");
  const businessId = Number(upgrade?.negocio_id) || undefined;
  const targetSlug = normalizeText(targetPlan?.slug);
  const currentSlug = normalizeText(currentPlan?.slug);

  useEffect(() => {
    if (!available || !targetSlug) return;

    track("upgrade_oportunidade_visualizada", {
      page,
      mission: "escolher_plano",
      businessId,
      properties: {
        origem: sourceCode,
        gatilho_upgrade: triggerCode,
        plano_atual: currentSlug,
        plano_destino: targetSlug,
      },
    });
  }, [
    available,
    businessId,
    currentSlug,
    page,
    sourceCode,
    targetSlug,
    triggerCode,
  ]);

  if (!available || !targetPlan || !targetSlug) {
    return null;
  }

  const checkoutTarget =
    `/checkout?plano=${encodeURIComponent(targetSlug)}&upgrade_origem=${encodeURIComponent(sourceCode)}`;
  const features = planFeatures(targetPlan).slice(0, 3);

  function trackSelection() {
    track("upgrade_selecionado", {
      page,
      mission: "escolher_plano",
      businessId,
      properties: {
        origem: sourceCode,
        gatilho_upgrade: triggerCode,
        plano_atual: currentSlug,
        plano_destino: targetSlug,
      },
    });
  }

  return (
    <section
      aria-label="Oportunidade de upgrade"
      className="panel plan-upgrade-opportunity"
    >
      <div>
        <p className="eyebrow">Mais capacidade quando fizer sentido</p>
        <h2>{title || `Próximo plano: ${targetPlan.nome}`}</h2>
        <p className="muted">
          {description ||
            `${targetPlan.nome} amplia os limites do seu negócio por ${formatCurrency(targetPlan.valor)}/mês.`}
        </p>
      </div>

      <ul className="plan-upgrade-capabilities">
        {features.map((feature) => (
          <li key={feature}>✓ {feature}</li>
        ))}
      </ul>

      <div className="quick-actions">
        <Link
          className="button"
          onClick={trackSelection}
          to={checkoutTarget}
        >
          Fazer upgrade para {targetPlan.nome}
        </Link>
        <Link className="text-link" to="/planos">
          Comparar planos
        </Link>
      </div>
    </section>
  );
}
