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
  mergeProfileSearchParams,
  resolveProfileOrigin
} from "../utils/profileOrigin";
import {
  writeBrowserStorage
} from "../utils/browserStorage";

export { normalizeProfileOrigin } from "../utils/profileOrigin";

const EMPTY_LIST = [];

function professionalCanDoService(professional, serviceId) {
  if (!serviceId) return true;

  return (professional?.servico_ids || [])
    .some(
      (id) =>
        String(id) ===
        String(serviceId)
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
  const [favoriteStatus, setFavoriteStatus] = useState(
    () => hasSession() ? "loading" : "ready"
  );
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [favoriteError, setFavoriteError] = useState("");
  const [favoriteReload, setFavoriteReload] = useState(0);
  const searchQueryRef = useRef(searchParams.toString());
  const profileOriginRef = useRef(
    resolveProfileOrigin(searchParams)
  );
  searchQueryRef.current = searchParams.toString();

  const business = profile?.negocio;
  const services = profile?.servicos ?? EMPTY_LIST;
  const professionals = profile?.profissionais ?? EMPTY_LIST;
  const eligibleProfessionals = useMemo(
    () => professionals.filter(
      (professional) =>
        professionalCanDoService(
          professional,
          serviceId
        )
    ),
    [professionals, serviceId]
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
          properties: { origem: profileOriginRef.current }
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
    if (
      !serviceId ||
      !professionalId ||
      (
        profile &&
        !eligibleProfessionals.some(
          (professional) =>
            String(professional.id) ===
            String(professionalId)
        )
      )
    ) {
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
  }, [
    eligibleProfessionals,
    professionalId,
    profile,
    scheduleReload,
    serviceId,
    slug
  ]);

  useEffect(() => {
    if (!profile || !serviceId) return;

    const selectedStillEligible =
      eligibleProfessionals.some(
        (professional) =>
          String(professional.id) ===
          String(professionalId)
      );

    if (
      professionalId &&
      !selectedStillEligible
    ) {
      setProfessionalId("");
      setSearchParams(
        (current) =>
          mergeProfileSearchParams(
            current,
            {
              servico:
                String(serviceId),
              profissional:
                null
            }
          ),
        { replace: true }
      );
      return;
    }

    if (
      !professionalId &&
      eligibleProfessionals.length === 1
    ) {
      const id =
        String(
          eligibleProfessionals[0].id
        );
      setProfessionalId(id);
      setSearchParams(
        (current) =>
          mergeProfileSearchParams(
            current,
            {
              servico:
                String(serviceId),
              profissional:
                id
            }
          ),
        { replace: true }
      );
    }
  }, [
    eligibleProfessionals,
    professionalId,
    profile,
    serviceId,
    setSearchParams
  ]);

  const selectedService = useMemo(
    () => services.find((service) => String(service.id) === String(serviceId)),
    [serviceId, services]
  );
  const selectedProfessional = useMemo(
    () => eligibleProfessionals.find(
      (person) =>
        String(person.id) ===
        String(professionalId)
    ),
    [
      eligibleProfessionals,
      professionalId
    ]
  );

  function trackContactSelection(action) {
    track("contato_selecionado", {
      page: "perfil_negocio",
      mission: "escolher_e_agendar",
      businessId: business.id,
      properties: { acao: action }
    });
  }

  function selectService(id) {
    const professionalsForService =
      professionals.filter(
        (professional) =>
          professionalCanDoService(
            professional,
            id
          )
      );
    const nextProfessionalId =
      professionalsForService.length === 1
        ? String(
            professionalsForService[0].id
          )
        : "";
    setServiceId(String(id));
    setProfessionalId(nextProfessionalId);
    setSearchParams((current) => mergeProfileSearchParams(current, {
      servico: String(id),
      profissional: nextProfessionalId || null
    }), { replace: true });
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
    setSearchParams((current) => mergeProfileSearchParams(current, {
      servico: serviceId,
      profissional: String(id)
    }), { replace: true });
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
      const query = searchQueryRef.current;
      navigate("/entrar", {
        state: {
          from: `/negocio/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`
        }
      });
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
        business={business}
        businessSlug={slug}
        favorite={favorite}
        favoriteBusy={favoriteBusy}
        favoriteStatus={favoriteStatus}
        imageSource={profileImageSource}
        onToggleFavorite={toggleFavorite}
        onContactSelected={trackContactSelection}
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
        professionals={eligibleProfessionals}
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
