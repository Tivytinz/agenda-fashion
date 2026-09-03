import { useEffect, useState } from "react";
import { PublicShareButton } from "../PublicShareButton";
import { formatLocation } from "../../utils/format";
import { MediaThumb } from "./MediaThumb";
import { normalizeBusinessSpecialties } from "../../utils/specialties";

function normalizeWhatsApp(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function parseCoordinate(value, type) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const number = Number(raw.replace(",", "."));
  if (!Number.isFinite(number)) return null;
  if (type === "latitude" && (number < -90 || number > 90)) return null;
  if (type === "longitude" && (number < -180 || number > 180)) return null;
  return number;
}

function distanceInKm(
  originLatitude,
  originLongitude,
  destinationLatitude,
  destinationLongitude
) {
  const earthRadiusKm = 6371;
  const toRadians = (value) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(destinationLatitude - originLatitude);
  const longitudeDelta = toRadians(destinationLongitude - originLongitude);
  const calculation =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(originLatitude)) *
      Math.cos(toRadians(destinationLatitude)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(
    Math.sqrt(calculation),
    Math.sqrt(1 - calculation)
  );
}

function ActionIcon({ active = false, type }) {
  if (type === "favorite") {
    return (
      <svg className="action-icon favorite-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill={active ? "currentColor" : "none"}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
          d="M12 21s-7.2-4.35-9.33-8.72C.8 8.45 3.02 4.5 7.18 4.5c2.02 0 3.4 1.1 4.82 2.7 1.42-1.6 2.8-2.7 4.82-2.7 4.16 0 6.38 3.95 4.51 7.78C19.2 16.65 12 21 12 21Z"
        />
      </svg>
    );
  }

  if (type === "whatsapp") {
    return (
      <svg className="action-icon whatsapp-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 2a9.5 9.5 0 0 0-8.16 14.38L2.5 21.5l5.25-1.38A9.5 9.5 0 1 0 12 2Zm0 17.25a7.7 7.7 0 0 1-3.92-1.06l-.28-.17-3.12.82.83-3.04-.18-.29A7.75 7.75 0 1 1 12 19.25Zm4.25-5.78c-.23-.12-1.38-.68-1.59-.76-.21-.08-.36-.12-.52.12-.15.23-.59.76-.73.91-.13.16-.27.18-.5.06-.23-.12-.98-.36-1.86-1.15-.69-.61-1.15-1.37-1.28-1.6-.14-.23-.02-.36.1-.48.11-.1.23-.27.35-.41.12-.13.16-.23.23-.39.08-.15.04-.29-.02-.41-.06-.12-.52-1.25-.71-1.71-.18-.45-.37-.39-.51-.4h-.44c-.15 0-.4.06-.61.29-.21.23-.8.78-.8 1.91s.82 2.22.94 2.37c.12.16 1.62 2.48 3.93 3.48.55.24.98.38 1.31.49.55.17 1.05.15 1.45.09.44-.07 1.38-.56 1.57-1.1.2-.55.2-1.02.14-1.11-.06-.1-.21-.16-.44-.27Z"
        />
      </svg>
    );
  }

  return (
    <svg className="action-icon maps-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"
      />
    </svg>
  );
}

export function ProfileHero({
  bookingAvailable,
  business,
  businessSlug,
  favorite,
  favoriteBusy,
  favoriteStatus,
  imageSource,
  onToggleFavorite,
  rating,
  selectedService
}) {
  const [distanceKm, setDistanceKm] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle");
  const specialties = normalizeBusinessSpecialties(business);

  useEffect(() => {
    setDistanceKm(null);
    setLocationStatus("idle");
  }, [business.id]);

  const latitude = parseCoordinate(
    business.latitude ?? business.lat ?? business.endereco_latitude,
    "latitude"
  );
  const longitude = parseCoordinate(
    business.longitude ?? business.lng ?? business.lon ?? business.endereco_longitude,
    "longitude"
  );

  function requestDistance() {
    if (latitude === null || longitude === null || !navigator.geolocation) {
      setDistanceKm(null);
      setLocationStatus("unavailable");
      return;
    }

    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDistanceKm(distanceInKm(
          position.coords.latitude,
          position.coords.longitude,
          latitude,
          longitude
        ));
        setLocationStatus("ready");
      },
      () => {
        setDistanceKm(null);
        setLocationStatus("denied");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }

  const whatsappPhone = normalizeWhatsApp(
    business.whatsapp ?? business.telefone_whatsapp ?? business.telefone ?? business.celular
  );
  const whatsappServiceText = selectedService?.nome ? ` sobre ${selectedService.nome}` : "";
  const whatsappMessage = encodeURIComponent(
    `Olá! Encontrei ${business.nome} no Agenda Fashion e gostaria de saber mais${whatsappServiceText}.`
  );
  const whatsappUrl = whatsappPhone
    ? `https://wa.me/${whatsappPhone}?text=${whatsappMessage}`
    : "";
  const fullAddress = [
    business.endereco || business.logradouro,
    business.numero,
    business.bairro,
    business.cidade,
    business.estado,
    business.cep
  ].filter(Boolean).join(", ");
  const mapsQuery = latitude !== null && longitude !== null
    ? `${latitude},${longitude}`
    : fullAddress || formatLocation(business);
  const savedMapsUrl = String(
    business.google_maps_url ??
    business.google_maps_link ??
    business.link_google_maps ??
    business.maps_url ??
    business.google_maps ??
    ""
  ).trim();
  const mapsUrl = savedMapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;

  return (
    <section className="profile-hero">
      <MediaThumb
        src={imageSource}
        alt={`Foto de ${business.nome}`}
        className="profile-image"
      />
      <div className="profile-copy">
        <p className="eyebrow">{specialties[0] || "Beleza"}</p>
        <h1>{business.nome}</h1>
        <p>{business.descricao || "Escolha um serviço e encontre o melhor horário para você."}</p>
        {specialties.length > 0 && (
          <div className="profile-specialties" aria-label="Especialidades">
            {specialties.map((specialty) => (
              <span key={specialty}>{specialty}</span>
            ))}
          </div>
        )}
        <div className="profile-meta">
          <span className="profile-location">
            <span className="profile-location-emoji" aria-hidden="true">📍</span>{" "}
            {formatLocation(business) || "Atendimento local"}
          </span>
          <span aria-label={rating.ariaLabel}>
            {rating.label === "Novo" ? "✨ Novo" : rating.label}
          </span>
          {latitude !== null && longitude !== null && navigator.geolocation &&
            ["idle", "denied"].includes(locationStatus) && (
              <button className="profile-distance-button" onClick={requestDistance} type="button">
                {locationStatus === "denied" ? "Tentar ver distância" : "Ver distância"}
              </button>
            )}
          {locationStatus === "loading" && (
            <span aria-live="polite">Calculando distância...</span>
          )}
          {distanceKm !== null && distanceKm >= 0 && distanceKm <= 500 && (
            <span aria-live="polite">
              {distanceKm < 1
                ? `${Math.round(distanceKm * 1000)} m de você`
                : `${distanceKm.toFixed(1).replace(".", ",")} km de você`}
            </span>
          )}
        </div>
      </div>
      <div className={whatsappUrl ? "profile-actions has-whatsapp" : "profile-actions"}>
        {bookingAvailable && (
          <a className="button profile-book-button" href="#agendar">
            Agendar agora
          </a>
        )}
        <button
          aria-busy={favoriteBusy || favoriteStatus === "loading"}
          aria-pressed={favoriteStatus === "ready" ? favorite : undefined}
          className={favoriteStatus === "ready" && favorite
            ? "favorite-button active"
            : "favorite-button"}
          disabled={favoriteBusy || favoriteStatus === "loading"}
          onClick={onToggleFavorite}
          type="button"
        >
          <ActionIcon
            active={favoriteStatus === "ready" && favorite}
            type="favorite"
          />
          <span>{favoriteBusy
            ? "Salvando..."
            : favoriteStatus === "loading"
              ? "Verificando..."
              : favoriteStatus === "error"
                ? "Verificar favorito"
                : favorite
                  ? "Favoritado"
                  : "Favoritar"}</span>
        </button>
        <PublicShareButton
          businessId={business.id}
          businessName={business.nome}
          businessSlug={businessSlug}
          className="profile-action-button share"
          label="Compartilhar"
        />
        {whatsappUrl && (
          <a className="profile-action-button whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer">
            <ActionIcon type="whatsapp" />
            <span>WhatsApp</span>
          </a>
        )}
        <a className="profile-action-button maps" href={mapsUrl} target="_blank" rel="noreferrer">
          <ActionIcon type="maps" />
          <span>Como chegar</span>
        </a>
      </div>
    </section>
  );
}
