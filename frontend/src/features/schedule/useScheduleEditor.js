import { scheduleActivationContext } from "./activation";
import { LEAD_TIME_OPTIONS, normalizeDay, withCurrentOption, serializeSchedule, validateSchedule } from "./form";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { track } from "../../analytics/track";
import { apiRequest } from "../../api/client";

// Coordena estado, operações e recuperação; a página mantém a apresentação.
export function useScheduleEditor({ contextoAgenda, targetProfessionalId }) {
  const location = useLocation();
  const navigate = useNavigate();
  const professionalContext = contextoAgenda === "profissional";
  const ownerTeamSchedule =
    !professionalContext &&
    Boolean(targetProfessionalId);
  const [config, setConfig] = useState(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const contextActiveRef = useRef(true);
  const operationGenerationRef = useRef(0);
  const activationControllerRef = useRef(null);
  const [days, setDays] = useState([]);
  const [savedSchedule, setSavedSchedule] = useState("");
  const [expandedPauses, setExpandedPauses] = useState(() => new Set());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const setupSessionRef = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [activationNextStep, setActivationNextStep] = useState(false);
  const [businessContext, setBusinessContext] = useState(null);
  const [businessContextLoading, setBusinessContextLoading] = useState(false);
  const [scheduleProfessional, setScheduleProfessional] = useState(null);
  const [availabilityPending, setAvailabilityPending] = useState(false);
  const [availabilityGuidance, setAvailabilityGuidance] = useState(null);
  const shareOnboardingRequested = useMemo(
    () => new URLSearchParams(location.search).get("onboarding") === "divulgacao",
    [location.search]
  );
  const hasChanges = Boolean(config && savedSchedule)
    && serializeSchedule(config, days) !== savedSchedule;
  const showActivationNextStep =
    activationNextStep && shareOnboardingRequested && !hasChanges;

  function discardPendingOperations() {
    // O descarte antecede a navegação; não depende do unmount sob Suspense.
    operationGenerationRef.current += 1;
    activationControllerRef.current?.abort();
    setBusinessContextLoading(false);
    setSaving(false);
  }

  useEffect(() => {
    contextActiveRef.current = true;
    return () => {
      contextActiveRef.current = false;
      activationControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!shareOnboardingRequested) {
      if (activationNextStep) setActivationNextStep(false);
      if (availabilityPending) setAvailabilityPending(false);
    }
  }, [activationNextStep, availabilityPending, shareOnboardingRequested]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setConfig(null);
    setError("");

    const path = ownerTeamSchedule
      ? `/agenda-configuracao?profissionalId=${encodeURIComponent(targetProfessionalId)}`
      : "/agenda-configuracao";

    apiRequest(path, {
      signal: controller.signal,
      headers: {
        "X-AF-Contexto": contextoAgenda
      }
    })
      .then((result) => {
        if (!active) return;
        const current = result.configuracao || {};
        const normalizedDays = (result.horarios || [])
          .map(normalizeDay)
          .sort((a, b) => ((a.diaSemana + 6) % 7) - ((b.diaSemana + 6) % 7));
        const configuredAt = current.configurado_em ?? current.configuradoEm ?? null;
        const scheduleOrigin = current.origem_horarios ?? current.origemHorarios ?? "padrao_af";
        const personalized = scheduleOrigin === "personalizado";

        setScheduleProfessional(
          result.profissional || null
        );
        const loadedConfig = {
          duracaoPadrao: current.duracao_padrao ?? current.duracaoPadrao ?? 60,
          intervaloMinutos: current.intervalo_minutos ?? current.intervaloMinutos ?? 0,
          antecedenciaAgendamento: current.antecedencia_agendamento ?? current.antecedenciaAgendamento ?? 0,
          antecedenciaCancelamento: current.antecedencia_cancelamento ?? current.antecedenciaCancelamento ?? 2,
          configuradoEm: configuredAt,
          origemHorarios: scheduleOrigin
        };
        setupSessionRef.current = !professionalContext && !ownerTeamSchedule && !personalized;
        setConfig(loadedConfig);
        setSavedSchedule(serializeSchedule(loadedConfig, normalizedDays));
        setAdvancedOpen(personalized);
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
            status: personalized
              ? "configurada"
              : "pendente",
            origem: personalized
              ? "editor"
              : "ajuste_manual"
          }
        });
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    contextoAgenda,
    loadAttempt,
    ownerTeamSchedule,
    professionalContext,
    targetProfessionalId
  ]);

  useEffect(() => {
    if (!message || showActivationNextStep) return undefined;
    const timeout = window.setTimeout(() => setMessage(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [message, showActivationNextStep]);

  const leadTimeBookingOptions = useMemo(
    () => withCurrentOption(LEAD_TIME_OPTIONS, config?.antecedenciaAgendamento),
    [config?.antecedenciaAgendamento]
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

  const loadCanonicalActivationContext = useCallback(async (controller = new AbortController()) => {
    activationControllerRef.current?.abort();
    activationControllerRef.current = controller;
    const isCurrent = () => contextActiveRef.current
      && activationControllerRef.current === controller
      && !controller.signal.aborted;
    setBusinessContextLoading(true);

    try {
      const dashboard =
        await apiRequest(
          "/dashboard-dono/ativacao",
          { signal: controller.signal }
        );
      if (!isCurrent()) return null;
      const { activationState, canShare, guidance, businessContext } = scheduleActivationContext(dashboard);
      setAvailabilityGuidance(canShare ? null : guidance);
      setBusinessContext(businessContext);

      return {
        activationState,
        canShare,
        guidance,
        isCurrent,
      };
    } catch (requestError) {
      if (!isCurrent()) return null;
      throw requestError;
    } finally {
      if (isCurrent()) setBusinessContextLoading(false);
    }
  }, []);

  useEffect(() => {
    if (
      contextoAgenda !== "dono"
      || ownerTeamSchedule
      || !shareOnboardingRequested
      || config?.origemHorarios !== "personalizado"
      || activationNextStep
      || availabilityPending
      || hasChanges
      || saving
    ) {
      return undefined;
    }

    let active = true;
    const controller = new AbortController();

    loadCanonicalActivationContext(controller)
      .then((activationContext) => {
        if (!active || !activationContext?.isCurrent()) return;
        const { activationState, canShare, guidance } = activationContext;

        if (
          activationState ===
            "CONQUISTAR_PRIMEIRO_AGENDAMENTO" &&
          canShare
        ) {
          setAvailabilityPending(false);
          setActivationNextStep(true);
          return;
        }

        if (
          activationState ===
          "CONQUISTAR_PRIMEIRO_AGENDAMENTO"
        ) {
          setActivationNextStep(false);
          setAvailabilityPending(true);
          setMessage(
            guidance?.mensagem || "Seu perfil está publicado. Revise a disponibilidade antes de divulgar."
          );
          return;
        }

        navigate("/painel", { replace: true });
      })
      .catch(() => {
        if (!active || controller.signal.aborted) return;

        // A URL de onboarding não deve afirmar uma missão sem confirmar
        // o estado canônico da ativação no backend. Em falha transitória,
        // volta ao painel com uma mensagem neutra em vez de deixar a dona
        // presa no editor com um marcador de divulgação não confirmado.
        navigate("/painel", {
          replace: true,
          state: {
            message: "Não foi possível confirmar a próxima etapa agora."
          }
        });
      });

    return () => {
      active = false;
      controller.abort();
      if (activationControllerRef.current === controller) setBusinessContextLoading(false);
    };
  }, [
    activationNextStep,
    availabilityPending,
    config?.origemHorarios,
    contextoAgenda,
    hasChanges,
    loadCanonicalActivationContext,
    navigate,
    ownerTeamSchedule,
    saving,
    shareOnboardingRequested
  ]);

  async function submit(event) {
    event.preventDefault();
    if (saving || !config) return;
    const generation = operationGenerationRef.current;
    const isCurrent = () => contextActiveRef.current
      && operationGenerationRef.current === generation;
    setError("");
    setMessage("");

    const primeiraConfiguracao =
      config?.origemHorarios !== "personalizado";
    const onboardingDona =
      primeiraConfiguracao &&
      contextoAgenda === "dono" &&
      !ownerTeamSchedule;
    const origem = primeiraConfiguracao ? "ajuste_manual" : "editor";

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

    const validationError =
      validateSchedule(days);
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

    const cancellationLeadValue =
      config?.antecedenciaCancelamento;
    const cancellationLeadIsBlank =
      typeof cancellationLeadValue ===
        "string" &&
      cancellationLeadValue.trim() === "";

    if (
      !professionalContext &&
      !ownerTeamSchedule &&
      (
        cancellationLeadIsBlank ||
        !Number.isInteger(
          Number(
            cancellationLeadValue
          )
        ) ||
        Number(
          cancellationLeadValue
        ) < 0 ||
        Number(
          cancellationLeadValue
        ) > 168
      )
    ) {
      setError(
        "A antecedência para cancelamento deve estar entre 0 e 168 horas."
      );
      return;
    }

    // A leitura de restauração pertence à agenda anterior ao PUT.
    activationControllerRef.current?.abort();
    setBusinessContextLoading(false);
    setSaving(true);
    try {
      const body = {
        ...config,
        horarios: days
      };

      if (
        professionalContext ||
        ownerTeamSchedule
      ) {
        delete body.antecedenciaCancelamento;
      }

      if (ownerTeamSchedule) {
        body.profissionalId =
          targetProfessionalId;
      }

      const result = await apiRequest("/agenda-configuracao", {
        method: "PUT",
        headers: {
          "X-AF-Contexto": contextoAgenda
        },
        body
      });
      if (!isCurrent()) return;
      const savedConfig = result.configuracao || {};
      const configuradoEm = savedConfig.configurado_em
        ?? savedConfig.configuradoEm
        ?? config.configuradoEm
        ?? null;
      const origemHorarios = savedConfig.origem_horarios
        ?? savedConfig.origemHorarios
        ?? "personalizado";

      const updatedConfig = {
        ...config,
        configuradoEm,
        origemHorarios
      };
      flushSync(() => {
        setConfig(updatedConfig);
        setSavedSchedule(serializeSchedule(updatedConfig, days));
      });
      if (!isCurrent()) return;
      setMessage(result.mensagem || "Horários atualizados.");

      if (
        onboardingDona &&
        origemHorarios ===
          "personalizado"
      ) {
        track("agenda_configurada", {
          page: "configuracao_agenda",
          mission: "disponibilizar_horarios",
          properties: {
            status: "sucesso",
            origem
          }
        });
      }

      const shouldContinueActivation =
        contextoAgenda === "dono" &&
        !ownerTeamSchedule &&
        (
          onboardingDona ||
          shareOnboardingRequested ||
          availabilityPending
        );

      if (
        shouldContinueActivation &&
        origemHorarios ===
          "personalizado"
      ) {
        let activationContext = null;
        try {
          activationContext =
            await loadCanonicalActivationContext();
        } catch {
          if (!isCurrent()) return;
          navigate("/painel", {
            replace: true,
            state: {
              message: "Horários salvos. Não foi possível confirmar a próxima etapa agora."
            }
          });
          return;
        }

        if (!isCurrent() || !activationContext?.isCurrent()) return;

        if (
          activationContext
            ?.activationState ===
            "CONQUISTAR_PRIMEIRO_AGENDAMENTO" &&
          activationContext?.canShare
        ) {
          setAvailabilityPending(false);
          setActivationNextStep(true);

          const params = new URLSearchParams(location.search);
          params.set("onboarding", "divulgacao");
          navigate(`${location.pathname}?${params.toString()}`, {
            replace: true,
            state: location.state
          });
          return;
        }

        if (
          activationContext
            ?.activationState ===
          "CONQUISTAR_PRIMEIRO_AGENDAMENTO"
        ) {
          setActivationNextStep(false);
          setAvailabilityPending(true);
          setMessage(
            `Horários salvos. ${activationContext.guidance?.mensagem || "Revise a disponibilidade antes de divulgar."}`
          );

          if (!shareOnboardingRequested) {
            const params =
              new URLSearchParams(
                location.search
              );
            params.set(
              "onboarding",
              "divulgacao"
            );
            navigate(
              `${location.pathname}?${params.toString()}`,
              {
                replace: true,
                state: location.state
              }
            );
          }
          return;
        }

        navigate("/painel", { replace: true });
      }
    } catch (requestError) {
      if (!isCurrent()) return;
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
      if (isCurrent()) setSaving(false);
    }
  }

  return {
    location,
    professionalContext,
    ownerTeamSchedule,
    config,
    setConfig,
    setLoadAttempt,
    days,
    expandedPauses,
    advancedOpen,
    setAdvancedOpen,
    setupSessionRef,
    error,
    message,
    saving,
    businessContext,
    businessContextLoading,
    scheduleProfessional,
    availabilityPending,
    availabilityGuidance,
    shareOnboardingRequested,
    hasChanges,
    showActivationNextStep,
    discardPendingOperations,
    leadTimeBookingOptions,
    updateDay,
    toggleDay,
    setPauseMode,
    copyDayToActiveDays,
    submit
  };
}
