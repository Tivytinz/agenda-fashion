import { Link } from "react-router-dom";
import {
  formatLocation,
  formatRating
} from "../utils/format";
import { useRetryingMedia } from "../hooks/useRetryingMedia";
import { normalizeBusinessSpecialties } from "../utils/specialties";

export function BusinessCard({ business }) {
  const serviceCount =
    business.servicos?.length || 0;

  const available = serviceCount > 0;
  const rating = formatRating(business);
  const specialties = normalizeBusinessSpecialties(business);

  const coverSource = business.foto_url ||
    business.servicos?.find((service) => service.foto_url)?.foto_url;

  const {
    handleError: handleImageError,
    hasImage,
    imageUrl
  } = useRetryingMedia(coverSource, { width: 420 });

  const initial = String(
    business.nome || "A"
  )
    .trim()
    .charAt(0)
    .toLocaleUpperCase("pt-BR");

  return (
    <article
      className={
        available
          ? "card business-card business-card-available"
          : "card business-card business-card-unavailable"
      }
    >
      <div
        className="card-image"
        aria-hidden={!hasImage}
      >
        {hasImage ? (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            onError={handleImageError}
          />
        ) : (
          <span className="card-placeholder">
            <span
              className="business-initial"
              aria-hidden="true"
            >
              {initial}
            </span>

            <small>
              {specialties[0] || "Beleza"}
            </small>
          </span>
        )}
      </div>

      <div className="card-content">
        <div className="business-heading">
          <div>
            <h3 className="discovery-labeled-value">
              <span aria-hidden="true">🏢</span>
              {business.nome}
            </h3>

            <p className="muted location discovery-labeled-value">
              <span aria-hidden="true">📍</span>
              {formatLocation(business) ||
                "Atendimento local"}
            </p>
          </div>

          <span
            className={
              rating.label === "Novo"
                ? "rating rating-new"
                : "rating"
            }
            aria-label={rating.ariaLabel}
          >
            {rating.label}
          </span>
        </div>

        {business.descricao && (
          <p className="business-description">
            {business.descricao}
          </p>
        )}

        <div className="card-footer">
          {!available && <small>Agenda em configuração</small>}

          {available ? (
            <Link
              className="button button-small"
              to={`/negocio/${encodeURIComponent(
                business.slug
              )}`}
            >
              Ver horários
            </Link>
          ) : (
            <span
              className="button button-small button-unavailable"
              aria-disabled="true"
            >
              Indisponível
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
