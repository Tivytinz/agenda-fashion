import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api/client";
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

export function AgendaWorkspacePage({ owner = false }) {
  const [data, setData] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedProfessional, setSelectedProfessional] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [updating, setUpdating] = useState("");

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

  const dates = getValidAgendaDays(data?.agenda);
  const activeDay = dates.find((day) => day.data === selectedDate) || dates[0];
  const professionals = owner ? getValidProfessionals(activeDay?.profissionais) : [];
  const activeProfessional = owner
    ? professionals.find((item) => String(item.id) === selectedProfessional) || professionals[0]
    : null;
  const slots = getValidSlots(owner ? activeProfessional?.horarios : activeDay?.horarios);

  function selectDate(day) {
    setSelectedDate(day.data);
    setMessage("");
    if (owner) {
      const firstProfessional = getValidProfessionals(day.profissionais)[0];
      setSelectedProfessional(String(firstProfessional?.id || ""));
    }
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
    <main className="workspace-page">
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
          <section className="agenda-toolbar panel">
            <div className="date-switcher" aria-label="Escolha uma data">
              {dates.map((day) => (
                <button aria-pressed={selectedDate === day.data} className={selectedDate === day.data ? "active" : ""} key={day.data} onClick={() => selectDate(day)} type="button">
                  {formatDate(day.data)}
                </button>
              ))}
            </div>
            {owner && (
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
          {message && <p className="form-success" role="status">{message}</p>}

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
                return (
                  <button
                    className={`slot-card slot-${slot.status}`}
                    disabled={updating === key || !["livre", "bloqueado"].includes(slot.status)}
                    key={`${slot.hora}-${slot.agendamento_id || ""}`}
                    onClick={() => toggleSlot(slot)}
                    type="button"
                  >
                    <strong>{String(slot.hora).slice(0, 5)}</strong>
                    <span>{getStatusLabel(slot.status)}</span>
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
