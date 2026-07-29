import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { ErrorState, LoadingState } from "../components/ScreenState";

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

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

export function ScheduleSettingsPage() {
  const [config, setConfig] = useState(null);
  const [days, setDays] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setError("");
    apiRequest("/agenda-configuracao")
      .then((result) => {
        const current = result.configuracao || {};
        setConfig({
          duracaoPadrao: current.duracao_padrao ?? current.duracaoPadrao ?? 60,
          intervaloMinutos: current.intervalo_minutos ?? current.intervaloMinutos ?? 0,
          antecedenciaAgendamento: current.antecedencia_agendamento ?? current.antecedenciaAgendamento ?? 0,
          antecedenciaCancelamento: current.antecedencia_cancelamento ?? current.antecedenciaCancelamento ?? 24
        });
        setDays((result.horarios || []).map(normalizeDay).sort((a, b) => a.diaSemana - b.diaSemana));
      })
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(load, [load]);

  function updateDay(index, field, value) {
    setDays((current) => current.map((day, itemIndex) => itemIndex === index ? { ...day, [field]: value } : day));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
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
    <main className="workspace-page">
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">Disponibilidade</p>
          <h1>Horários de atendimento</h1>
          <p>A cliente verá apenas horários que realmente podem ser agendados.</p>
        </div>
      </header>
      <form className="panel stack-form" onSubmit={submit}>
        <section className="settings-grid">
          <label>
            Duração padrão
            <select onChange={(e) => setConfig({ ...config, duracaoPadrao: Number(e.target.value) })} value={config.duracaoPadrao}>
              {[30, 45, 60, 90, 120].map((value) => <option key={value} value={value}>{value} minutos</option>)}
            </select>
          </label>
          <label>
            Intervalo entre clientes
            <select onChange={(e) => setConfig({ ...config, intervaloMinutos: Number(e.target.value) })} value={config.intervaloMinutos}>
              {[0, 5, 10, 15, 30].map((value) => <option key={value} value={value}>{value} minutos</option>)}
            </select>
          </label>
          <label>
            Antecedência para agendar
            <input min="0" onChange={(e) => setConfig({ ...config, antecedenciaAgendamento: Number(e.target.value) })} type="number" value={config.antecedenciaAgendamento} />
          </label>
          <label>
            Antecedência para cancelar
            <input min="0" onChange={(e) => setConfig({ ...config, antecedenciaCancelamento: Number(e.target.value) })} type="number" value={config.antecedenciaCancelamento} />
          </label>
        </section>
        <section className="schedule-list" aria-label="Semana">
          {days.map((day, index) => (
            <article className={day.trabalha ? "schedule-row" : "schedule-row disabled"} key={day.diaSemana}>
              <label className="day-toggle">
                <input checked={day.trabalha} onChange={(e) => updateDay(index, "trabalha", e.target.checked)} type="checkbox" />
                <strong>{DAY_NAMES[day.diaSemana]}</strong>
              </label>
              {day.trabalha ? (
                <div className="schedule-times">
                  <label>Das <input onChange={(e) => updateDay(index, "horaInicio", e.target.value)} type="time" value={day.horaInicio} /></label>
                  <label>às <input onChange={(e) => updateDay(index, "horaFim", e.target.value)} type="time" value={day.horaFim} /></label>
                  <label>Pausa <input onChange={(e) => updateDay(index, "intervaloInicio", e.target.value)} type="time" value={day.intervaloInicio} /></label>
                  <label>até <input onChange={(e) => updateDay(index, "intervaloFim", e.target.value)} type="time" value={day.intervaloFim} /></label>
                </div>
              ) : <span className="muted">Folga</span>}
            </article>
          ))}
        </section>
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-success" role="status">{message}</p>}
        <div className="form-actions"><button className="button" disabled={saving} type="submit">{saving ? "Salvando..." : "Salvar horários"}</button></div>
      </form>
    </main>
  );
}
