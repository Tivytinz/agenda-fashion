import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { track } from "../analytics/track";
import { FlowSteps } from "../components/FlowSteps";
import { EmptyState, ErrorState, LoadingState } from "../components/ScreenState";
import {
  formatCurrency,
  formatDate,
  formatLocation,
  formatRating,
  normalizeAvailability
} from "../utils/format";

function normalizeWhatsApp(value) {
  const digits = String(value || "")
    .replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (
    digits.length === 10 ||
    digits.length === 11
  ) {
    return `55${digits}`;
  }

  return digits;
}

function parseCoordinate(value, type) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  const number = Number(
    raw.replace(",", ".")
  );

  if (!Number.isFinite(number)) {
    return null;
  }

  if (
    type === "latitude" &&
    (number < -90 || number > 90)
  ) {
    return null;
  }

  if (
    type === "longitude" &&
    (number < -180 || number > 180)
  ) {
    return null;
  }

  return number;
}

function distanceInKm(
  originLatitude,
  originLongitude,
  destinationLatitude,
  destinationLongitude
) {
  const earthRadiusKm = 6371;
  const toRadians = (value) =>
    (value * Math.PI) / 180;

  const latitudeDelta = toRadians(
    destinationLatitude - originLatitude
  );

  const longitudeDelta = toRadians(
    destinationLongitude - originLongitude
  );

  const calculation =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(originLatitude)) *
      Math.cos(toRadians(destinationLatitude)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    earthRadiusKm *
    2 *
    Math.atan2(
      Math.sqrt(calculation),
      Math.sqrt(1 - calculation)
    )
  );
}

function getServiceEmoji(name) {
  const normalized = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

  if (
    normalized.includes("cilio") ||
    normalized.includes("sobrancelha")
  ) {
    return "👁️";
  }

  if (
    normalized.includes("unha") ||
    normalized.includes("manicure") ||
    normalized.includes("pedicure")
  ) {
    return "💅";
  }

  if (
    normalized.includes("cabelo") ||
    normalized.includes("corte") ||
    normalized.includes("escova") ||
    normalized.includes("penteado")
  ) {
    return "💇";
  }

  if (
    normalized.includes("maquiagem") ||
    normalized.includes("make")
  ) {
    return "💄";
  }

  if (
    normalized.includes("pele") ||
    normalized.includes("limpeza") ||
    normalized.includes("massagem") ||
    normalized.includes("estetica")
  ) {
    return "💆";
  }

  return "✨";
}

function MediaThumb({
  src,
  alt,
  className = "",
  emoji = "💅"
}) {
  const [failed, setFailed] = useState(false);
  const hasImage = Boolean(src) && !failed;

  return (
    <span
      className={`af-media-thumb ${className}`.trim()}
    >
      {hasImage ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="af-media-fallback"
          aria-hidden="true"
        >
          {emoji}
        </span>
      )}
    </span>
  );
}

export function ProfilePage() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [serviceId, setServiceId] = useState(searchParams.get("servico") || "");
  const [professionalId, setProfessionalId] = useState(
    searchParams.get("profissional") || ""
  );
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [availability, setAvailability] = useState([]);
  const [status, setStatus] = useState("loading");
  const [scheduleStatus, setScheduleStatus] = useState("idle");
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [scheduleReload, setScheduleReload] = useState(0);
  const [profileReload, setProfileReload] = useState(0);
  const [error, setError] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [distanceKm, setDistanceKm] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle");

  useEffect(() => {
    const controller = new AbortController();

    async function loadProfile() {
      setStatus("loading");
      setError("");

      try {
        const data = await apiRequest(
          `/perfil-negocio/${encodeURIComponent(slug)}`,
          { signal: controller.signal }
        );
        setProfile(data);
        setStatus("ready");
        track("perfil_visualizado", {
          page: "perfil_negocio",
          mission: "escolher_e_agendar",
          businessId: data.negocio?.id,
          properties: { origem: "inicio" }
        });
      } catch (requestError) {
        if (requestError.name === "AbortError") {
          return;
        }

        setError(requestError.message);
        setStatus("error");
      }
    }

    void loadProfile();
    return () => controller.abort();
  }, [profileReload, slug]);

  useEffect(() => {
    const businessId = profile?.negocio?.id;
    if (!businessId || !localStorage.getItem("token")) return;

    apiRequest(`/favoritos/${businessId}/status`)
      .then((result) => setFavorite(Boolean(
        result.favoritado ?? result.favorito ?? result.is_favorito
      )))
      .catch(() => {});
  }, [profile]);

    useEffect(() => {
    const business = profile?.negocio;

    const latitude = parseCoordinate(
      business?.latitude ??
      business?.lat ??
      business?.endereco_latitude,
      "latitude"
    );

    const longitude = parseCoordinate(
      business?.longitude ??
      business?.lng ??
      business?.lon ??
      business?.endereco_longitude,
      "longitude"
    );

    if (
      latitude === null ||
      longitude === null ||
      !navigator.geolocation
    ) {
      setDistanceKm(null);
      setLocationStatus("unavailable");
      return;
    }

    setLocationStatus("loading");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const distance = distanceInKm(
          position.coords.latitude,
          position.coords.longitude,
          latitude,
          longitude
        );

        setDistanceKm(distance);
        setLocationStatus("ready");
      },
      () => {
        setDistanceKm(null);
        setLocationStatus("denied");
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 300000
      }
    );
  }, [profile]);

  useEffect(() => {
    if (!serviceId || !professionalId) {
      setAvailability([]);
      setDay("");
      setTime("");
      return;
    }

    const controller = new AbortController();

    async function loadAvailability() {
      setScheduleStatus("loading");
      setScheduleMessage("");
      setError("");
      setDay("");
      setTime("");

      try {
        const params = new URLSearchParams({
          slug,
          servicoId: serviceId,
          profissionalId: professionalId
        });
        const data = await apiRequest(
          `/agenda-publica?${params}`,
          { signal: controller.signal }
        );
        const availableDays = normalizeAvailability(data.disponibilidade);
        setAvailability(availableDays);
        setDay(availableDays[0]?.data || "");
        setScheduleMessage(
          data.mensagem || (
            data.agenda_indisponivel
              ? "A agenda atingiu o limite deste período."
              : ""
          )
        );
        setScheduleStatus("ready");
      } catch (requestError) {
        if (requestError.name === "AbortError") {
          return;
        }

        setError(requestError.message);
        setScheduleStatus("error");
      }
    }

    void loadAvailability();
    return () => controller.abort();
  }, [professionalId, scheduleReload, serviceId, slug]);

  useEffect(() => {
    if (
      profile &&
      serviceId &&
      !professionalId &&
      profile.profissionais?.length === 1
    ) {
      setProfessionalId(String(profile.profissionais[0].id));
    }
  }, [professionalId, profile, serviceId]);

  const selectedService = useMemo(
    () => profile?.servicos?.find((service) => String(service.id) === String(serviceId)),
    [profile, serviceId]
  );
  const selectedProfessional = useMemo(
    () => profile?.profissionais?.find((person) => String(person.id) === String(professionalId)),
    [profile, professionalId]
  );
  const selectedDay = availability.find((item) => item.data === day);
  const currentStep = !serviceId ? 1 : !professionalId ? 2 : !time ? 3 : 4;

  function selectService(id) {
    setServiceId(String(id));
    const nextProfessionalId = profissionais.length === 1
      ? String(profissionais[0].id)
      : "";
    setProfessionalId(nextProfessionalId);
    setSearchParams({
      servico: String(id),
      ...(nextProfessionalId ? { profissional: nextProfessionalId } : {})
    }, { replace: true });
    setDay("");
    setTime("");
    track("servico_selecionado", {
      page: "perfil_negocio",
      mission: "escolher_e_agendar",
      businessId: profile.negocio.id,
      properties: { origem: "perfil", servico_id: Number(id) }
    });
  }

  function selectProfessional(id) {
    setProfessionalId(String(id));
    setSearchParams({
      servico: serviceId,
      profissional: String(id)
    }, { replace: true });
    setDay("");
    setTime("");
    track("profissional_selecionado", {
      page: "perfil_negocio",
      mission: "escolher_e_agendar",
      businessId: profile.negocio.id,
      properties: { profissional_id: Number(id) }
    });
  }

  function continueToConfirmation() {
    const booking = {
      slug,
      business: profile.negocio,
      service: selectedService,
      professional: selectedProfessional,
      date: day,
      time
    };

    sessionStorage.setItem("af_booking_draft", JSON.stringify(booking));
    track("agendamento_iniciado", {
      page: "perfil_negocio",
      mission: "escolher_e_agendar",
      businessId: profile.negocio.id,
      properties: {
        origem: localStorage.getItem("token") ? "cliente_logada" : "visitante",
        servico_id: Number(serviceId)
      }
    });
    navigate("/confirmar", { state: booking });
  }

  async function toggleFavorite() {
    if (!localStorage.getItem("token")) {
      navigate("/entrar", { state: { from: `/negocio/${slug}` } });
      return;
    }

    setFavoriteBusy(true);
    try {
      await apiRequest(`/favoritos/${profile.negocio.id}`, {
        method: favorite ? "DELETE" : "POST"
      });
      setFavorite((current) => !current);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setFavoriteBusy(false);
    }
  }

  if (status === "loading") {
    return <main className="container page-content"><LoadingState>Carregando o perfil...</LoadingState></main>;
  }

  if (status === "error") {
    return (
      <main className="container page-content">
        <ErrorState
          message={error}
          onRetry={() => setProfileReload((value) => value + 1)}
        />
      </main>
    );
  }

    const { negocio, servicos = [], profissionais = [] } = profile;
  const rating = formatRating(negocio);

  const whatsappPhone = normalizeWhatsApp(
    negocio.whatsapp ??
    negocio.telefone_whatsapp ??
    negocio.telefone ??
    negocio.celular
  );

  const whatsappServiceText = selectedService?.nome
    ? ` sobre ${selectedService.nome}`
    : "";

  const whatsappMessage = encodeURIComponent(
    `Olá! Encontrei ${negocio.nome} no Agenda Fashion e gostaria de saber mais${whatsappServiceText}.`
  );

  const whatsappUrl = whatsappPhone
    ? `https://wa.me/${whatsappPhone}?text=${whatsappMessage}`
    : "";

  const latitude = parseCoordinate(
    negocio.latitude ??
    negocio.lat ??
    negocio.endereco_latitude,
    "latitude"
  );

  const longitude = parseCoordinate(
    negocio.longitude ??
    negocio.lng ??
    negocio.lon ??
    negocio.endereco_longitude,
    "longitude"
  );

  const fullAddress = [
    negocio.logradouro,
    negocio.numero,
    negocio.bairro,
    negocio.cidade,
    negocio.estado,
    negocio.cep
  ]
    .filter(Boolean)
    .join(", ");

  const mapsQuery =
    latitude !== null && longitude !== null
      ? `${latitude},${longitude}`
      : fullAddress || formatLocation(negocio);

  const savedMapsUrl = String(
    negocio.google_maps_url ??
    negocio.google_maps_link ??
    negocio.link_google_maps ??
    negocio.maps_url ??
    negocio.google_maps ??
    ""
  ).trim();

  const mapsUrl =
    savedMapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      mapsQuery
    )}`;

  return (
    <main className="container page-content">
      <Link className="back-link" to="/">← Voltar para explorar</Link>

      <section className="profile-hero">
        <MediaThumb
          src={negocio.foto_url}
          alt={`Foto de ${negocio.nome}`}
          className="profile-image"
        />
        <div className="profile-copy">
          <p className="eyebrow">{negocio.setor || "Beleza"}</p>
          <h1>{negocio.nome}</h1>
          <p>{negocio.descricao || "Escolha um serviço e encontre o melhor horário para você."}</p>
          <div className="profile-meta">
            <span>
              ⌖{" "}
              {formatLocation(negocio) ||
                "Atendimento local"}
            </span>

            <span aria-label={rating.ariaLabel}>
              {rating.label === "Novo" ? "✨ Novo" : rating.label}
            </span>

            {locationStatus === "loading" && (
              <span>Calculando distância...</span>
            )}

            {distanceKm !== null &&
              distanceKm >= 0 &&
              distanceKm <= 500 && (
                <span>
                  {distanceKm < 1
                    ? `${Math.round(distanceKm * 1000)} m de você`
                    : `${distanceKm.toFixed(1).replace(".", ",")} km de você`}
                </span>
              )}
          </div>
        </div>
        <div
          className={
            whatsappUrl
              ? "profile-actions has-whatsapp"
              : "profile-actions"
          }
        >
          <button
            aria-pressed={favorite}
            className={
              favorite
                ? "favorite-button active"
                : "favorite-button"
            }
            disabled={favoriteBusy}
            onClick={toggleFavorite}
            type="button"
          >
            <>
              <svg
                className="action-icon favorite-icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M12 21s-7.2-4.35-9.33-8.72C.8 8.45 3.02 4.5 7.18 4.5c2.02 0 3.4 1.1 4.82 2.7 1.42-1.6 2.8-2.7 4.82-2.7 4.16 0 6.38 3.95 4.51 7.78C19.2 16.65 12 21 12 21Z"
                />
              </svg>
              <span>{favorite ? "Salvo" : "Favoritar"}</span>
            </>
          </button>

          {whatsappUrl && (
            <a
              className="profile-action-button whatsapp"
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
            >
              <svg
                className="action-icon whatsapp-icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M12 2a9.5 9.5 0 0 0-8.16 14.38L2.5 21.5l5.25-1.38A9.5 9.5 0 1 0 12 2Zm0 17.25a7.7 7.7 0 0 1-3.92-1.06l-.28-.17-3.12.82.83-3.04-.18-.29A7.75 7.75 0 1 1 12 19.25Zm4.25-5.78c-.23-.12-1.38-.68-1.59-.76-.21-.08-.36-.12-.52.12-.15.23-.59.76-.73.91-.13.16-.27.18-.5.06-.23-.12-.98-.36-1.86-1.15-.69-.61-1.15-1.37-1.28-1.6-.14-.23-.02-.36.1-.48.11-.1.23-.27.35-.41.12-.13.16-.23.23-.39.08-.15.04-.29-.02-.41-.06-.12-.52-1.25-.71-1.71-.18-.45-.37-.39-.51-.4h-.44c-.15 0-.4.06-.61.29-.21.23-.8.78-.8 1.91s.82 2.22.94 2.37c.12.16 1.62 2.48 3.93 3.48.55.24.98.38 1.31.49.55.17 1.05.15 1.45.09.44-.07 1.38-.56 1.57-1.1.2-.55.2-1.02.14-1.11-.06-.1-.21-.16-.44-.27Z"
                />
              </svg>
              <span>WhatsApp</span>
</a>
          )}

          <a
            className="profile-action-button maps"
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
          >
            <svg
              className="action-icon maps-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"
              />
            </svg>
            <span>Ver no mapa</span>
</a>
        </div>
      </section>

      <FlowSteps current={currentStep} />

      <div className="booking-layout">
        <div className="booking-main">
          <section className="booking-section">
            <div className="section-heading">
              <div><p className="step-label">1</p><h2>Escolha o serviço</h2></div>
            </div>
            {servicos.length === 0 ? (
              <EmptyState title="Este negócio ainda está configurando os serviços">
                Volte em breve para conferir a agenda.
              </EmptyState>
            ) : (
              <div className="choice-list">
                {servicos.map((service) => (
                  <button
                    aria-pressed={String(service.id) === serviceId}
                    className={String(service.id) === serviceId ? "choice-card selected" : "choice-card"}
                    key={service.id}
                    onClick={() => selectService(service.id)}
                    type="button"
                  >
                    <MediaThumb
                      src={
                        service.foto_url ??
                        service.imagem_url ??
                        service.foto
                      }
                      alt={`Foto do serviço ${service.nome}`}
                      className="choice-media service-choice-media"
                    />

                    <span className="choice-copy">
                      <strong className="service-name-with-emoji">
                      <span
                        className="service-name-emoji"
                        aria-hidden="true"
                      >
                        {getServiceEmoji(service.nome)}
                      </span>
                      <span>{service.nome}</span>
                    </strong>
                      {service.descricao && <small>{service.descricao}</small>}
                      <small className="service-duration-with-emoji">
                      <span
                        className="service-duration-emoji"
                        aria-hidden="true"
                      >
                        🕒
                      </span>
                      {service.duracao_minutos} min
                    </small>
                    </span>
                    <span className="choice-price">
                      <strong>{formatCurrency(service.valor)}</strong>
                      <small>{String(service.id) === serviceId ? "Selecionado ✓" : "Escolher"}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {serviceId && (
            <section className="booking-section" id="profissional">
              <div className="section-heading">
                <div><p className="step-label">2</p><h2>Escolha quem vai atender</h2></div>
              </div>
              {profissionais.length === 0 ? (
                <EmptyState title="Nenhum profissional disponível" />
              ) : profissionais.length === 1 ? (
                <div className="single-professional">
                  <MediaThumb
                    src={
                      profissionais[0].foto_url ??
                      profissionais[0].avatar_url ??
                      profissionais[0].foto
                    }
                    alt={`Foto de ${profissionais[0].nome}`}
                    className="avatar professional-media"
                  />
                  <span>
                    <strong>{profissionais[0].nome}</strong>
                    <small>Selecionada automaticamente</small>
                  </span>
                  <span aria-label="Selecionada">✓</span>
                </div>
              ) : (
                <div className="choice-list compact">
                  {profissionais.map((person) => (
                    <button
                      aria-pressed={String(person.id) === professionalId}
                      className={String(person.id) === professionalId ? "choice-card selected" : "choice-card"}
                      key={person.id}
                      onClick={() => selectProfessional(person.id)}
                      type="button"
                    >
                      <MediaThumb
                        src={
                          person.foto_url ??
                          person.avatar_url ??
                          person.foto
                        }
                        alt={`Foto de ${person.nome}`}
                        className="avatar professional-media"
                      />
                      <span><strong>{person.nome}</strong><small>Profissional</small></span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {professionalId && (
            <section className="booking-section" id="horario">
              <div className="section-heading">
                <div><p className="step-label">3</p><h2>Escolha o horário</h2></div>
              </div>
              {scheduleStatus === "loading" && <LoadingState>Buscando horários...</LoadingState>}
              {scheduleStatus === "error" && (
                <ErrorState
                  message={error}
                  onRetry={() => setScheduleReload((value) => value + 1)}
                />
              )}
              {scheduleStatus === "ready" && availability.length === 0 && (
                <EmptyState
                  title="Nenhum horário disponível agora"
                  action={(
                    <button
                      className="button button-secondary button-small"
                      onClick={() => setScheduleReload((value) => value + 1)}
                      type="button"
                    >
                      Atualizar horários
                    </button>
                  )}
                >
                  {scheduleMessage || "A profissional pode abrir novos horários em breve."}
                </EmptyState>
              )}
              {scheduleStatus === "ready" && availability.length > 0 && (
                <>
                  <div className="date-list">
                    {availability.map((item) => (
                      <button
                        aria-pressed={item.data === day}
                        className={item.data === day ? "date-button selected" : "date-button"}
                        key={item.data}
                        onClick={() => { setDay(item.data); setTime(""); }}
                        type="button"
                      >
                        {formatDate(item.data)}
                      </button>
                    ))}
                  </div>
                  <small className="date-scroll-hint">
                    Deslize para ver mais datas
                  </small>

                  {selectedDay && (
                    <div className="time-list" aria-label="Horários disponíveis">
                      {selectedDay.horarios.map((hour) => (
                        <button
                          aria-pressed={hour === time}
                          className={hour === time ? "time-button selected" : "time-button"}
                          key={hour}
                          onClick={() => setTime(hour)}
                          type="button"
                        >
                          {hour}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>

        <aside className="booking-summary">
          <p className="eyebrow">Seu agendamento</p>
          <h2>Resumo</h2>
          <dl>
            <div><dt>Serviço</dt><dd>{selectedService?.nome || "Selecione um serviço"}</dd></div>
            <div><dt>Profissional</dt><dd>{selectedProfessional?.nome || "Aguardando serviço"}</dd></div>
            <div><dt>Data</dt><dd>{day ? formatDate(day, true) : "Aguardando horário"}</dd></div>
            <div><dt>Horário</dt><dd>{time || "Aguardando horário"}</dd></div>
            <div>
              <dt>Total</dt>
              <dd>
                {selectedService
                  ? formatCurrency(selectedService.valor)
                  : "Aguardando serviço"}
              </dd>
            </div>
          </dl>
          <button className="button button-full" disabled={!time} onClick={continueToConfirmation}>
            {time ? "Revisar e confirmar" : "Escolha um horário"}
          </button>
          <small>Você confirma seus dados na próxima etapa.</small>
        </aside>
      </div>
    </main>
  );
}
