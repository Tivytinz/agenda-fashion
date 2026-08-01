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

  const whatsappMessage = encodeURIComponent(
    `Olá! Encontrei ${negocio.nome} no Agenda Fashion e gostaria de tirar uma dúvida.`
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
              {rating.label}
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
        <div className="profile-actions">
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
            {favorite ? "♥ Salvo" : "♡ Favoritar"}
          </button>

          {whatsappUrl && (
            <a
              className="profile-action-button whatsapp"
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
          )}

          <a
            className="profile-action-button maps"
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
          >
            Ver no mapa
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
                      <strong>{service.nome}</strong>
                      {service.descricao && <small>{service.descricao}</small>}
                      <small>{service.duracao_minutos} min</small>
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
            {time ? "Revisar e confirmar" : "Complete as etapas"}
          </button>
          <small>Você confirma seus dados na próxima etapa.</small>
        </aside>
      </div>
    </main>
  );
}
