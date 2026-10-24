import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
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
    ocupado: "Ocupado",
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

function getRescheduleProfessionals(professionals, serviceId, currentProfessionalId) {
  return professionals.filter((professional) => professional.ativo !== false
    && (String(professional.id) === String(currentProfessionalId)
      || !serviceId
      || (professional.servico_ids || []).some((id) => String(id) === String(serviceId))));
}

function getLocalDateKey(
  date = new Date(),
  timeZone = ""
) {
  if (timeZone) {
    try {
      const parts =
        new Intl.DateTimeFormat(
          "pt-BR",
          {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }
        ).formatToParts(
          date
        );
      const part = (type) =>
        parts.find(
          (item) =>
            item.type === type
        )?.value;

      return `${part("year")}-${part("month")}-${part("day")}`;
    } catch {
      // Fallback local apenas para fusos inválidos recebidos de dados legados.
    }
  }

  const year =
    date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatAgendaDate(
  value,
  timeZone
) {
  const compact =
    formatDate(value)
      .replace(" de ", " ");

  if (
    value !==
    getLocalDateKey(
      new Date(),
      timeZone
    )
  ) {
    return compact;
  }

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
      {slot.continuacao && (
        <small>Continua desde {formatDate(slot.data_agendamento)} às {slot.hora_agendamento}</small>
      )}
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
  const [windowStart, setWindowStart] = useState("");
  const [refreshing, setRefreshing] = useState(true);
  const [readFailed, setReadFailed] = useState(false);
  const [loadedView, setLoadedView] = useState("");
  const readRef = useRef(null);
  const mutationRef = useRef(null);
  const viewKey = JSON.stringify([owner, windowStart]);
  const viewRef = useRef(viewKey);
  viewRef.current = viewKey;

  const load = useCallback(async () => {
    readRef.current?.abort();
    const controller = new AbortController();
    readRef.current = controller;
    const isCurrent = () => readRef.current === controller
      && !controller.signal.aborted && viewRef.current === viewKey;
    setError("");
    setRefreshing(true);
    try {
      const path = owner
        ? `/agenda-geral${windowStart ? `?data_inicio=${encodeURIComponent(windowStart)}` : ""}`
        : "/agenda-profissional";
      const result = await apiRequest(path, {
        headers: { "X-AF-Contexto": owner ? "dono" : "profissional" },
        signal: controller.signal,
      });
      if (!isCurrent()) return false;
      setData(result);
      setLoadedView(viewKey);
      setReadFailed(false);
      const days = getValidAgendaDays(result.agenda);
      const firstDay = days[0];
      setSelectedDate((current) => days.some((day) => day.data === current) ? current : firstDay?.data || "");
      if (owner) {
        const people = getValidProfessionals(firstDay?.profissionais);
        setSelectedProfessional((current) => people.some((person) => String(person.id) === current)
          ? current : String(people[0]?.id || ""));
      }
      return true;
    } catch (requestError) {
      if (isCurrent()) {
        setReadFailed(true);
        setError(requestError.message);
      }
      return false;
    } finally {
      if (isCurrent()) setRefreshing(false);
    }
  }, [owner, windowStart, viewKey]);

  useEffect(() => {
    mutationRef.current = null;
    setUpdating("");
    setCancelTarget(null);
    setRescheduleTarget(null);
    void load();
    return () => {
      readRef.current?.abort();
      readRef.current = null;
      mutationRef.current = null;
    };
  }, [load]);

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
  const activeProfessional = owner
    ? professionals.find((item) => String(item.id) === selectedProfessional) || professionals[0]
    : null;
  const eligibleRescheduleProfessionals = getRescheduleProfessionals(
    professionals, rescheduleTarget?.servico_id,
    rescheduleTarget?.profissional_id || activeProfessional?.id
  );
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

  const canWrite = loadedView === viewKey && !refreshing && !readFailed && !updating;
  const canBlock = canWrite && (!owner || activeProfessional?.ativo !== false);

  async function mutate({ key, path, options, onSuccess }) {
    if (mutationRef.current || !canWrite) return;
    const operation = { key, viewKey };
    mutationRef.current = operation;
    const isCurrent = () => mutationRef.current === operation && viewRef.current === operation.viewKey;
    setUpdating(key);
    setError("");
    setMessage("");
    try {
      const result = await apiRequest(path, options);
      if (!isCurrent()) return;
      onSuccess?.(result);
      setMessage(result.mensagem);
      const refreshed = await load();
      if (isCurrent() && !refreshed) {
        setError("Alteração salva. Não foi possível atualizar a agenda. Atualize a agenda para continuar.");
      }
    } catch (requestError) {
      if (!isCurrent()) return;
      const status = Number(requestError.status || requestError.statusCode);
      if (!status || status >= 500 || status === 408) {
        setCancelTarget(null);
        setRescheduleTarget(null);
        setReadFailed(true);
        setError("Não foi possível confirmar a alteração. Atualize a agenda antes de tentar novamente.");
      } else {
        setError(requestError.message);
      }
    } finally {
      if (mutationRef.current === operation) {
        mutationRef.current = null;
        setUpdating("");
      }
    }
  }

  async function toggleSlot(slot) {
    if (!canBlock || !["livre", "bloqueado"].includes(slot.status)) return;
    return mutate({
      key: `bloqueio-${selectedDate}-${slot.hora}-${activeProfessional?.id || "self"}`,
      path: "/bloqueios-horario",
      options: {
        method: "POST",
        headers: { "X-AF-Contexto": owner ? "dono" : "profissional" },
        body: {
          data: selectedDate,
          hora: slot.hora,
          bloqueado: slot.status === "livre",
          ...(owner && activeProfessional ? { profissional_id: activeProfessional.id } : {}),
        },
      },
    });
  }

  async function updateAttendance(slot, status) {
    if (!slot.agendamento_id) return;
    return mutate({
      key: `atendimento-${slot.agendamento_id}-${status}`,
      path: `/agendamentos/${slot.agendamento_id}/atendimento`,
      options: { method: "PATCH", body: { status } },
    });
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
    return mutate({
      key: `cancelamento-${cancelTarget.agendamento_id}`,
      path: `/agendamentos/${cancelTarget.agendamento_id}/cancelar-operacional`,
      options: {
        method: "PATCH",
        body: { motivo_tipo: cancelReasonType, motivo: cancelReason.trim() || null },
      },
      onSuccess: () => {
        setCancelTarget(null);
        setCancelReasonType("");
        setCancelReason("");
      },
    });
  }

  function openReschedule(slot) {
    if (!slot.agendamento_id || !slot.pode_reagendar) return;

    setCancelTarget(null);
    setCancelReasonType("");
    setCancelReason("");
    setRescheduleTarget(slot);
    setRescheduleDate(slot.data_agendamento || selectedDate);
    setRescheduleTime(String(slot.hora_agendamento || slot.hora || "").slice(0, 5));
    const currentId = slot.profissional_id || activeProfessional?.id;
    const eligible = getRescheduleProfessionals(professionals, slot.servico_id, currentId);
    const nextProfessional = eligible.find((person) => String(person.id) === String(currentId)) || eligible[0];
    setRescheduleProfessionalId(String(nextProfessional?.id || ""));
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
    if (!rescheduleTarget?.agendamento_id || !rescheduleDate || !rescheduleTime) return;
    return mutate({
      key: `reagendamento-${rescheduleTarget.agendamento_id}`,
      path: `/agendamentos/${rescheduleTarget.agendamento_id}/reagendar-operacional`,
      options: {
        method: "PATCH",
        body: {
          data: rescheduleDate,
          horario: rescheduleTime,
          ...(owner && rescheduleProfessionalId ? { profissional_id: Number(rescheduleProfessionalId) } : {}),
        },
      },
      onSuccess: () => {
        setRescheduleTarget(null);
        setRescheduleDate("");
        setRescheduleTime("");
        setRescheduleProfessionalId("");
      },
    });
  }

  function changeWindow(value) {
    if (mutationRef.current) return;
    setSelectedDate("");
    setDatePageStart(0);
    setMessage("");
    if (value === windowStart) void load();
    else setWindowStart(value);
  }

  function moveWeek(days) {
    const start = windowStart || dates[0]?.data;
    if (!start) return;
    const day = new Date(`${start}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() + days);
    if (!Number.isFinite(day.getTime()) || day.getUTCFullYear() < 1 || day.getUTCFullYear() > 9999
      || day.toISOString().slice(0, 10) > "9999-12-25") return;
    changeWindow(day.toISOString().slice(0, 10));
  }

  if (!data && !error) return <main className="workspace-page"><LoadingState>Carregando agenda...</LoadingState></main>;
  if (!data && error) return <main className="workspace-page"><ErrorState message={error} onRetry={() => void load()} /></main>;

  return (
    <main aria-busy={refreshing} className="workspace-page agenda-workspace-page">
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">{owner ? "Seu negócio em movimento" : "Seu dia de trabalho"}</p>
          <h1>{owner ? "Agenda geral" : "Minha agenda"}</h1>
          <p>Bloqueie horários livres, registre cancelamentos operacionais e finalize atendimentos com o estado correto.</p>
        </div>
      </header>

      {owner && (
        <section className="panel agenda-period-controls" aria-label="Período da agenda">
          <label>
            Data inicial
            <input type="date" value={windowStart || dates[0]?.data || ""}
              disabled={Boolean(updating)}
              min="0001-01-01"
              max="9999-12-25"
              onChange={(event) => { if (event.target.value) changeWindow(event.target.value); }} />
          </label>
          <button className="button button-secondary button-small" type="button" disabled={Boolean(updating)} onClick={() => moveWeek(-7)}>Semana anterior</button>
          <button className="button button-secondary button-small" type="button" disabled={Boolean(updating)} onClick={() => changeWindow("")}>Hoje</button>
          <button className="button button-secondary button-small" type="button" disabled={Boolean(updating)} onClick={() => moveWeek(7)}>Próxima semana</button>
        </section>
      )}
      {refreshing && <p role="status">Atualizando agenda...</p>}
      {error && !cancelTarget && !rescheduleTarget && (
        <div className="form-error" role="alert">
          <p>{error}</p>
          {readFailed && <button className="button button-secondary button-small" type="button" disabled={refreshing || Boolean(updating)} onClick={() => void load()}>Atualizar agenda</button>}
        </div>
      )}

      {dates.length === 0 ? (
        owner ? (
          <EmptyState title="Nenhum profissional na agenda">
            Vincule profissionais e configure os horários para começar.
          </EmptyState>
        ) : (
          <EmptyState
            action={(
              <Link className="button button-small" to="/profissional/horarios">
                Ajustar meus horários
              </Link>
            )}
            title="Sua agenda ainda está vazia"
          >
            Confira seus horários de atendimento para começar a receber agendamentos.
          </EmptyState>
        )
      ) : (
        <>
          <section className={owner && professionals.length > 1 ? "agenda-toolbar panel has-professional-filter" : "agenda-toolbar panel"}>
            <div className="agenda-date-carousel">
              <button
                aria-label="Ver datas anteriores"
                className="agenda-date-arrow"
                disabled={!canShowPreviousDates || Boolean(updating)}
                onClick={showPreviousDates}
                type="button"
              >
                ‹
              </button>
              <div className="date-switcher" aria-label="Escolha uma data">
                {visibleDates.map((day) => (
                  <button aria-pressed={selectedDate === day.data} className={selectedDate === day.data ? "active" : ""} key={day.data} disabled={Boolean(updating) || refreshing || readFailed || loadedView !== viewKey} onClick={() => selectDate(day)} type="button">
                    {formatAgendaDate(
                      day.data,
                      data?.fuso_horario
                    )}
                  </button>
                ))}
              </div>
              <button
                aria-label="Ver próximas datas"
                className="agenda-date-arrow"
                disabled={!canShowNextDates || Boolean(updating)}
                onClick={showNextDates}
                type="button"
              >
                ›
              </button>
            </div>
            {owner && professionals.length > 1 && (
              <label>
                Profissional
                <select disabled={Boolean(updating) || refreshing || readFailed || loadedView !== viewKey} onChange={(event) => setSelectedProfessional(event.target.value)} value={activeProfessional?.id || ""}>
                  {professionals.map((professional) => (
                    <option key={professional.id} value={professional.id}>{professional.nome}{professional.ativo === false ? " (inativa)" : ""}</option>
                  ))}
                </select>
              </label>
            )}
          </section>

          {message && (
            <div className="agenda-feedback-toast" role="status">
              <ConfirmationIcon className="agenda-feedback-icon" />
              <span>{message}</span>
              <button aria-label="Fechar aviso" onClick={() => setMessage("")} type="button">×</button>
            </div>
          )}

          {owner && activeProfessional?.ativo === false && (
            <p className="muted">Profissional inativa. Você pode gerenciar os agendamentos existentes.</p>
          )}

          {owner && professionals.length === 0 ? (
            <EmptyState title="Nenhuma profissional disponível neste dia">
              Confira a equipe e os horários configurados para esta data.
            </EmptyState>
          ) : !owner && activeDay?.trabalha === false && slots.length === 0 ? (
            <EmptyState title="Dia de folga">Você marcou este dia como indisponível.</EmptyState>
          ) : owner && activeProfessional?.ativo === false && slots.length === 0 ? (
            <EmptyState title="Nenhum agendamento neste dia">Escolha outra data para consultar as reservas dessa profissional.</EmptyState>
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
                const slotRescheduleUpdating = updating ===
                  `reagendamento-${slot.agendamento_id || "nenhum"}`;
                const slotUpdating = slotRescheduleUpdating
                  || updating === `cancelamento-${slot.agendamento_id}`
                  || updating.startsWith(`atendimento-${slot.agendamento_id}-`);
                const statusLabel = isBlockUpdating
                  ? slot.status === "livre" ? "Bloqueando..." : "Liberando..."
                  : getStatusLabel(slot.status);

                if (["livre", "bloqueado"].includes(slot.status)) {
                  return (
                    <button
                      aria-busy={isBlockUpdating || undefined}
                      className={`slot-card slot-${slot.status}${isBlockUpdating ? " is-updating" : ""}`}
                      disabled={!canBlock}
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
                        {owner ? (
                          <>
                            {slot.pode_reagendar && (
                              <button
                                className="button button-secondary button-small"
                                disabled={!canWrite}
                                onClick={() => openReschedule(slot)}
                                type="button"
                              >
                                {slotRescheduleUpdating ? "Reagendando..." : "Reagendar"}
                              </button>
                            )}
                            {slot.pode_cancelar && (
                              <button
                                className="button button-secondary button-small slot-cancel-button"
                                disabled={!canWrite}
                                onClick={() => openCancellation(slot)}
                                type="button"
                              >
                                Cancelar agendamento
                              </button>
                            )}
                            {slot.pode_iniciar_atendimento && (
                              <button
                                className="button button-small"
                                disabled={!canWrite}
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
                              disabled={!canWrite || !slot.pode_marcar_realizado}
                              onClick={() => updateAttendance(slot, "realizado")}
                              type="button"
                            >
                              {updating === `atendimento-${slot.agendamento_id}-realizado`
                                ? "Salvando..."
                                : "Concluir"}
                            </button>
                            <button
                              className="button button-secondary button-small"
                              disabled={!canWrite || !slot.pode_marcar_falta}
                              onClick={() => updateAttendance(slot, "falta")}
                              type="button"
                            >
                              {updating === `atendimento-${slot.agendamento_id}-falta`
                                ? "Salvando..."
                                : "Marcar falta"}
                            </button>
                          </>
                        ) : (
                          <>
                            {slot.pode_iniciar_atendimento ? (
                              <button
                                className="button button-small slot-primary-action"
                                disabled={!canWrite}
                                onClick={() => updateAttendance(slot, "iniciado")}
                                type="button"
                              >
                                {updating === `atendimento-${slot.agendamento_id}-iniciado`
                                  ? "Iniciando..."
                                  : "Iniciar atendimento"}
                              </button>
                            ) : slot.pode_marcar_realizado ? (
                              <button
                                className="button button-small slot-primary-action"
                                disabled={!canWrite}
                                onClick={() => updateAttendance(slot, "realizado")}
                                type="button"
                              >
                                {updating === `atendimento-${slot.agendamento_id}-realizado`
                                  ? "Salvando..."
                                  : "Concluir atendimento"}
                              </button>
                            ) : null}

                            {(slot.pode_reagendar ||
                              slot.pode_cancelar ||
                              slot.pode_marcar_falta ||
                              (slot.pode_iniciar_atendimento &&
                                slot.pode_marcar_realizado)) && (
                              <details className="slot-secondary-actions">
                                <summary>Mais</summary>
                                <div className="slot-secondary-actions-menu">
                                  {slot.pode_reagendar && (
                                    <button
                                      className="button button-secondary button-small"
                                      disabled={!canWrite}
                                      onClick={() => openReschedule(slot)}
                                      type="button"
                                    >
                                      {slotRescheduleUpdating ? "Reagendando..." : "Reagendar"}
                                    </button>
                                  )}
                                  {slot.pode_cancelar && (
                                    <button
                                      className="button button-secondary button-small slot-cancel-button"
                                      disabled={!canWrite}
                                      onClick={() => openCancellation(slot)}
                                      type="button"
                                    >
                                      Cancelar agendamento
                                    </button>
                                  )}
                                  {slot.pode_iniciar_atendimento &&
                                    slot.pode_marcar_realizado && (
                                      <button
                                        className="button button-secondary button-small"
                                        disabled={!canWrite}
                                        onClick={() => updateAttendance(slot, "realizado")}
                                        type="button"
                                      >
                                        {updating === `atendimento-${slot.agendamento_id}-realizado`
                                          ? "Salvando..."
                                          : "Concluir"}
                                      </button>
                                    )}
                                                                    {slot.pode_marcar_falta && (
                                    <button
                                      className="button button-secondary button-small"
                                      disabled={!canWrite}
                                      onClick={() => updateAttendance(slot, "falta")}
                                      type="button"
                                    >
                                      {updating === `atendimento-${slot.agendamento_id}-falta`
                                        ? "Salvando..."
                                        : "Marcar falta"}
                                    </button>
                                  )}
                                </div>
                              </details>
                            )}
                          </>
                        )}
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
            {error && <p className="form-error" role="alert">{error}</p>}

            <div className="agenda-cancel-reason">
              <label htmlFor="agenda-reschedule-date">
                Nova data
              </label>
              <input
                disabled={Boolean(updating)}
                id="agenda-reschedule-date"
                min={getLocalDateKey(
                  new Date(),
                  data?.fuso_horario
                )}
                onChange={(event) => setRescheduleDate(event.target.value)}
                type="date"
                value={rescheduleDate}
              />

              <label htmlFor="agenda-reschedule-time">
                Novo horário
              </label>
              <input
                disabled={Boolean(updating)}
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
                    disabled={Boolean(updating)}
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
                  !canWrite ||
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
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="agenda-cancel-reason">
              <label htmlFor="agenda-cancel-reason-type">
                Motivo do cancelamento
              </label>
              <select
                disabled={Boolean(updating)}
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
                disabled={Boolean(updating)}
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
                  !canWrite ||
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
