import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { track } from "../analytics/track";
import { useSession } from "../auth/SessionContext";
import { ErrorState, LoadingState } from "../components/ScreenState";
import {
  APPOINTMENT_STATUS,
  groupAppointments,
  markRecentAppointmentCanceled,
  readRecentAppointment
} from "../utils/appointments";
import { formatCurrency, formatDate } from "../utils/format";
import {
  PROFILE_ORIGIN,
  buildProfilePath
} from "../utils/profileOrigin";

const TABS = [
  { id: "scheduled", label: "Agendados" },
  { id: "completed", label: "Realizados" },
  { id: "missed", label: "Não realizados" },
  { id: "canceled", label: "Cancelados" }
];

const RATING_OPTIONS = [1, 2, 3, 4, 5];

function CancelDialog({ appointment, canceling, error, onClose, onConfirm }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (appointment && !dialog.open) {
      dialog.showModal();
    }

    if (!appointment && dialog.open) {
      dialog.close();
    }
  }, [appointment]);

  return (
    <dialog
      aria-labelledby="cancel-dialog-title"
      className="cancel-dialog"
      onCancel={(event) => {
        if (canceling) {
          event.preventDefault();
          return;
        }

        onClose();
      }}
      ref={dialogRef}
    >
      {appointment && (
        <div className="cancel-dialog-content">
          <span className="cancel-dialog-icon" aria-hidden="true">!</span>
          <p className="eyebrow">Confirmar cancelamento</p>
          <h2 id="cancel-dialog-title">Cancelar este agendamento?</h2>
          <p>
            {appointment.servico} em {formatDate(appointment.data, true)} às{" "}
            {appointment.horario}.
          </p>
          <p className="cancel-dialog-warning">
            O horário será liberado para outra cliente.
          </p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="cancel-dialog-actions">
            <button
              className="button button-secondary"
              disabled={canceling}
              onClick={onClose}
              type="button"
            >
              Manter agendamento
            </button>
            <button
              className="button button-danger"
              disabled={canceling}
              onClick={() => onConfirm(appointment)}
              type="button"
            >
              {canceling ? "Cancelando..." : "Sim, cancelar"}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

function AppointmentCard({
  appointment,
  canCancel,
  canEvaluate,
  canceling,
  evaluating,
  evaluationError,
  onCancel,
  onEvaluate
}) {
  const statusLabel = {
    [APPOINTMENT_STATUS.scheduled]: "Agendado",
    [APPOINTMENT_STATUS.confirmed]: "Confirmado",
    [APPOINTMENT_STATUS.completed]: "Realizado",
    [APPOINTMENT_STATUS.missed]: "Não realizado",
    [APPOINTMENT_STATUS.canceled]: "Cancelado"
  }[appointment.status];
  const canRepeat = [
    APPOINTMENT_STATUS.completed,
    APPOINTMENT_STATUS.missed
  ].includes(appointment.status);
  const repeatBookingUrl =
    canRepeat &&
    appointment.slug &&
    appointment.servico_id
      ? buildProfilePath({
          slug: appointment.slug,
          serviceId: appointment.servico_id,
          origin: PROFILE_ORIGIN.APPOINTMENTS
        })
      : "";
  const savedRating = Number(appointment.avaliacao);
  const hasRating = Number.isInteger(savedRating) && savedRating >= 1 && savedRating <= 5;

  function trackRepeatBooking() {
    track("agendamento_iniciado", {
      page: "meus_agendamentos",
      mission: "retornar_ao_negocio",
      businessId: appointment.negocio_id,
      properties: {
        origem: "agendar_novamente",
        agendamento_id: Number(appointment.id),
        servico_id: Number(appointment.servico_id) || null,
        status: appointment.status
      }
    });
  }

  return (
    <article className="appointment-card">
      <div className="appointment-date" aria-label={formatDate(appointment.data, true)}>
        <strong>{new Date(`${appointment.data}T12:00:00`).getDate()}</strong>
        <span>
          {new Intl.DateTimeFormat("pt-BR", { month: "short" })
            .format(new Date(`${appointment.data}T12:00:00`))
            .replace(".", "")}
        </span>
        <small>{appointment.horario}</small>
      </div>

      <div className="appointment-copy">
        <div className="appointment-heading">
          <div>
            <p className="eyebrow">{appointment.negocio}</p>
            <h2>{appointment.servico}</h2>
          </div>
          <span className={`status-badge status-${appointment.status}`}>{statusLabel}</span>
        </div>

        <dl className="appointment-details">
          <div><dt>Quando</dt><dd>{formatDate(appointment.data, true)} às {appointment.horario}</dd></div>
          <div><dt>Profissional</dt><dd>{appointment.profissional}</dd></div>
          <div><dt>Valor</dt><dd>{formatCurrency(appointment.valor)}</dd></div>
        </dl>

        {appointment.status === APPOINTMENT_STATUS.completed && hasRating && (
          <p className="muted">Sua avaliação: {savedRating}/5</p>
        )}

        {canEvaluate && (
          <div aria-label={`Avaliar ${appointment.servico}`} className="appointment-rating">
            <span>Avalie este atendimento</span>
            <div className="appointment-actions" role="group" aria-label="Escolha uma nota de 1 a 5 estrelas">
              {RATING_OPTIONS.map((rating) => (
                <button
                  aria-label={`Avaliar com ${rating} ${rating === 1 ? "estrela" : "estrelas"}`}
                  className="button button-secondary button-small"
                  disabled={evaluating}
                  key={rating}
                  onClick={() => onEvaluate(appointment, rating)}
                  type="button"
                >
                  {rating} ★
                </button>
              ))}
            </div>
            {evaluationError && <p className="form-error" role="alert">{evaluationError}</p>}
          </div>
        )}

        <div className="appointment-actions">
          {repeatBookingUrl && (
            <Link
              className="button button-small"
              onClick={trackRepeatBooking}
              to={repeatBookingUrl}
            >
              Agendar novamente
            </Link>
          )}
          {appointment.slug && (
            <Link
              className="button button-secondary button-small"
              to={buildProfilePath({
                slug: appointment.slug,
                origin: PROFILE_ORIGIN.APPOINTMENTS
              })}
            >
              Ver negócio
            </Link>
          )}
          {canCancel && (
            <button
              className="button button-danger button-small"
              disabled={canceling}
              onClick={() => onCancel(appointment)}
              type="button"
            >
              {canceling ? "Cancelando..." : "Cancelar agendamento"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function MyAppointmentsPage() {
  const session = useSession();
  const isAuthenticated = session.authenticated;
  const recentAppointment = useMemo(() => readRecentAppointment(), []);
  const [appointments, setAppointments] = useState(
    !isAuthenticated && recentAppointment ? [recentAppointment] : []
  );
  const [activeTab, setActiveTab] = useState("scheduled");
  const [status, setStatus] = useState(session.loading || isAuthenticated ? "loading" : "ready");
  const [message, setMessage] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancelingId, setCancelingId] = useState(null);
  const [pendingCancellation, setPendingCancellation] = useState(null);
  const [evaluatingId, setEvaluatingId] = useState(null);
  const [evaluationError, setEvaluationError] = useState("");
  const [evaluationErrorId, setEvaluationErrorId] = useState(null);
  const tabRefs = useRef([]);

  const loadAppointments = useCallback(async () => {
    if (session.loading) {
      return;
    }

    if (!isAuthenticated) {
      setAppointments(recentAppointment ? [recentAppointment] : []);
      setStatus("ready");
      setMessage("");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const result = await apiRequest("/meus-agendamentos");
      setAppointments(Array.isArray(result.agendamentos) ? result.agendamentos : []);
      setStatus("ready");
    } catch (error) {
      setMessage(error.message);
      setStatus("error");
    }
  }, [isAuthenticated, recentAppointment, session.loading]);

  useEffect(() => {
    track("tela_visualizada", {
      page: "meus_agendamentos",
      mission: "acompanhar_agendamentos"
    });
    loadAppointments();
  }, [loadAppointments]);

  const grouped = useMemo(() => groupAppointments(appointments), [appointments]);

  async function cancelAppointment(appointment) {
    setCancelingId(appointment.id);
    setCancelError("");
    setMessage("");

    try {
      if (isAuthenticated) {
        await apiRequest(`/agendamentos/${appointment.id}/cancelar`, {
          method: "PATCH"
        });
      } else {
        await apiRequest(`/agendamentos/${appointment.id}/cancelar-visitante`, {
          method: "PATCH",
          body: {
            acesso_visitante: appointment.acesso_visitante
          }
        });
        markRecentAppointmentCanceled(appointment.id);
      }

      setAppointments((current) => current.map((item) =>
        Number(item.id) === Number(appointment.id)
          ? {
              ...item,
              status: APPOINTMENT_STATUS.canceled,
              acesso_visitante: null
            }
          : item
      ));
      setActiveTab("canceled");
      setMessage("Agendamento cancelado com sucesso.");
      setPendingCancellation(null);
      track("agendamento_cancelado", {
        page: "meus_agendamentos",
        mission: "acompanhar_agendamentos",
        businessId: appointment.negocio_id,
        properties: {
          agendamento_id: Number(appointment.id),
          origem: isAuthenticated ? "conta" : "visitante"
        }
      });
    } catch (error) {
      setCancelError(error.message);
    } finally {
      setCancelingId(null);
    }
  }

  async function evaluateAppointment(appointment, rating) {
    setEvaluatingId(appointment.id);
    setEvaluationError("");
    setEvaluationErrorId(null);
    setMessage("");

    try {
      const result = await apiRequest(`/agendamentos/${appointment.id}/avaliar`, {
        method: "PATCH",
        body: { avaliacao: rating }
      });
      const savedRating = Number(result?.avaliacao ?? rating);

      setAppointments((current) => current.map((item) =>
        Number(item.id) === Number(appointment.id)
          ? { ...item, avaliacao: savedRating }
          : item
      ));
      setMessage("Avaliação enviada. Obrigada por compartilhar sua experiência.");
      track("avaliacao_enviada", {
        page: "meus_agendamentos",
        mission: "avaliar_atendimento",
        businessId: appointment.negocio_id,
        properties: {
          agendamento_id: Number(appointment.id),
          servico_id: Number(appointment.servico_id) || null,
          avaliacao: savedRating
        }
      });
    } catch (error) {
      setEvaluationErrorId(appointment.id);
      setEvaluationError(error.message);
    } finally {
      setEvaluatingId(null);
    }
  }

  function selectTab(tabId, focus = false) {
    const nextIndex = TABS.findIndex((tab) => tab.id === tabId);

    setActiveTab(tabId);
    setMessage("");
    setEvaluationError("");
    setEvaluationErrorId(null);

    if (focus && nextIndex >= 0) {
      tabRefs.current[nextIndex]?.focus();
    }
  }

  function handleTabKeyDown(event, index) {
    const keyDirection = {
      ArrowLeft: -1,
      ArrowRight: 1
    }[event.key];

    let nextIndex;

    if (keyDirection) {
      nextIndex = (index + keyDirection + TABS.length) % TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = TABS.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    selectTab(TABS[nextIndex].id, true);
  }

  return (
    <main className="container page-content appointments-page">
      <header className="appointments-header">
        <div>
          <p className="eyebrow">Seus horários</p>
          <h1>Minha agenda</h1>
          <p>Acompanhe seus próximos atendimentos e consulte seu histórico.</p>
        </div>
        <Link className="button button-secondary" to="/">Agendar novo serviço</Link>
      </header>

      {!isAuthenticated && (
        <section className="visitor-notice">
          <div>
            <strong>Agendamento como visitante</strong>
            <p>
              Nesta sessão você pode acompanhar e cancelar o agendamento que acabou de criar.
              Entre na sua conta para reunir e gerenciar agendamentos feitos com login.
            </p>
          </div>
          <Link className="button button-small" to="/entrar">Entrar</Link>
        </section>
      )}

      {status === "loading" && <LoadingState>Carregando sua agenda...</LoadingState>}
      {status === "error" && (
        <ErrorState
          message={message || "Não foi possível carregar sua agenda."}
          onRetry={loadAppointments}
        />
      )}

      {status === "ready" && (
        <>
          {message && <p className="agenda-message" role="status">{message}</p>}
          <div className="agenda-tabs" role="tablist" aria-label="Status dos agendamentos">
            {TABS.map((tab, index) => (
              <button
                aria-controls={`appointments-panel-${tab.id}`}
                aria-selected={activeTab === tab.id}
                className={activeTab === tab.id ? "active" : ""}
                id={`appointments-tab-${tab.id}`}
                key={tab.id}
                onClick={() => selectTab(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                ref={(element) => { tabRefs.current[index] = element; }}
                role="tab"
                tabIndex={activeTab === tab.id ? 0 : -1}
                type="button"
              >
                {tab.label}
                <span>{grouped[tab.id].length}</span>
              </button>
            ))}
          </div>

          {TABS.map((tab) => (
            <div
              aria-labelledby={`appointments-tab-${tab.id}`}
              hidden={activeTab !== tab.id}
              id={`appointments-panel-${tab.id}`}
              key={tab.id}
              role="tabpanel"
              tabIndex={0}
            >
              {grouped[tab.id].length > 0 ? (
                <section className="appointments-list" aria-live="polite">
                  {grouped[tab.id].map((appointment) => (
                    <AppointmentCard
                      appointment={appointment}
                      canCancel={
                        [
                          APPOINTMENT_STATUS.scheduled,
                          APPOINTMENT_STATUS.confirmed
                        ].includes(appointment.status) &&
                        (
                          isAuthenticated ||
                          (
                            appointment.source === "visitor" &&
                            Boolean(appointment.acesso_visitante)
                          )
                        )
                      }
                      canEvaluate={
                        isAuthenticated &&
                        appointment.status === APPOINTMENT_STATUS.completed &&
                        !appointment.avaliacao
                      }
                      canceling={cancelingId === appointment.id}
                      evaluating={evaluatingId === appointment.id}
                      evaluationError={
                        evaluationErrorId === appointment.id
                          ? evaluationError
                          : ""
                      }
                      key={appointment.id}
                      onCancel={(item) => {
                        setCancelError("");
                        setPendingCancellation(item);
                      }}
                      onEvaluate={evaluateAppointment}
                    />
                  ))}
                </section>
              ) : (
                <section className="empty-agenda">
                  <span aria-hidden="true">♡</span>
                  <h2>Nenhum agendamento aqui</h2>
                  <p>
                    {tab.id === "scheduled"
                      ? "Quando você marcar um novo horário, ele aparecerá nesta lista."
                      : "Seu histórico aparecerá aqui conforme os atendimentos forem atualizados."}
                  </p>
                  {tab.id === "scheduled" && (
                    <Link className="button" to="/">Encontrar um serviço</Link>
                  )}
                </section>
              )}
            </div>
          ))}
        </>
      )}

      <CancelDialog
        appointment={pendingCancellation}
        canceling={cancelingId !== null}
        error={cancelError}
        onClose={() => {
          setCancelError("");
          setPendingCancellation(null);
        }}
        onConfirm={cancelAppointment}
      />
    </main>
  );
}
