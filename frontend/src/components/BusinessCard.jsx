import { useState } from "react";
import { Link } from "react-router-dom";
import {
  formatCurrency,
  formatLocation,
  formatRating
} from "../utils/format";

export function BusinessCard({ business }) {
  const featuredServices =
    (business.servicos || []).slice(0, 2);

  const serviceCount =
    business.servicos?.length || 0;

  const available = serviceCount > 0;
  const rating = formatRating(business);

  const [imageFailed, setImageFailed] =
    useState(false);

  const hasImage =
    Boolean(business.foto_url) &&
    !imageFailed;

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
            src={business.foto_url}
            alt=""
            loading="lazy"
            onError={() =>
              setImageFailed(true)
            }
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
              {business.setor || "Beleza"}
            </small>
          </span>
        )}
      </div>

      <div className="card-content">
        <div className="business-heading">
          <div>
            <h3>{business.nome}</h3>

            <p className="muted location">
              ⌖{" "}
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

        {featuredServices.length > 0 && (
          <ul
            className="service-preview"
            aria-label="Serviços em destaque"
          >
            {featuredServices.map(
              (service) => (
                <li key={service.id}>
                  <span>{service.nome}</span>

                  <strong>
                    {formatCurrency(
                      service.valor
                    )}
                  </strong>
                </li>
              )
            )}
          </ul>
        )}

        <div className="card-footer">
          <small>
            {available
              ? `${serviceCount} ${
                  serviceCount === 1
                    ? "serviço"
                    : "serviços"
                }`
              : "Agenda em configuração"}
          </small>

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