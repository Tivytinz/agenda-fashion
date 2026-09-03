import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { track } from "../analytics/track";
import { hasSession } from "../auth/session";
import { BookingFlow } from "../components/profile/BookingFlow";
import { ProfileHero } from "../components/profile/ProfileHero";
import { ErrorState, LoadingState } from "../components/ScreenState";
import { usePageMetadata } from "../hooks/usePageMetadata";
import { formatRating, normalizeAvailability } from "../utils/format";
import {
  writeBrowserStorage
} from "../utils/browserStorage";

const EMPTY_LIST = [];

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
  const [favoriteStatus, setFavoriteStatus] = useState(
    () => hasSession() ? "loading" : "ready"
  );
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [favoriteError, setFavoriteError] = useState("");
  const [favoriteReload, setFavoriteReload] = useState(0);
  const searchQueryRef = useRef(searchParams.toString());
  searchQueryRef.current = searchParams.toString();

  const business = profile?.negocio;
  const services = profile?.servicos ?? EMPTY_LIST;
  const professionals = profile?.profissionais ?? EMPTY_LIST;
  const bookingAvailable = services.some(
    (service) => service.agendamento_online_disponivel === true
  );
  const profileImageSource = business?.foto_url ||
    business?.imagem_url ||
    business?.logo_url ||
    services.map((service) => (
      service.foto_url || service.imagem_url || service.foto
    )).find(Boolean) ||
    "";
  const pageDescription = business?.descricao || (
    business?.nome
      ? `Agende serviços de beleza com ${business.nome} pelo Agenda Fashion.`
      : "Encontre profissionais de beleza e agende seu horário."
  );

  usePageMetadata(
    business?.nome ? `${business.nome} | Agenda Fashion` : "Agenda Fashion",
    pageDescription
  );

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

        const canonicalSlug =
          data.redirecionamento?.slug;

        if (
          canonicalSlug &&
          canonicalSlug !== slug
        ) {
          const query =
            searchQueryRef.current;

          navigate(
            `/negocio/${encodeURIComponent(canonicalSlug)}${query ? `?${query}` : ""}`,
            { replace: true }
          );
          return;
        }

        setProfile(data);
        setStatus("ready");
        track("perfil_visualizado", {
          page: "perfil_negocio",
          mission: "escolher_e_agendar",
          businessId: data.negocio?.id,
          properties: { origem: "inicio" }
        });
      } catch (requestError) {
        if (requestError.name === "AbortError") return;
        setError(requestError.message);
        setStatus("error");
      }
    }

    void loadProfile();
    return () => controller.abort();
  }, [navigate, profileReload, slug]);

  useEffect(() => {
    const businessId = business?.id;
    setFavorite(false);
    setFavoriteError("");

    if (!businessId) {
      setFavoriteStatus(hasSession() ? "loading" : "ready");
      return undefined;
    }

    if (!hasSession()) {
      setFavoriteStatus("ready");
      return undefined;
    }

    const controller = new AbortController();
    setFavoriteStatus("loading");

    apiRequest(`/favoritos/${businessId}/status`, {
      signal: controller.signal
    })
      .then((result) => {
        setFavorite(Boolean(
          result.favoritado ?? result.favorito ?? result.is_favorito
        ));
        setFavoriteStatus("ready");
      })
      .catch((requestError) => {
        if (requestError.name === "AbortError") return;
        setFavoriteStatus("error");
        setFavoriteError(
          "Não foi possível verificar este favorito. Tente novamente."
        );
      });

    return () => controller.abort();
  }, [business?.id, favoriteReload]);

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
        if (requestError.name === "AbortError") return;
        setError(requestError.message);
        setScheduleStatus("error");
      }
    }

    void loadAvailability();
    return () => controller.abort();
  }, [professionalId, scheduleReload, serviceId, slug]);

  useEffect(() => {
    if (profile && serviceId && !professionalId && professionals.length === 1) {
      setProfessionalId(String(professionals[0].id));
    }
  }, [professionalId, professionals, profile, serviceId]);

  const selectedService = useMemo(
    () => services.find((service) => String(service.id) === String(serviceId)),
    [serviceId, services]
  );
  const selectedProfessional = useMemo(
    () => professionals.find((person) => String(person.id) === String(professionalId)),
    [professionalId, professionals]
  );

  function selectService(id) {
    const nextProfessionalId = professionals.length === 1
      ? String(professionals[0].id)
      : "";
    setServiceId(String(id));
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
      businessId: business.id,
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
      businessId: business.id,
      properties: { profissional_id: Number(id) }
    });
  }

  function continueToConfirmation() {
    const booking = {
      slug,
      business,
      service: selectedService,
      professional: selectedProfessional,
      date: day,
      time
    };

    writeBrowserStorage("session", "af_booking_draft", JSON.stringify(booking));
    track("agendamento_iniciado", {
      page: "perfil_negocio",
      mission: "escolher_e_agendar",
      businessId: business.id,
      properties: {
        origem: hasSession() ? "cliente_logada" : "visitante",
        servico_id: Number(serviceId)
      }
    });
    navigate("/confirmar", { state: booking });
  }

  async function toggleFavorite() {
    if (!hasSession()) {
      navigate("/entrar", { state: { from: `/negocio/${slug}` } });
      return;
    }

    if (favoriteStatus === "error") {
      setFavoriteReload((value) => value + 1);
      return;
    }

    if (favoriteStatus !== "ready") return;

    setFavoriteBusy(true);
    setFavoriteError("");
    try {
      const result = await apiRequest(`/favoritos/${business.id}`, {
        method: favorite ? "DELETE" : "POST"
      });
      const nextFavorite = result?.favoritado;
      setFavorite(
        typeof nextFavorite === "boolean" ? nextFavorite : !favorite
      );
    } catch (requestError) {
      setFavoriteError(requestError.message);
    } finally {
      setFavoriteBusy(false);
    }
  }

  if (status === "loading") {
    return <main className="container page-content public-profile-page"><LoadingState>Carregando o perfil...</LoadingState></main>;
  }

  if (status === "error") {
    return (
      <main className="container page-content public-profile-page">
        <ErrorState
          message={error}
          onRetry={() => setProfileReload((value) => value + 1)}
        />
      </main>
    );
  }

  return (
    <main className="container page-content public-profile-page">
      <Link className="back-link" to="/">← Voltar ao início</Link>
      <ProfileHero
        bookingAvailable={bookingAvailable}
        business={business}
        businessSlug={slug}
        favorite={favorite}
        favoriteBusy={favoriteBusy}
        favoriteStatus={favoriteStatus}
        imageSource={profileImageSource}
        onToggleFavorite={toggleFavorite}
        rating={formatRating(business)}
        selectedService={selectedService}
      />
      {favoriteError && <p className="form-error" role="alert">{favoriteError}</p>}
      <BookingFlow
        availability={availability}
        businessId={business.id}
        businessName={business.nome}
        businessSlug={slug}
        day={day}
        error={error}
        onContinue={continueToConfirmation}
        onRetrySchedule={() => setScheduleReload((value) => value + 1)}
        onSelectDay={(nextDay) => { setDay(nextDay); setTime(""); }}
        onSelectProfessional={selectProfessional}
        onSelectService={selectService}
        onSelectTime={setTime}
        professionalId={professionalId}
        professionals={professionals}
        scheduleMessage={scheduleMessage}
        scheduleStatus={scheduleStatus}
        selectedProfessional={selectedProfessional}
        selectedService={selectedService}
        serviceId={serviceId}
        services={services}
        time={time}
      />
    </main>
  );
}
