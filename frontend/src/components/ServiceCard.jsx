import { useState } from "react";
import { Link } from "react-router-dom";
import {
  formatCurrency,
  formatLocation
} from "../utils/format";
import { resolveMediaUrl, withMediaRetry } from "../utils/media";

export function ServiceCard({
  service
}) {
  const [imageFailed, setImageFailed] =
    useState(false);
  const [imageRetry, setImageRetry] =
    useState(0);

  const hasImage =
    Boolean(service.foto_url) &&
    !imageFailed;

  const imageUrl = withMediaRetry(resolveMediaUrl(
    service.foto_url,
    { width: 520 }
  ), imageRetry);

  function handleImageError() {
    if (imageRetry < 1) {
      setImageRetry(1);
      return;
    }
    setImageFailed(true);
  }

  const initial = String(
    service.nome || "S"
  )
    .trim()
    .charAt(0)
    .toLocaleUpperCase("pt-BR");

  const bookingUrl =
    `/negocio/${encodeURIComponent(
      service.negocio_slug
    )}?servico=${encodeURIComponent(
      service.id
    )}`;

  return (
    <article className="card service-discovery-card">
      <Link
        className="service-discovery-image"
        to={bookingUrl}
        aria-label={`Ver horários para ${service.nome}`}
      >
        {hasImage ? (
          <img
            src={imageUrl}
            alt={`Resultado de ${service.nome}`}
            loading="lazy"
            onError={handleImageError}
          />
        ) : (
          <span className="service-discovery-placeholder">
            <strong aria-hidden="true">
              {initial}
            </strong>

            <small>
              {service.categoria ||
                service.negocio_setor ||
                "Beleza"}
            </small>
          </span>
        )}
      </Link>

      <div className="service-discovery-content">
        <p className="eyebrow">
          {service.negocio_setor ||
            "Serviço de beleza"}
        </p>

        <h3>{service.nome}</h3>

        {service.descricao && (
          <p className="service-discovery-description">
            {service.descricao}
          </p>
        )}

        <div className="service-business-info">
          <strong>
            {service.negocio_nome}
          </strong>

          <small>
            {formatLocation({
              cidade: service.negocio_cidade,
              bairro: service.negocio_bairro,
              estado: service.negocio_estado
            }) || "Atendimento local"}
          </small>
        </div>

        <div className="service-discovery-meta">
          <span>
            {service.duracao_minutos
              ? `${service.duracao_minutos} min`
              : "Consulte a duração"}
          </span>

          <strong>
            {formatCurrency(service.valor)}
          </strong>
        </div>

        <Link
          className="button button-full"
          to={bookingUrl}
        >
          Ver horários
        </Link>
      </div>
    </article>
  );
}
