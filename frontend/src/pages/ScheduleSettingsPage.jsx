import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { track } from "../analytics/track";
import { apiRequest } from "../api/client";
import { ConfirmationIcon } from "../components/ConfirmationIcon";
import { PublicShareButton } from "../components/PublicShareButton";
import { ErrorState, LoadingState } from "../components/ScreenState";

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DAY_SHORT_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DURATION_OPTIONS = [30, 45, 60, 90, 120];
const INTERVAL_OPTIONS = [0, 5, 10, 15, 30];
const LEAD_TIME_OPTIONS = [0, 1, 2, 4, 12, 24, 48, 72];

function CopyIcon({ className = "" }) {
  return (
    <svg aria-hidden="true" className={className} focusable="false" viewBox="0 0 24 24">
      <rect fill="none" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" width="12" x="8" y="8" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

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

function scheduleSignature(day) {
  return [
    day.horaInicio || "",
    day.horaFim || "",
    day.intervaloInicio || "",
    day.intervaloFim || ""
  ].join("|");
}

export function summarizeSchedule(days) {
  const groups = new Map();

  for (const day of days.filter((item) => item.trabalha)) {
    const signature = scheduleSignature(day);
    const current = groups.get(signature) || [];
    current.push(day);
    groups.set(signature, current);
  }

  return Array.from(groups.values()).map((group) => {
    const sample = group[0];
    const pause = sample.intervaloInicio && sample.intervaloFim
      ? `${sample.intervaloInicio}–${sample.intervaloFim}`
      : null;

    return {
      key: scheduleSignature(sample),
      days: group.map((day) => DAY_SHORT_NAMES[day.diaSemana]).join(", "),
      attendance: `${sample.horaInicio}–${sample.horaFim}`,
      pause
    };
  });
}

export function validateSchedule(days, { requireActiveDay = false } = {}) {
  if (requireActiveDay && !days.some((day) => day.trabalha)) {
    return "Escolha pelo menos um dia de atendimento antes de confirmar a agenda.";
  }

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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [firstScheduleMode, setFirstScheduleMode] = useState("quick");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [activationNextStep, setActivationNextStep] = useState(false);
  const [businessContext, setBusinessContext] = useState(null);
  const [businessContextLoading, setBusinessContextLoading] = useState(false);

  const load = useCallback(() => {
    setError("");
    apiRequest("/agenda-configuracao")
      .then((result) => {
        const current = result.configuracao || {};
        const normalizedDays = (result.horarios || [])
          .map(normalizeDay)
          .sort((a, b) => a.diaSemana - b.diaSemana);
        const configuredAt = current.configurado_em ?? current.configuradoEm ?? null;

        setConfig({
          duracaoPadrao: current.duracao_padrao ?? current.duracaoPadrao ?? 60,
          intervaloMinutos: current.intervalo_minutos ?? current.intervaloMinutos ?? 0,
          antecedenciaAgendamento: current.antecedencia_agendamento ?? current.antecedenciaAgendamento ?? 0,
          antecedenciaCancelamento: current.antecedencia_cancelamento ?? current.antecedenciaCancelamento ?? 24,
          configuradoEm: configuredAt
        });
        setAdvancedOpen(Boolean(configuredAt));
        setFirstScheduleMode(configuredAt ? "editor" : "quick");
        setDays(normalizedDays);
        setExpandedPauses(new Set(
          normalizedDays
            .filter((day) => day.intervaloInicio || day.intervaloFim)
            .map((day) => day.diaSemana)
        ));

        track("agenda_configuracao_visualizada", {
          page: "configuracao_agenda",
          mission: "disponibilizar_horarios",
          properties: {
            status: configuredAt
              ? "configurada"
              : "pendente",
            origem: configuredAt
              ? "editor"
              : "confirmacao_rapida"
          }
        });
      })
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    if (!message || activationNextStep) return undefined;
    const timeout = window.setTimeout(() => setMessage(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [activationNextStep, message]);

  const leadTimeBookingOptions = useMemo(
    () => withCurrentOption(LEAD_TIME_OPTIONS, config?.antecedenciaAgendamento),
    [config?.antecedenciaAgendamento]
  );
  const leadTimeCancellationOptions = useMemo(
    () => withCurrentOption(LEAD_TIME_OPTIONS, config?.antecedenciaCancelamento),
    [config?.antecedenciaCancelamento]
  );
  const quickSummary = useMemo(() => summarizeSchedule(days), [days]);

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

  function openFirstScheduleEditor() {
    setError("");
    setMessage("");
    setFirstScheduleMode("editor");

    track("agenda_configuracao_visualizada", {
      page: "configuracao_agenda",
      mission: "disponibilizar_horarios",
      properties: {
        status: "editor_aberto",
        origem: "ajuste_manual"
      }
    });
  }

  async function loadBusinessContext() {
    setBusinessContextLoading(true);

    try {
      const result = await apiRequest("/configuracoes");
      const business = result.negocio || result.configuracoes || {};

      if (!business.slug) {
        setBusinessContext(null);
        return;
      }

      setBusinessContext({
        id: business.id ?? business.negocio_id,
        name: business.nome ?? business.nome_negocio ?? "Seu negócio",
        slug: business.slug
      });
    } catch {
      setBusinessContext(null);
    } finally {
      setBusinessContextLoading(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const primeiraConfiguracao = !config?.configuradoEm;
    const submitSource = event.nativeEvent?.submitter?.dataset?.source;
    const origem = primeiraConfiguracao
      ? submitSource === "confirmacao_rapida"
        ? "confirmacao_rapida"
        : "ajuste_manual"
      : "editor";

    track("agenda_configuracao_salvamento_tentado", {
      page: "configuracao_agenda",
      mission: "disponibilizar_horarios",
      properties: {
        status: primeiraConfiguracao
          ? "primeira_configuracao"
          : "edicao",
        origem
      }
    });

    const validationError = validateSchedule(days, {
      requireActiveDay: primeiraConfiguracao
    });
    if (validationError) {
      setError(validationError);
      track("agenda_configuracao_erro", {
        page: "configuracao_agenda",
        mission: "disponibilizar_horarios",
        properties: {
          status: "validacao_cliente",
          origem
        }
      });
      return;
    }

    setSaving(true);
    try {
      const result = await apiRequest("/agenda-configuracao", {
        method: "PUT",
        body: { ...config, horarios: days }
      });
      const savedConfig = result.configuracao || {};
      const configuradoEm = savedConfig.configurado_em
        ?? savedConfig.configuradoEm
        ?? config.configuradoEm
        ?? null;

      setConfig((current) => ({
        ...current,
        configuradoEm
      }));
      setMessage(result.mensagem || "Horários atualizados.");

      if (primeiraConfiguracao && configuradoEm) {
        track("agenda_configurada", {
          page: "configuracao_agenda",
          mission: "disponibilizar_horarios",
          properties: {
            status: "sucesso",
            origem
          }
        });
        const publicadoAgora = result.publicacao?.publicado === true;

        setActivationNextStep(publicadoAgora);
        if (publicadoAgora) {
          void loadBusinessContext();
        }
      }
    } catch (requestError) {
      setError(requestError.message);
      track("agenda_configuracao_erro", {
        page: "configuracao_agenda",
        mission: "disponibilizar_horarios",
        properties: {
          status: "erro_api",
          origem
        }
      });
    } finally {
      setSaving(false);
    }
  }

  if (!config && !error) return <div className="workspace-page"><LoadingState>Carregando horários...</LoadingState></div>;
  if (!config && error) return <div className="workspace-page"><ErrorState message={error} onRetry={load} /></div>;

  const firstConfiguration = !config.configuradoEm;
  const quickConfirmation = firstConfiguration && firstScheduleMode === "quick";

  return (
    <main className="workspace-page schedule-settings-page">
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">Disponibilidade</p>
          <h1>Horários de atendimento</h1>
          <p>A cliente verá apenas horários que realmente podem ser agendados.</p>
        </div>
      </header>

      {activationNextStep ? (
        <section
          aria-labelledby="schedule-next-step-title"
          aria-live="polite"
          className="panel onboarding-panel is-complete schedule-publish-panel"
        >
          <div className="onboarding-complete-copy">
            <p className="eyebrow onboarding-complete-eyebrow">
              <ConfirmationIcon className="onboarding-complete-icon" />
              <span>Negócio publicado <span aria-hidden="true">✨</span></span>
            </p>
            <h2 id="schedule-next-step-title">Agora divulgue seu perfil</h2>
            <p className="schedule-publish-status">
              <ConfirmationIcon className="schedule-save-icon" />
              <span>{message || "Horários confirmados. Seu negócio está publicado."}</span>
            </p>
            <p className="muted">
              Sua próxima ação é levar este link para as clientes. Compartilhe no
              WhatsApp ou copie para usar no Instagram e conduza as pessoas direto
              aos seus serviços e horários disponíveis.
            </p>
          </div>

          <div className="onboarding-complete-actions schedule-publish-actions">
            {businessContextLoading && (
              <span className="muted" role="status">Preparando seu link...</span>
            )}

            {!businessContextLoading && businessContext && (
              <>
                <PublicShareButton
                  businessId={businessContext.id}
                  businessName={businessContext.name}
                  businessSlug={businessContext.slug}
                  className="button"
                  label="Compartilhar perfil"
                  trackingMission="disponibilizar_horarios"
                  trackingPage="configuracao_agenda"
                />
                <PublicShareButton
                  businessId={businessContext.id}
                  businessName={businessContext.name}
                  businessSlug={businessContext.slug}
                  className="button button-secondary"
                  label="Copiar link"
                  mode="copy"
                  trackingMission="disponibilizar_horarios"
                  trackingPage="configuracao_agenda"
                />
                <Link
                  className="text-button"
                  to={`/negocio/${encodeURIComponent(businessContext.slug)}`}
                >
                  Ver perfil público <span aria-hidden="true">↗</span>
                </Link>
              </>
            )}

            {!businessContextLoading && !businessContext && (
              <Link className="button" to="/painel">
                Ir para o painel
              </Link>
            )}
          </div>
        </section>
      ) : (
        <form className="panel stack-form schedule-settings-form" onSubmit={submit}>
          {quickConfirmation ? (
            <section
              aria-labelledby="schedule-activation-title"
              className="schedule-quick-confirmation"
            >
              <div className="schedule-quick-copy">
                <p className="eyebrow">
                  <span aria-hidden="true">📅</span>{" "}
                  Último passo para publicar
                </p>
                <h2 id="schedule-activation-title">Confirme quando você atende</h2>
                <p className="muted">
                  O Agenda Fashion preparou uma sugestão de horários. Confira abaixo:
                  se estiver certo, confirme uma vez e seu perfil poderá ser publicado
                  automaticamente.
                </p>
              </div>

              {quickSummary.length > 0 ? (
                <ul className="schedule-quick-summary" aria-label="Horários sugeridos">
                  {quickSummary.map((group) => (
                    <li key={group.key}>
                      <strong>{group.days}</strong>
                      <span>{group.attendance}</span>
                      <small>{group.pause ? `Pausa ${group.pause}` : "Sem pausa"}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="schedule-quick-empty">
                  Nenhum dia está ativo ainda. Ajuste seus horários para continuar.
                </p>
              )}

              <p className="schedule-quick-assurance">
                <span aria-hidden="true">✓</span>{" "}
                Nada fica disponível para clientes antes da sua confirmação.
              </p>

              {error && <p className="form-error schedule-settings-error" role="alert">{error}</p>}

              <div className="schedule-quick-actions">
                {quickSummary.length > 0 && (
                  <button
                    className="button"
                    data-source="confirmacao_rapida"
                    disabled={saving}
                    type="submit"
                  >
                    {saving ? "Confirmando..." : "Confirmar horários e publicar"}
                  </button>
                )}
                <button
                  className="button button-secondary"
                  onClick={openFirstScheduleEditor}
                  type="button"
                >
                  Ajustar horários
                </button>
              </div>
            </section>
          ) : (
            <>
              {firstConfiguration && (
                <section className="schedule-editor-intro" aria-labelledby="schedule-editor-title">
                  <p className="eyebrow">
                    <span aria-hidden="true">📅</span>{" "}
                    Ajuste sua disponibilidade
                  </p>
                  <h2 id="schedule-editor-title">Quando você recebe clientes</h2>
                  <p className="muted">
                    Ative os dias em que atende e ajuste início, fim e pausas. Ao
                    salvar pela primeira vez, o AF confirma sua agenda e recalcula a
                    publicação automaticamente.
                  </p>
                </section>
              )}

              <section className="schedule-week-section" aria-labelledby="schedule-week-title">
                <div className="schedule-week-heading">
                  <div>
                    <p className="eyebrow">Semana de atendimento</p>
                    <h2 id="schedule-week-title">Quando você recebe clientes</h2>
                    <p className="muted">Ative os dias de trabalho e ajuste atendimento e pausa.</p>
                  </div>
                </div>

                <div className="schedule-list" aria-label="Semana">
                  <div className="schedule-column-headings" aria-hidden="true">
                    <span>Dia</span>
                    <span>Atendimento</span>
                    <span>Pausa</span>
                    <span>Ação</span>
                  </div>
                  {days.map((day, index) => {
                    const pauseExpanded = expandedPauses.has(day.diaSemana);
                    const dayName = DAY_NAMES[day.diaSemana];
                    return (
                      <article className={day.trabalha ? "schedule-row" : "schedule-row disabled"} key={day.diaSemana}>
                        <label className="day-toggle">
                          <input checked={day.trabalha} onChange={(e) => toggleDay(index, e.target.checked)} type="checkbox" />
                          <span className="schedule-day-name">
                            <strong>{dayName}</strong>
                            <small>{day.trabalha ? "Aberto" : "Fechado"}</small>
                          </span>
                        </label>

                        {day.trabalha ? (
                          <>
                            <div className="schedule-field-group schedule-attendance-group">
                              <span className="schedule-mobile-label">Atendimento</span>
                              <div className="schedule-time-range">
                                <input
                                  aria-label={`Início do atendimento de ${dayName}`}
                                  onChange={(e) => updateDay(index, "horaInicio", e.target.value)}
                                  type="time"
                                  value={day.horaInicio}
                                />
                                <span aria-hidden="true">→</span>
                                <input
                                  aria-label={`Fim do atendimento de ${dayName}`}
                                  onChange={(e) => updateDay(index, "horaFim", e.target.value)}
                                  type="time"
                                  value={day.horaFim}
                                />
                              </div>
                            </div>

                            <div className="schedule-field-group schedule-pause-group">
                              <span className="schedule-mobile-label">Pausa</span>
                              <select
                                aria-label={`Pausa de ${dayName}`}
                                className="schedule-pause-select"
                                onChange={(e) => setPauseMode(day, index, e.target.value === "custom")}
                                value={pauseExpanded ? "custom" : "none"}
                              >
                                <option value="none">Sem pausa</option>
                                <option value="custom">Definir pausa</option>
                              </select>
                              {pauseExpanded && (
                                <div className="schedule-time-range schedule-pause-times">
                                  <input
                                    aria-label={`Início da pausa de ${dayName}`}
                                    onChange={(e) => updateDay(index, "intervaloInicio", e.target.value)}
                                    type="time"
                                    value={day.intervaloInicio}
                                  />
                                  <span aria-hidden="true">→</span>
                                  <input
                                    aria-label={`Fim da pausa de ${dayName}`}
                                    onChange={(e) => updateDay(index, "intervaloFim", e.target.value)}
                                    type="time"
                                    value={day.intervaloFim}
                                  />
                                </div>
                              )}
                            </div>

                            <button
                              aria-label={`Copiar horário de ${dayName} para os dias ativos`}
                              className="text-button schedule-copy-button"
                              onClick={() => copyDayToActiveDays(index)}
                              title="Copiar este horário para os dias ativos"
                              type="button"
                            >
                              <CopyIcon className="schedule-copy-icon" />
                              <span>Copiar</span>
                            </button>
                          </>
                        ) : (
                          <div className="schedule-closed-state">
                            <span>Este dia não será oferecido para agendamento.</span>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>

              <details
                className="schedule-advanced-settings"
                onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
                open={advancedOpen}
              >
                <summary>
                  <span aria-hidden="true">⚙️</span>{" "}
                  Ajustes avançados
                </summary>
                <p className="muted">
                  Personalize duração padrão, intervalo entre clientes e antecedências. Você pode voltar a estes ajustes quando quiser.
                </p>
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
                    Antecedência para agendar
                    <select onChange={(e) => setConfig({ ...config, antecedenciaAgendamento: Number(e.target.value) })} value={config.antecedenciaAgendamento}>
                      {leadTimeBookingOptions.map((value) => <option key={value} value={value}>{formatLeadTime(value)}</option>)}
                    </select>
                  </label>
                  <label>
                    Antecedência para cancelar
                    <select onChange={(e) => setConfig({ ...config, antecedenciaCancelamento: Number(e.target.value) })} value={config.antecedenciaCancelamento}>
                      {leadTimeCancellationOptions.map((value) => <option key={value} value={value}>{formatLeadTime(value)}</option>)}
                    </select>
                  </label>
                </section>
              </details>

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
                <button
                  className="button"
                  data-source={firstConfiguration ? "ajuste_manual" : "editor"}
                  disabled={saving}
                  type="submit"
                >
                  {saving
                    ? "Salvando..."
                    : firstConfiguration
                      ? "Salvar horários e publicar"
                      : "Salvar horários"}
                </button>
              </div>
            </>
          )}
        </form>
      )}
    </main>
  );
}
