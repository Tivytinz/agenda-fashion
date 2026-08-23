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

export function AgendaWorkspacePage({ owner = false }) {
  const [data, setData] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedProfessional, setSelectedProfessional] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [updating, setUpdating] = useState("");
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

  const dates = getValidAgendaDays(data?.agenda);
  const activeDay = dates.find((day) => day.data === selectedDate) || dates[0];
  const professionals = owner ? getValidProfessionals(activeDay?.profissionais) : [];
  const activeProfessional = owner
    ? professionals.find((item) => String(item.id) === selectedProfessional) || professionals[0]
    : null;
  const slots = getValidSlots(owner ? activeProfessional?.horarios : activeDay?.horarios);
  const maxDatePageStart = Math.max(0, dates.length - datePageSize);
  const safeDatePageStart = Math.min(datePageStart, maxDatePageStart);
  const visibleDates = dates.slice(safeDatePageStart, safeDatePageStart + datePageSize);
  const canShowPreviousDates = safeDatePageStart > 0;
  const canShowNextDates = safeDatePageStart + datePageSize < dates.length;

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
    const key = `${selectedDate}-${slot.hora}-${activeProfessional?.id || "self"}`;
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

  if (!data && !error) return <div className="workspace-page"><LoadingState>Carregando agenda...</LoadingState></div>;
  if (!data && error) return <div className="workspace-page"><ErrorState message={error} onRetry={() => void load().catch(() => {})} /></div>;

  return (
    <main className="workspace-page agenda-workspace-page">
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">{owner ? "Seu negócio em movimento" : "Seu dia de trabalho"}</p>
          <h1>{owner ? "Agenda geral" : "Minha agenda profissional"}</h1>
          <p>Toque em um horário livre para bloqueá-lo ou em um bloqueado para liberar.</p>
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
          ) : !owner && activeDay?.trabalha === false ? (
            <EmptyState title="Dia de folga">Você marcou este dia como indisponível.</EmptyState>
          ) : slots.length === 0 ? (
            <EmptyState title="Nenhum horário configurado">
              Ajuste os horários de atendimento para disponibilizar este dia.
            </EmptyState>
          ) : (
            <section className="slot-grid" aria-label={`Horários de ${selectedDate}`}>
              {slots.map((slot) => {
                const key = `${selectedDate}-${slot.hora}-${activeProfessional?.id || "self"}`;
                const client = getAgendaEntityName(slot.cliente);
                const service = getAgendaEntityName(slot.servico);
                const isUpdating = updating === key;
                const statusLabel = isUpdating
                  ? slot.status === "livre" ? "Bloqueando..." : "Liberando..."
                  : getStatusLabel(slot.status);

                return (
                  <button
                    aria-busy={isUpdating || undefined}
                    className={`slot-card slot-${slot.status}${isUpdating ? " is-updating" : ""}`}
                    disabled={isUpdating || !["livre", "bloqueado"].includes(slot.status)}
                    key={`${slot.hora}-${slot.agendamento_id || ""}`}
                    onClick={() => toggleSlot(slot)}
                    type="button"
                  >
                    <strong>{String(slot.hora).slice(0, 5)}</strong>
                    <span className="slot-status">
                      {slot.status === "bloqueado" && !isUpdating && <LockIcon />}
                      <span>{statusLabel}</span>
                    </span>
                    {(client || service) && <small>{client || "Cliente"} · {service || "Serviço"}</small>}
                  </button>
                );
              })}
            </section>
          )}
        </>
      )}
    </main>
  );
}
