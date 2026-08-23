import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import { ConfirmationIcon } from "../components/ConfirmationIcon";
import { ErrorState, LoadingState } from "../components/ScreenState";

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DURATION_OPTIONS = [30, 45, 60, 90, 120];
const INTERVAL_OPTIONS = [0, 5, 10, 15, 30];
const LEAD_TIME_OPTIONS = [0, 1, 2, 4, 12, 24, 48, 72];

function normalizeDay(day) {
  return {
    diaSemana: Number(day.dia_semana ?? day.diaSemana),
    trabalha: Boolean(day.trabalha),
    horaInicio: day.hora_inicio ?? day.horaInicio ?? "08:00",
    horaFim: day.hora_fim ?? day.horaFim ?? "18:00",
    intervaloInicio: day.intervalo_inicio ?? day.intervaloInicio ?? "",
    intervaloFim: day.intervalo_fim ?? day.intervaloFim ?? ""
  };
}

function withCurrentOption(options, currentValue) {
  const value = Number(currentValue);
  return [...new Set([...options, value])]
    .filter((item) => Number.isFinite(item))
    .sort((a, b) => a - b);
}

function formatLeadTime(value) {
  const hours = Number(value) || 0;
  if (hours === 0) return "Sem antecedência";
  if (hours === 1) return "1 hora";
  if (hours === 24) return "1 dia";
  if (hours > 24 && hours % 24 === 0) return `${hours / 24} dias`;
  return `${hours} horas`;
}

export function validateSchedule(days) {
  for (const day of days) {
    if (!day.trabalha) continue;

    const dayName = DAY_NAMES[day.diaSemana] || "Dia selecionado";
    if (!day.horaInicio || !day.horaFim || day.horaInicio >= day.horaFim) {
      return `Em ${dayName}, o horário final precisa ser depois do horário inicial.`;
    }

    const hasPauseStart = Boolean(day.intervaloInicio);
    const hasPauseEnd = Boolean(day.intervaloFim);
    if (hasPauseStart !== hasPauseEnd) {
      return `Em ${dayName}, preencha o início e o fim da pausa.`;
    }

    if (hasPauseStart && (
      day.intervaloInicio >= day.intervaloFim
      || day.intervaloInicio < day.horaInicio
      || day.intervaloFim > day.horaFim
    )) {
      return `Em ${dayName}, a pausa precisa estar dentro do horário de atendimento.`;
    }
  }

  return "";
}

export function ScheduleSettingsPage() {
  const [config, setConfig] = useState(null);
  const [days, setDays] = useState([]);
  const [expandedPauses, setExpandedPauses] = useState(() => new Set());
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setError("");
    apiRequest("/agenda-configuracao")
      .then((result) => {
        const current = result.configuracao || {};
        const normalizedDays = (result.horarios || [])
          .map(normalizeDay)
          .sort((a, b) => a.diaSemana - b.diaSemana);

        setConfig({
          duracaoPadrao: current.duracao_padrao ?? current.duracaoPadrao ?? 60,
          intervaloMinutos: current.intervalo_minutos ?? current.intervaloMinutos ?? 0,
          antecedenciaAgendamento: current.antecedencia_agendamento ?? current.antecedenciaAgendamento ?? 0,
          antecedenciaCancelamento: current.antecedencia_cancelamento ?? current.antecedenciaCancelamento ?? 24
        });
        setDays(normalizedDays);
        setExpandedPauses(new Set(
          normalizedDays
            .filter((day) => day.intervaloInicio || day.intervaloFim)
            .map((day) => day.diaSemana)
        ));
      })
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    if (!message) return undefined;
    const timeout = window.setTimeout(() => setMessage(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const leadTimeBookingOptions = useMemo(
    () => withCurrentOption(LEAD_TIME_OPTIONS, config?.antecedenciaAgendamento),
    [config?.antecedenciaAgendamento]
  );
  const leadTimeCancellationOptions = useMemo(
    () => withCurrentOption(LEAD_TIME_OPTIONS, config?.antecedenciaCancelamento),
    [config?.antecedenciaCancelamento]
  );

  function updateDay(index, field, value) {
    setDays((current) => current.map((day, itemIndex) => itemIndex === index ? { ...day, [field]: value } : day));
  }

  function toggleDay(index, works) {
    setDays((current) => current.map((day, itemIndex) => {
      if (itemIndex !== index) return day;
      if (!works) return { ...day, trabalha: false };
      return {
        ...day,
        trabalha: true,
        horaInicio: day.horaInicio || "08:00",
        horaFim: day.horaFim || "18:00"
      };
    }));
  }

  function setPauseMode(day, index, enabled) {
    setExpandedPauses((current) => {
      const next = new Set(current);
      if (enabled) next.add(day.diaSemana);
      else next.delete(day.diaSemana);
      return next;
    });

    if (!enabled) {
      setDays((current) => current.map((item, itemIndex) => itemIndex === index
        ? { ...item, intervaloInicio: "", intervaloFim: "" }
        : item));
    }
  }

  function copyDayToActiveDays(index) {
    const source = days[index];
    if (!source?.trabalha) return;

    setDays((current) => current.map((day) => day.trabalha
      ? {
          ...day,
          horaInicio: source.horaInicio,
          horaFim: source.horaFim,
          intervaloInicio: source.intervaloInicio,
          intervaloFim: source.intervaloFim
        }
      : day));

    setExpandedPauses((current) => {
      const next = new Set(current);
      for (const day of days) {
        if (!day.trabalha) continue;
        if (source.intervaloInicio || source.intervaloFim) next.add(day.diaSemana);
        else next.delete(day.diaSemana);
      }
      return next;
    });

    setMessage("Horário copiado para os dias ativos.");
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    const validationError = validateSchedule(days);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      const result = await apiRequest("/agenda-configuracao", {
        method: "PUT",
        body: { ...config, horarios: days }
      });
      setMessage(result.mensagem || "Horários atualizados.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  if (!config && !error) return <div className="workspace-page"><LoadingState>Carregando horários...</LoadingState></div>;
  if (!config && error) return <div className="workspace-page"><ErrorState message={error} onRetry={load} /></div>;

  return (
    <main className="workspace-page schedule-settings-page">
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">Disponibilidade</p>
          <h1>Horários de atendimento</h1>
          <p>A cliente verá apenas horários que realmente podem ser agendados.</p>
        </div>
      </header>
      <form className="panel stack-form schedule-settings-form" onSubmit={submit}>
        <section className="settings-grid schedule-general-settings" aria-label="Configurações gerais da agenda">
          <label>
            Duração padrão
            <select onChange={(e) => setConfig({ ...config, duracaoPadrao: Number(e.target.value) })} value={config.duracaoPadrao}>
              {withCurrentOption(DURATION_OPTIONS, config.duracaoPadrao).map((value) => <option key={value} value={value}>{value} minutos</option>)}
            </select>
          </label>
          <label>
            Intervalo entre clientes
            <select onChange={(e) => setConfig({ ...config, intervaloMinutos: Number(e.target.value) })} value={config.intervaloMinutos}>
              {withCurrentOption(INTERVAL_OPTIONS, config.intervaloMinutos).map((value) => (
                <option key={value} value={value}>{value === 0 ? "Sem intervalo" : `${value} minutos`}</option>
              ))}
            </select>
          </label>
          <label>
            Antecedência mínima para agendar
            <select onChange={(e) => setConfig({ ...config, antecedenciaAgendamento: Number(e.target.value) })} value={config.antecedenciaAgendamento}>
              {leadTimeBookingOptions.map((value) => <option key={value} value={value}>{formatLeadTime(value)}</option>)}
            </select>
          </label>
          <label>
            Antecedência mínima para cancelar
            <select onChange={(e) => setConfig({ ...config, antecedenciaCancelamento: Number(e.target.value) })} value={config.antecedenciaCancelamento}>
              {leadTimeCancellationOptions.map((value) => <option key={value} value={value}>{formatLeadTime(value)}</option>)}
            </select>
          </label>
        </section>

        <section className="schedule-week-section" aria-labelledby="schedule-week-title">
          <div className="schedule-week-heading">
            <div>
              <p className="eyebrow">Semana de atendimento</p>
              <h2 id="schedule-week-title">Quando você recebe clientes</h2>
              <p className="muted">Ative os dias de trabalho e ajuste atendimento e pausa.</p>
            </div>
          </div>

          <div className="schedule-list" aria-label="Semana">
            {days.map((day, index) => {
              const pauseExpanded = expandedPauses.has(day.diaSemana);
              return (
                <article className={day.trabalha ? "schedule-row" : "schedule-row disabled"} key={day.diaSemana}>
                  <label className="day-toggle">
                    <input checked={day.trabalha} onChange={(e) => toggleDay(index, e.target.checked)} type="checkbox" />
                    <span>
                      <strong>{DAY_NAMES[day.diaSemana]}</strong>
                      <small>{day.trabalha ? "Aberto" : "Fechado"}</small>
                    </span>
                  </label>

                  {day.trabalha ? (
                    <div className="schedule-day-content">
                      <div className="schedule-field-group">
                        <span className="schedule-field-label">Atendimento</span>
                        <div className="schedule-time-range">
                          <input
                            aria-label={`Início do atendimento de ${DAY_NAMES[day.diaSemana]}`}
                            onChange={(e) => updateDay(index, "horaInicio", e.target.value)}
                            type="time"
                            value={day.horaInicio}
                          />
                          <span aria-hidden="true">→</span>
                          <input
                            aria-label={`Fim do atendimento de ${DAY_NAMES[day.diaSemana]}`}
                            onChange={(e) => updateDay(index, "horaFim", e.target.value)}
                            type="time"
                            value={day.horaFim}
                          />
                        </div>
                      </div>

                      <div className="schedule-field-group schedule-pause-group">
                        <label className="schedule-pause-mode">
                          <span className="schedule-field-label">Pausa</span>
                          <select
                            aria-label={`Pausa de ${DAY_NAMES[day.diaSemana]}`}
                            onChange={(e) => setPauseMode(day, index, e.target.value === "custom")}
                            value={pauseExpanded ? "custom" : "none"}
                          >
                            <option value="none">Sem pausa</option>
                            <option value="custom">Definir pausa</option>
                          </select>
                        </label>
                        {pauseExpanded && (
                          <div className="schedule-time-range schedule-pause-times">
                            <input
                              aria-label={`Início da pausa de ${DAY_NAMES[day.diaSemana]}`}
                              onChange={(e) => updateDay(index, "intervaloInicio", e.target.value)}
                              type="time"
                              value={day.intervaloInicio}
                            />
                            <span aria-hidden="true">→</span>
                            <input
                              aria-label={`Fim da pausa de ${DAY_NAMES[day.diaSemana]}`}
                              onChange={(e) => updateDay(index, "intervaloFim", e.target.value)}
                              type="time"
                              value={day.intervaloFim}
                            />
                          </div>
                        )}
                      </div>

                      <button
                        className="text-button schedule-copy-button"
                        onClick={() => copyDayToActiveDays(index)}
                        type="button"
                      >
                        Copiar para dias ativos
                      </button>
                    </div>
                  ) : (
                    <div className="schedule-closed-state">
                      <strong>Fechado</strong>
                      <span>Este dia não será oferecido para agendamento.</span>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {error && <p className="form-error schedule-settings-error" role="alert">{error}</p>}
        <div className="form-actions schedule-save-bar">
          <div className="schedule-save-feedback" aria-live="polite">
            {message && (
              <span className="schedule-save-status" role="status">
                <ConfirmationIcon className="schedule-save-icon" />
                {message}
              </span>
            )}
          </div>
          <button className="button" disabled={saving} type="submit">{saving ? "Salvando..." : "Salvar horários"}</button>
        </div>
      </form>
    </main>
  );
}
