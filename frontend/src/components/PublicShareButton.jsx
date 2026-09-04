import {
  useMemo,
  useState
} from "react";
import { track } from "../analytics/track";
import {
  PUBLIC_LINK_MEDIA,
  buildPublicLink,
  copyPublicLink,
  sharePublicLink
} from "../utils/publicLinks";

function ShareIcon() {
  return (
    <svg
      aria-hidden="true"
      className="public-share-icon"
      viewBox="0 0 24 24"
    >
      <path
        d="M18 8a3 3 0 1 0-2.83-4A3 3 0 0 0 15 5c0 .2.02.4.06.58L8.9 9.1A3 3 0 0 0 7 8.42a3 3 0 1 0 1.9 5.48l6.16 3.52A3 3 0 0 0 15 18a3 3 0 1 0 .9-2.14l-6.17-3.53a3.1 3.1 0 0 0 0-.66l6.17-3.53A3 3 0 0 0 18 8Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function PublicShareButton({
  ariaLabel,
  businessId,
  businessName,
  businessSlug,
  className = "",
  label = "Compartilhar",
  mode = "share",
  onIntent,
  origin,
  serviceId,
  serviceName,
  shareText,
  shareTitle,
  trackingMission = "descobrir_compartilhar_agendar",
  trackingPage = "perfil_negocio"
}) {
  const [status, setStatus] =
    useState("idle");

  const isService =
    Boolean(serviceId);

  const acquisitionMedium =
    mode === "copy"
      ? PUBLIC_LINK_MEDIA.COPY
      : PUBLIC_LINK_MEDIA.SHARE;

  const url = useMemo(
    () => buildPublicLink({
      businessSlug,
      serviceId,
      origin,
      acquisition: {
        medium:
          acquisitionMedium,
        content:
          isService
            ? "servico"
            : "negocio"
      }
    }),
    [
      acquisitionMedium,
      businessSlug,
      isService,
      origin,
      serviceId
    ]
  );

  const eventPrefix =
    isService
      ? "link_servico"
      : "link_negocio";

  const trackingBase = {
    page: trackingPage,
    mission:
      trackingMission,
    businessId,
    properties: {
      tipo_link:
        isService
          ? "servico"
          : "negocio",
      af_source:
        "agenda_fashion",
      af_medium:
        acquisitionMedium,
      af_content:
        isService
          ? "servico"
          : "negocio",
      ...(isService
        ? {
            servico_id:
              Number(serviceId),
            servico_nome:
              serviceName
          }
        : {})
    }
  };

  const defaultTitle = isService
    ? `${serviceName || "Serviço"} em ${businessName || "Agenda Fashion"}`
    : `${businessName || "Negócio"} | Agenda Fashion`;

  const defaultText = isService
    ? `Veja ${serviceName || "este serviço"} e escolha seu horário no Agenda Fashion.`
    : `Veja os serviços de ${businessName || "este negócio"} e escolha seu horário no Agenda Fashion.`;

  const title = String(shareTitle || defaultTitle)
    .trim()
    .slice(0, 120);
  const text = String(shareText || defaultText)
    .trim()
    .slice(0, 800);
  const customShareText = Boolean(String(shareText || "").trim());

  async function handleClick(
    event
  ) {
    event.stopPropagation();

    if (!url || status === "busy") {
      return;
    }

    try {
      onIntent?.();
    } catch {
      // Observabilidade opcional nunca bloqueia o compartilhamento.
    }

    setStatus("busy");

    try {
      if (mode === "copy") {
        await copyPublicLink(url);
        setStatus("copied");
        track(
          `${eventPrefix}_copiado`,
          {
            ...trackingBase,
            properties: {
              ...trackingBase.properties,
              metodo:
                "area_transferencia"
            }
          }
        );
        return;
      }

      const result =
        await sharePublicLink({
          title,
          text,
          url,
          fallbackText: customShareText
            ? `${text}\n\n${url}`
            : ""
        });

      if (
        result === "cancelled"
      ) {
        setStatus("idle");
        return;
      }

      const copied =
        result === "copied";

      setStatus(
        copied
          ? "copied"
          : "shared"
      );

      track(
        copied
          ? `${eventPrefix}_copiado`
          : `${eventPrefix}_compartilhado`,
        {
          ...trackingBase,
          properties: {
            ...trackingBase.properties,
            metodo: copied
              ? "fallback_area_transferencia"
              : "compartilhamento_nativo"
          }
        }
      );
    } catch {
      setStatus("error");
    }
  }

  const feedback =
    status === "busy"
      ? mode === "copy"
        ? "Copiando..."
        : "Abrindo..."
      : status === "copied"
        ? "Link copiado"
        : status === "shared"
          ? "Compartilhado"
          : status === "error"
            ? "Tente novamente"
            : label;

  return (
    <button
      aria-label={
        ariaLabel || label
      }
      className={[
        "public-share-button",
        className
      ].filter(Boolean).join(" ")}
      disabled={!url || status === "busy"}
      onClick={handleClick}
      title={url}
      type="button"
    >
      <ShareIcon />
      <span aria-live="polite">
        {feedback}
      </span>
    </button>
  );
}
