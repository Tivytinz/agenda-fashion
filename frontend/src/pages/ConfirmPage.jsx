import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";
import { track } from "../analytics/track";
import { useSession } from "../auth/SessionContext";
import { FlowSteps } from "../components/FlowSteps";
import { saveRecentAppointment } from "../utils/appointments";
import { formatCurrency, formatWhatsApp } from "../utils/format";
import {
  readBrowserStorage,
  removeBrowserStorage
} from "../utils/browserStorage";

function storedBooking() {
  try {
    return JSON.parse(readBrowserStorage("session", "af_booking_draft") || "null");
  } catch {
    return null;
  }
}

function normalizeWhatsApp(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .replace(
      /^55(?=\d{10,11}$)/,
      ""
    );
}

function formatConfirmationDate(value) {
  const date = new Date(`${value}T12:00:00`);

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

export function ConfirmPage() {
  const session = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const booking = useMemo(() => location.state || storedBooking(), [location.state]);
  const user = useMemo(() => {
    try {
      return JSON.parse(readBrowserStorage("local", "usuario") || "null");
    } catch {
      return null;
    }
  }, []);
  const accountWhatsApp =
    session.usuario?.whatsapp ||
    user?.whatsapp ||
    "";
  const [name, setName] = useState(user?.nome || "");
  const [whatsapp, setWhatsapp] = useState(
    formatWhatsApp(accountWhatsApp)
  );
  const [consent, setConsent] = useState(
    session.usuario?.aceita_notificacoes_whatsapp === true
  );
  const [status, setStatus] = useState("idle");
  const [scheduleConflict, setScheduleConflict] = useState(false);
  const [error, setError] = useState("");
  const [hasProfessionalChoice, setHasProfessionalChoice] = useState(
    typeof booking?.hasProfessionalChoice === "boolean"
      ? booking.hasProfessionalChoice
      : null
  );
  const submissionInFlight = useRef(false);

  useEffect(() => {
    if (booking) {
      track("tela_visualizada", {
        page: "finalizar_agendamento",
        mission: "confirmar_agendamento",
        businessId: booking.business?.id
      });
    }
  }, [booking]);

  useEffect(() => {
    if (!booking || hasProfessionalChoice !== null) return undefined;

    const controller = new AbortController();

    apiRequest(`/perfil-negocio/${encodeURIComponent(booking.slug)}`, {
      signal: controller.signal
    })
      .then((profile) => {
        setHasProfessionalChoice(
          Array.isArray(profile?.profissionais) && profile.profissionais.length > 1
        );
      })
      .catch((requestError) => {
        if (requestError.name === "AbortError") return;
        setHasProfessionalChoice(true);
      });

    return () => controller.abort();
  }, [booking, hasProfessionalChoice]);

  if (!booking) {
    return <Navigate to="/" replace />;
  }

  const normalizedAccountWhatsApp =
    normalizeWhatsApp(accountWhatsApp);
  const normalizedBookingWhatsApp =
    normalizeWhatsApp(whatsapp);
  const accountAllowsNotifications =
    session.usuario
      ?.aceita_notificacoes_whatsapp ===
    true;
  const accountConsentMatchesPhone =
    accountAllowsNotifications &&
    [10, 11].includes(
      normalizedAccountWhatsApp.length
    ) &&
    normalizedAccountWhatsApp ===
      normalizedBookingWhatsApp;

  const confirmationSteps = hasProfessionalChoice === false
    ? ["Serviço", "Horário", "Confirmar"]
    : ["Serviço", "Profissional", "Horário", "Confirmar"];

  async function submit(event) {
    event.preventDefault();

    if (submissionInFlight.current) return;

    const normalizedName = name.trim().replace(/\s+/g, " ");
    const normalizedPhone =
      normalizeWhatsApp(whatsapp);

    if (normalizedName.length < 2) {
      setError("Informe seu nome.");
      return;
    }

    if (![10, 11].includes(normalizedPhone.length)) {
      setError("Informe um WhatsApp válido com DDD.");
      return;
    }

    setStatus("loading");
    submissionInFlight.current = true;
    setScheduleConflict(false);
    setError("");

    try {
      const result = await apiRequest("/agendamentos", {
        method: "POST",
        body: {
          slug: booking.slug,
          servico_id: booking.service.id,
          profissional_id: booking.professional.id,
          data: booking.date,
          horario: booking.time,
          cliente_nome: normalizedName,
          cliente_whatsapp: normalizedPhone,
          aceita_mensagens_whatsapp:
            session.authenticated
              ? accountConsentMatchesPhone
              : consent
        }
      });

      track("agendamento_concluido", {
        page: "finalizar_agendamento",
        mission: "confirmar_agendamento",
        businessId: booking.business.id,
        properties: {
          origem: "react",
          agendamento_id: Number(result.agendamento?.id),
          servico_id: Number(booking.service.id),
          status: "sucesso"
        }
      });
      removeBrowserStorage("session", "af_booking_draft");
      saveRecentAppointment({
        booking,
        appointment: result.agendamento
      });
      navigate("/sucesso", {
        replace: true,
        state: {
          booking,
          customer: {
            name: normalizedName,
            whatsapp: normalizedPhone
          },
          result
        }
      });
    } catch (requestError) {
      const isConflict = requestError.status === 409;
      setScheduleConflict(isConflict);
      setError(
        isConflict
          ? "Esse horário acabou de ser reservado. Volte e escolha outro."
          : requestError.message
      );
      setStatus("error");
    } finally {
      submissionInFlight.current = false;
    }
  }

  function changeSelection() {
    const params = new URLSearchParams({
      servico: String(booking.service.id),
      profissional: String(booking.professional.id)
    });

    navigate(`/negocio/${encodeURIComponent(booking.slug)}?${params}`);
  }

  return (
    <main className="container page-content narrow-page booking-confirmation-page">
      <FlowSteps current={confirmationSteps.length} steps={confirmationSteps} />
      <div className="confirmation-grid">
        <section className="form-card">
          <h1>Confirme seus dados</h1>
          <p className="confirmation-intro">
            Confira seus dados antes de finalizar o agendamento.
          </p>

          <form onSubmit={submit}>
            <label>
              Seu nome
              <input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              WhatsApp para confirmação
              <input
                autoComplete="tel"
                inputMode="tel"
                maxLength={15}
                placeholder="(00) 12345-6789"
                value={whatsapp}
                onChange={(event) => setWhatsapp(formatWhatsApp(event.target.value))}
              />
            </label>
            {session.authenticated ? (
              <p className="muted">
                {accountConsentMatchesPhone
                  ? "Você receberá confirmação, lembrete e atualizações deste agendamento pelo WhatsApp."
                  : accountAllowsNotifications
                    ? "Este número é diferente do WhatsApp autorizado na sua conta. O agendamento será concluído sem mensagens automáticas."
                    : "As mensagens de agendamento pelo WhatsApp estão desativadas na sua conta."}{" "}
                <Link to="/conta#notificacoes-whatsapp">Atualizar na conta</Link>
              </p>
            ) : (
              <>
                <label className="checkbox-label">
                  <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                  <span>Quero receber pelo WhatsApp confirmações, lembretes, alterações e cancelamentos deste agendamento enviados pelo Agenda Fashion.</span>
                </label>
                <small>Opcional. Você pode agendar sem autorizar mensagens.</small>
              </>
            )}

            {error && <p className="form-error" role="alert">{error}</p>}
            {scheduleConflict && (
              <button
                className="button button-secondary button-full"
                type="button"
                onClick={changeSelection}
              >
                Escolher outro horário
              </button>
            )}
            <button
              className="button button-full confirm-button"
              disabled={status === "loading"}
              type="submit"
            >
              {status === "loading" ? "Confirmando agendamento..." : "Confirmar agendamento"}
            </button>
          </form>
        </section>

        <aside className="booking-summary">
          <p className="eyebrow">{booking.business.nome}</p>
          <h2>{booking.service.nome}</h2>
          <dl>
            <div><dt>Profissional</dt><dd>{booking.professional.nome}</dd></div>
            <div><dt>Data</dt><dd>{formatConfirmationDate(booking.date)}</dd></div>
            <div><dt>Horário</dt><dd>{booking.time}</dd></div>
            <div><dt>Total</dt><dd>{formatCurrency(booking.service.valor)}</dd></div>
          </dl>
          <button
            className="button button-secondary button-small confirmation-change-button"
            type="button"
            onClick={changeSelection}
          >
            ← Alterar serviço ou horário
          </button>
        </aside>
      </div>
    </main>
  );
}
