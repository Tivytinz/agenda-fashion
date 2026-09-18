import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { ConfirmationIcon } from "../components/ConfirmationIcon";
import { EmptyState, ErrorState, LoadingState } from "../components/ScreenState";
import {
  getAgendaEntityName,
  getValidAgendaDays,
  getValidProfessionals,
  getValidSlots
} from "../utils/agenda";
import { formatDate } from "../utils/format";

function getStatusLabel(status) {
  return {
    livre: "Livre",
    bloqueado: "Bloqueado",
    agendado: "Agendado",
    confirmado: "Confirmado",
    realizado: "Realizado",
    falta: "Falta",
    passado: "Encerrado"
  }[status] || status;
}

function getDatePageSize() {
  if (typeof window === "undefined") return 5;
  if (window.innerWidth >= 1440) return 6;
  if (window.innerWidth >= 1024) return 5;
  if (window.innerWidth >= 920) return 4;
  if (window.innerWidth >= 680) return 3;
  return 2;
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatAgendaDate(value) {
  const compact = formatDate(value).replace(" de ", " ");
  if (value !== getLocalDateKey()) return compact;
  return `Hoje, ${compact.replace(/^[^,]+,\s*/, "")}`;
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      className="slot-lock-icon"
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function SlotSummary({ slot, statusLabel }) {
  const client = getAgendaEntityName(slot.cliente);
  const service = getAgendaEntityName(slot.servico);

  return (
    <>
      <strong>{String(slot.hora).slice(0, 5)}</strong>
      <span className="slot-status">
        {slot.status === "bloqueado" && <LockIcon />}
        <span>{statusLabel}</span>
      </span>
      {(client || service) && (
        <small>{client || "Cliente"} · {service || "Serviço"}</small>
      )}
    </>
  );
}

export function AgendaWorkspacePage({ owner = false }) {
  const [data, setData] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedProfessional, setSelectedProfessional] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [updating, setUpdating] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReasonType, setCancelReasonType] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleProfessionalId, setRescheduleProfessionalId] = useState("");
  const [datePageSize, setDatePageSize] = useState(getDatePageSize);
  const [datePageStart, setDatePageStart] = useState(0);

  const load = useCallback(async () => {
    setError("");
    try {
      const result = await apiRequest(owner ? "/agenda-geral" : "/agenda-profissional");
      setData(result);
      const firstDay = getValidAgendaDays(result.agenda)[0];
      const firstDate = firstDay?.data || "";
      setSelectedDate((current) => current || firstDate);
      if (owner) {
        const firstProfessional = getValidProfessionals(firstDay?.profissionais)[0]?.id;
        setSelectedProfessional((current) => current || String(firstProfessional || ""));
      }
    } catch (requestError) {
      setError(requestError.message);
      throw requestError;
    }
  }, [owner]);

  useEffect(() => { void load().catch(() => {}); }, [load]);

  useEffect(() => {
    function handleResize() {
      setDatePageSize(getDatePageSize());
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!message) return undefined;
    const timeout = window.setTimeout(() => setMessage(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    if (!cancelTarget) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape" && !updating.startsWith("cancelamento-")) {
        setCancelTarget(null);
        setCancelReasonType("");
        setCancelReason("");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cancelTarget, updating]);

  useEffect(() => {
    if (!rescheduleTarget) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape" && !updating.startsWith("reagendamento-")) {
        setRescheduleTarget(null);
        setRescheduleDate("");
        setRescheduleTime("");
        setRescheduleProfessionalId("");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rescheduleTarget, updating]);

  const dates = getValidAgendaDays(data?.agenda);
  const activeDay = dates.find((day) => day.data === selectedDate) || dates[0];
  const professionals = owner ? getValidProfessionals(activeDay?.profissionais) : [];
  const eligibleRescheduleProfessionals =
    owner && rescheduleTarget?.servico_id
      ? professionals.filter(
          (professional) =>
            (professional.servico_ids || [])
              .some(
                (id) =>
                  String(id) ===
                  String(
                    rescheduleTarget.servico_id
                  )
              )
        )
      : professionals;
  const activeProfessional = owner
    ? professionals.find((item) => String(item.id) === selectedProfessional) || professionals[0]
    : null;
  const slots = getValidSlots(owner ? activeProfessional?.horarios : activeDay?.horarios);
  const maxDatePageStart = Math.max(0, dates.length - datePageSize);
  const safeDatePageStart = Math.min(datePageStart, maxDatePageStart);
  const visibleDates = dates.slice(safeDatePageStart, safeDatePageStart + datePageSize);
  const canShowPreviousDates = safeDatePageStart > 0;
  const canShowNextDates = safeDatePageStart + datePageSize < dates.length;
  const cancellationUpdating = Boolean(
    cancelTarget?.agendamento_id &&
    updating === `cancelamento-${cancelTarget.agendamento_id}`
  );
  const rescheduleUpdating = Boolean(
    rescheduleTarget?.agendamento_id &&
    updating === `reagendamento-${rescheduleTarget.agendamento_id}`
  );

  useEffect(() => {
    const selectedIndex = dates.findIndex((day) => day.data === selectedDate);
    if (selectedIndex < 0) return;

    setDatePageStart((current) => {
      const safeCurrent = Math.min(current, Math.max(0, dates.length - datePageSize));
      if (selectedIndex < safeCurrent) {
        return Math.floor(selectedIndex / datePageSize) * datePageSize;
      }
      if (selectedIndex >= safeCurrent + datePageSize) {
        return Math.floor(selectedIndex / datePageSize) * datePageSize;
      }
      return safeCurrent;
    });
  }, [datePageSize, dates.length, selectedDate]);

  function selectDate(day) {
    setSelectedDate(day.data);
    setMessage("");
    setCancelTarget(null);
    setCancelReasonType("");
    setCancelReason("");
    setRescheduleTarget(null);
    setRescheduleDate("");
    setRescheduleTime("");
        setRescheduleProfessionalId("");
    if (owner) {
      const firstProfessional = getValidProfessionals(day.profissionais)[0];
      setSelectedProfessional(String(firstProfessional?.id || ""));
    }
  }

  function showPreviousDates() {
    setDatePageStart((current) => Math.max(0, current - datePageSize));
  }

  function showNextDates() {
    setDatePageStart((current) => Math.min(maxDatePageStart, current + datePageSize));
  }

  async function toggleSlot(slot) {
    if (!["livre", "bloqueado"].includes(slot.status)) return;
    const key = `bloqueio-${selectedDate}-${slot.hora}-${activeProfessional?.id || "self"}`;
    setUpdating(key);
    setError("");
    setMessage("");
    try {
      const result = await apiRequest("/bloqueios-horario", {
        method: "POST",
        body: {
          data: selectedDate,
          hora: slot.hora,
          ...(owner && activeProfessional ? { profissional_id: activeProfessional.id } : {})
        }
      });
      setMessage(result.mensagem);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdating("");
    }
  }

  async function updateAttendance(slot, status) {
    if (!slot.agendamento_id) return;

    const key = `atendimento-${slot.agendamento_id}-${status}`;
    setUpdating(key);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest(
        `/agendamentos/${slot.agendamento_id}/atendimento`,
        {
          method: "PATCH",
          body: { status }
        }
      );
      setMessage(result.mensagem);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdating("");
    }
  }

  function openCancellation(slot) {
    if (!slot.agendamento_id || !slot.pode_cancelar) return;
    setCancelTarget(slot);
    setCancelReasonType("");
    setCancelReason("");
    setError("");
    setMessage("");
  }

  function closeCancellation() {
    if (cancellationUpdating) return;
    setCancelTarget(null);
    setCancelReasonType("");
    setCancelReason("");
  }

  async function cancelAppointment() {
    if (!cancelTarget?.agendamento_id) return;

    const key = `cancelamento-${cancelTarget.agendamento_id}`;
    setUpdating(key);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest(
        `/agendamentos/${cancelTarget.agendamento_id}/cancelar-operacional`,
        {
          method: "PATCH",
          body: {
            motivo_tipo: cancelReasonType,
            motivo: cancelReason.trim() || null
          }
        }
      );
      setCancelTarget(null);
      setCancelReasonType("");
      setCancelReason("");
      setMessage(result.mensagem);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdating("");
    }
  }

  function openReschedule(slot) {
    if (!slot.agendamento_id || !slot.pode_reagendar) return;

    setCancelTarget(null);
    setCancelReasonType("");
    setCancelReason("");
    setRescheduleTarget(slot);
    setRescheduleDate(selectedDate);
    setRescheduleTime(String(slot.hora || "").slice(0, 5));
    setRescheduleProfessionalId(
      String(
        slot.profissional_id ||
        activeProfessional?.id ||
        ""
      )
    );
    setError("");
    setMessage("");
  }

  function closeReschedule() {
    if (rescheduleUpdating) return;

    setRescheduleTarget(null);
    setRescheduleDate("");
    setRescheduleTime("");
        setRescheduleProfessionalId("");
  }

  async function rescheduleAppointment() {
    if (
      !rescheduleTarget?.agendamento_id ||
      !rescheduleDate ||
      !rescheduleTime
    ) {
      return;
    }

    const key = `reagendamento-${rescheduleTarget.agendamento_id}`;
    setUpdating(key);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest(
        `/agendamentos/${rescheduleTarget.agendamento_id}/reagendar-operacional`,
        {
          method: "PATCH",
          body: {
            data: rescheduleDate,
            horario: rescheduleTime,
            ...(owner &&
              rescheduleProfessionalId
              ? {
                  profissional_id:
                    Number(
                      rescheduleProfessionalId
                    )
                }
              : {})
          }
        }
      );

      setRescheduleTarget(null);
      setRescheduleDate("");
      setRescheduleTime("");
        setRescheduleProfessionalId("");
      setMessage(result.mensagem);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdating("");
    }
  }

  if (!data && !error) return <div className="workspace-page"><LoadingState>Carregando agenda...</LoadingState></div>;
  if (!data && error) return <div className="workspace-page"><ErrorState message={error} onRetry={() => void load().catch(() => {})} /></div>;

  return (
    <main className="workspace-page agenda-workspace-page">
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">{owner ? "Seu negócio em movimento" : "Seu dia de trabalho"}</p>
          <h1>{owner ? "Agenda geral" : "Minha agenda profissional"}</h1>
          <p>Bloqueie horários livres, registre cancelamentos operacionais e finalize atendimentos com o estado correto.</p>
        </div>
      </header>

      {dates.length === 0 ? (
        <EmptyState title="Nenhum profissional na agenda">
          Vincule profissionais e configure os horários para começar.
        </EmptyState>
      ) : (
        <>
          <section className={owner && professionals.length > 1 ? "agenda-toolbar panel has-professional-filter" : "agenda-toolbar panel"}>
            <div className="agenda-date-carousel">
              <button
                aria-label="Ver datas anteriores"
                className="agenda-date-arrow"
                disabled={!canShowPreviousDates}
                onClick={showPreviousDates}
                type="button"
              >
                ‹
              </button>
              <div className="date-switcher" aria-label="Escolha uma data">
                {visibleDates.map((day) => (
                  <button aria-pressed={selectedDate === day.data} className={selectedDate === day.data ? "active" : ""} key={day.data} onClick={() => selectDate(day)} type="button">
                    {formatAgendaDate(day.data)}
                  </button>
                ))}
              </div>
              <button
                aria-label="Ver próximas datas"
                className="agenda-date-arrow"
                disabled={!canShowNextDates}
                onClick={showNextDates}
                type="button"
              >
                ›
              </button>
            </div>
            {owner && professionals.length > 1 && (
              <label>
                Profissional
                <select onChange={(event) => setSelectedProfessional(event.target.value)} value={activeProfessional?.id || ""}>
                  {professionals.map((professional) => (
                    <option key={professional.id} value={professional.id}>{professional.nome}</option>
                  ))}
                </select>
              </label>
            )}
          </section>

          {error && <p className="form-error" role="alert">{error}</p>}
          {message && (
            <div className="agenda-feedback-toast" role="status">
              <ConfirmationIcon className="agenda-feedback-icon" />
              <span>{message}</span>
              <button aria-label="Fechar aviso" onClick={() => setMessage("")} type="button">×</button>
            </div>
          )}

          {owner && professionals.length === 0 ? (
            <EmptyState title="Nenhuma profissional disponível neste dia">
              Confira a equipe e os horários configurados para esta data.
            </EmptyState>
          ) : !owner && activeDay?.trabalha === false && slots.length === 0 ? (
            <EmptyState title="Dia de folga">Você marcou este dia como indisponível.</EmptyState>
          ) : slots.length === 0 ? (
            <EmptyState title="Nenhum horário configurado">
              Ajuste os horários de atendimento para disponibilizar este dia.
            </EmptyState>
          ) : (
            <section className="slot-grid" aria-label={`Horários de ${selectedDate}`}>
              {slots.map((slot) => {
                const blockKey = `bloqueio-${selectedDate}-${slot.hora}-${activeProfessional?.id || "self"}`;
                const isBlockUpdating = updating === blockKey;
                const isAppointment = Boolean(slot.agendamento_id);
                const attendanceUpdating = updating.startsWith(
                  `atendimento-${slot.agendamento_id || "nenhum"}-`
                );
                const slotCancellationUpdating = updating ===
                  `cancelamento-${slot.agendamento_id || "nenhum"}`;
                const slotRescheduleUpdating = updating ===
                  `reagendamento-${slot.agendamento_id || "nenhum"}`;
                const slotUpdating =
                  attendanceUpdating ||
                  slotCancellationUpdating ||
                  slotRescheduleUpdating;
                const statusLabel = isBlockUpdating
                  ? slot.status === "livre" ? "Bloqueando..." : "Liberando..."
                  : getStatusLabel(slot.status);

                if (["livre", "bloqueado"].includes(slot.status)) {
                  return (
                    <button
                      aria-busy={isBlockUpdating || undefined}
                      className={`slot-card slot-${slot.status}${isBlockUpdating ? " is-updating" : ""}`}
                      disabled={isBlockUpdating}
                      key={`${slot.hora}-${slot.agendamento_id || ""}`}
                      onClick={() => toggleSlot(slot)}
                      type="button"
                    >
                      <SlotSummary slot={slot} statusLabel={statusLabel} />
                    </button>
                  );
                }

                return (
                  <article
                    className={`slot-card slot-card-static slot-${slot.status}${slotUpdating ? " is-updating" : ""}`}
                    key={`${slot.hora}-${slot.agendamento_id || ""}`}
                  >
                    <SlotSummary slot={slot} statusLabel={statusLabel} />

                    {isAppointment && ["agendado", "confirmado"].includes(slot.status) && (
                      <div className="slot-lifecycle-actions" aria-label="Gerenciar agendamento">
                        {slot.pode_reagendar && (
                          <button
                            className="button button-secondary button-small"
                            disabled={slotUpdating}
                            onClick={() => openReschedule(slot)}
                            type="button"
                          >
                            {slotRescheduleUpdating ? "Reagendando..." : "Reagendar"}
                          </button>
                        )}
                        {slot.pode_cancelar && (
                          <button
                            className="button button-secondary button-small slot-cancel-button"
                            disabled={slotUpdating}
                            onClick={() => openCancellation(slot)}
                            type="button"
                          >
                            Cancelar agendamento
                          </button>
                        )}
                        {slot.pode_iniciar_atendimento && (
                          <button
                            className="button button-small"
                            disabled={slotUpdating}
                            onClick={() => updateAttendance(slot, "iniciado")}
                            type="button"
                          >
                            {updating === `atendimento-${slot.agendamento_id}-iniciado`
                              ? "Iniciando..."
                              : "Iniciar atendimento"}
                          </button>
                        )}
                        <button
                          className="button button-small"
                          disabled={slotUpdating || !slot.pode_marcar_realizado}
                          onClick={() => updateAttendance(slot, "realizado")}
                          type="button"
                        >
                          {updating === `atendimento-${slot.agendamento_id}-realizado`
                            ? "Salvando..."
                            : "Concluir"}
                        </button>
                        <button
                          className="button button-secondary button-small"
                          disabled={slotUpdating || !slot.pode_marcar_falta}
                          onClick={() => updateAttendance(slot, "falta")}
                          type="button"
                        >
                          {updating === `atendimento-${slot.agendamento_id}-falta`
                            ? "Salvando..."
                            : "Marcar falta"}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </section>
          )}
        </>
      )}

      {rescheduleTarget && (
        <div
          className="agenda-cancel-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeReschedule();
          }}
        >
          <section
            aria-labelledby="agenda-reschedule-title"
            aria-modal="true"
            className="agenda-cancel-dialog"
            role="dialog"
          >
            <p className="eyebrow">Reagendar compromisso</p>
            <h2 id="agenda-reschedule-title">Escolha o novo horário</h2>
            <p className="agenda-cancel-summary">
              {getAgendaEntityName(rescheduleTarget.cliente) || "Cliente"}
              {" · "}
              {getAgendaEntityName(rescheduleTarget.servico) || "Serviço"}
            </p>
            <p>
              O horário antigo só será liberado depois que o novo horário for validado com sucesso.
            </p>

            <div className="agenda-cancel-reason">
              <label htmlFor="agenda-reschedule-date">
                Nova data
              </label>
              <input
                id="agenda-reschedule-date"
                min={getLocalDateKey()}
                onChange={(event) => setRescheduleDate(event.target.value)}
                type="date"
                value={rescheduleDate}
              />

              <label htmlFor="agenda-reschedule-time">
                Novo horário
              </label>
              <input
                id="agenda-reschedule-time"
                onChange={(event) => setRescheduleTime(event.target.value)}
                type="time"
                value={rescheduleTime}
              />

              {owner && (
                <>
                  <label htmlFor="agenda-reschedule-professional">
                    Profissional responsável
                  </label>
                  <select
                    id="agenda-reschedule-professional"
                    onChange={(event) =>
                      setRescheduleProfessionalId(
                        event.target.value
                      )
                    }
                    value={rescheduleProfessionalId}
                  >
                    {eligibleRescheduleProfessionals.map(
                      (professional) => (
                        <option
                          key={professional.id}
                          value={professional.id}
                        >
                          {professional.nome}
                        </option>
                      )
                    )}
                  </select>
                  {eligibleRescheduleProfessionals.length === 0 && (
                    <small>
                      Nenhuma profissional ativa está habilitada para este serviço.
                    </small>
                  )}
                </>
              )}

              <small>
                O serviço, preço, duração e regra de cancelamento da reserva serão preservados.
              </small>
            </div>

            <div className="agenda-cancel-actions">
              <button
                className="button button-secondary"
                disabled={rescheduleUpdating}
                onClick={closeReschedule}
                type="button"
              >
                Manter horário atual
              </button>
              <button
                className="button"
                disabled={
                  rescheduleUpdating ||
                  !rescheduleDate ||
                  !rescheduleTime ||
                  (
                    owner &&
                    !rescheduleProfessionalId
                  )
                }
                onClick={() => void rescheduleAppointment()}
                type="button"
              >
                {rescheduleUpdating ? "Reagendando..." : "Confirmar reagendamento"}
              </button>
            </div>
          </section>
        </div>
      )}

      {cancelTarget && (
        <div
          className="agenda-cancel-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCancellation();
          }}
        >
          <section
            aria-labelledby="agenda-cancel-title"
            aria-modal="true"
            className="agenda-cancel-dialog"
            role="dialog"
          >
            <p className="eyebrow">Cancelar compromisso</p>
            <h2 id="agenda-cancel-title">Cancelar este agendamento?</h2>
            <p className="agenda-cancel-summary">
              {getAgendaEntityName(cancelTarget.cliente) || "Cliente"}
              {" · "}
              {getAgendaEntityName(cancelTarget.servico) || "Serviço"}
              {" · "}
              {String(cancelTarget.hora || "").slice(0, 5)}
            </p>
            <p>
              O horário será liberado na agenda. Lembretes pendentes serão cancelados e as notificações de cancelamento configuradas serão enfileiradas.
            </p>
            <div className="agenda-cancel-reason">
              <label htmlFor="agenda-cancel-reason-type">
                Motivo do cancelamento
              </label>
              <select
                id="agenda-cancel-reason-type"
                onChange={(event) => setCancelReasonType(event.target.value)}
                required
                value={cancelReasonType}
              >
                <option value="">Selecione um motivo</option>
                <option value="profissional_indisponivel">Profissional indisponível</option>
                <option value="estabelecimento_indisponivel">Estabelecimento indisponível</option>
                <option value="atendimento_interrompido">Atendimento interrompido</option>
                <option value="outro">Outro motivo</option>
              </select>
              <label htmlFor="agenda-cancel-reason">
                {cancelReasonType === "outro"
                  ? "Descreva o motivo"
                  : "Detalhes adicionais (opcional)"}
              </label>
              <textarea
                id="agenda-cancel-reason"
                maxLength={240}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="Adicione um detalhe útil para o histórico"
                rows={3}
                value={cancelReason}
              />
              <small>{cancelReason.length}/240</small>
              <small>
                Cliente ausente não deve ser cancelado: após 15 minutos, use “Marcar falta”.
              </small>
            </div>
            <div className="agenda-cancel-actions">
              <button
                className="button button-secondary"
                disabled={cancellationUpdating}
                onClick={closeCancellation}
                type="button"
              >
                Manter agendamento
              </button>
              <button
                className="button agenda-cancel-confirm"
                disabled={
                  cancellationUpdating ||
                  !cancelReasonType ||
                  (cancelReasonType === "outro" && !cancelReason.trim())
                }
                onClick={() => void cancelAppointment()}
                type="button"
              >
                {cancellationUpdating ? "Cancelando..." : "Confirmar cancelamento"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
