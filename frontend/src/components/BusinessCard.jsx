import { Link } from "react-router-dom";
import {
  formatLocation,
  formatRating
} from "../utils/format";
import { useRetryingMedia } from "../hooks/useRetryingMedia";
import {
  normalizeBusinessSpecialties,
  serviceCategoryEmoji
} from "../utils/specialties";

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
  } = useRetryingMedia(coverSource, {
    width: 420,
    fit: "contain"
  });

  const specialtyEmoji = serviceCategoryEmoji(
    specialties[0],
    business.setor
  );

  const card = (
    <article
      className={
        available
          ? "card business-card business-card-available"
          : "card business-card business-card-unavailable"
      }
    >
      <div
        className={hasImage ? "card-image card-image-photo" : "card-image"}
        aria-hidden={!hasImage}
      >
        {hasImage ? (
          <>
            <img
              className="business-cover-backdrop"
              src={imageUrl}
              alt=""
              loading="lazy"
            />
            <img
              className="business-cover-image"
              src={imageUrl}
              alt=""
              loading="lazy"
              onError={handleImageError}
            />
          </>
        ) : (
          <span className="card-placeholder">
            <span
              className="business-specialty-emoji"
              aria-hidden="true"
            >
              {specialtyEmoji}
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
              <span>
                {formatLocation(business) || "Atendimento local"}
              </span>
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
            <span className="button button-small">
              Ver perfil
            </span>
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

  if (!available) return card;

  return (
    <Link
      className="business-card-link"
      to={`/negocio/${encodeURIComponent(business.slug)}`}
      aria-label={`Ver perfil de ${business.nome}`}
    >
      {card}
    </Link>
  );
}
