import { Link } from "react-router-dom";
import {
  formatCurrency,
  formatLocation
} from "../utils/format";
import { useRetryingMedia } from "../hooks/useRetryingMedia";
import { categoryCardImage } from "../utils/categoryMedia";
import {
  serviceCategoryEmoji,
  serviceCategoryLabel
} from "../utils/specialties";
import { buildLocalCatalogPath } from "../utils/localCatalog";

export function ServiceCard({
  service
}) {
  const {
    handleError: handleImageError,
    hasImage,
    imageUrl
  } = useRetryingMedia(service.foto_url, {
    width: 520,
    fit: "contain"
  });

  const bookingUrl =
    `/negocio/${encodeURIComponent(
      service.negocio_slug
    )}?servico=${encodeURIComponent(
      service.id
    )}`;
  const category = serviceCategoryLabel(service.categoria);
  const categoryEmoji = serviceCategoryEmoji(
    service.categoria,
    service.nome
  );
  const fallbackImage = categoryCardImage(
    service.categoria,
    service.nome
  );
  const localCatalogPath = buildLocalCatalogPath({
    category: service.categoria,
    city: service.negocio_cidade,
    state: service.negocio_estado
  });

  return (
    <article className="card service-discovery-card">
      <Link
        className="service-discovery-image"
        to={bookingUrl}
        aria-label={`Ver horários para ${service.nome}`}
      >
        {hasImage ? (
          <>
            <img
              className="service-cover-backdrop"
              src={imageUrl}
              alt=""
              loading="lazy"
            />
            <img
              className="service-cover-image"
              src={imageUrl}
              alt={`Resultado de ${service.nome}`}
              loading="lazy"
              onError={handleImageError}
            />
          </>
        ) : fallbackImage ? (
          <img
            alt=""
            className="service-category-fallback"
            loading="lazy"
            src={fallbackImage}
          />
        ) : (
          <span className="service-discovery-placeholder">
            <strong aria-hidden="true">
              {categoryEmoji}
            </strong>

            <small>
              {category}
            </small>
          </span>
        )}
      </Link>

      <div className="service-discovery-content">
        {localCatalogPath ? (
          <Link
            className="eyebrow text-link"
            to={localCatalogPath}
          >
            {category}
          </Link>
        ) : (
          <p className="eyebrow">
            {category}
          </p>
        )}

        <h3>{service.nome}</h3>

        {service.descricao && (
          <p className="service-discovery-description">
            {service.descricao}
          </p>
        )}

        <div className="service-business-info">
          <strong className="discovery-labeled-value">
            <span aria-hidden="true">🏢</span>
            {service.negocio_nome}
          </strong>

          <small className="discovery-labeled-value">
            <span aria-hidden="true">📍</span>
            <span className="service-location-text">
              {formatLocation({
                cidade: service.negocio_cidade,
                bairro: service.negocio_bairro,
                estado: service.negocio_estado
              }) || "Atendimento local"}
            </span>
          </small>
        </div>

        <div className="service-discovery-meta">
          <span className="discovery-labeled-value">
            <span aria-hidden="true">🕒</span>
            {service.duracao_minutos
              ? `${service.duracao_minutos} min`
              : "Consulte a duração"}
          </span>

          <strong className="discovery-labeled-value">
            <span aria-hidden="true">💰</span>
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
