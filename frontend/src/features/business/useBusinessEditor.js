import { useBusinessAddress } from "./useBusinessAddress";
import { EMPTY, validateImage, normalizeBusinessForm, serializeBusinessForm, isValidLocationUrl, isBusinessMapUrl, timeZonesForState, firstMissingBusinessField, validateWhatsApp, validateCreationCompleteness, buildBusinessMapSearchUrl, isStaleGeneratedMapSearch } from "./form";
import { clearBusinessCreationDraft, readBusinessCreationDraft, saveBusinessCreationDraft } from "./draft";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest } from "../../api/client";
import { useSession } from "../../auth/SessionContext";
import {
  ANALYTICS_IDENTITY_BOUNDARY_EVENT,
  getPlanIntentPath,
  normalizePlanSlug
} from "../../auth/session";
import { formatWhatsApp } from "../../utils/format";
import { businessCreationReferenceHash, readBusinessCreationReference } from "../../utils/businessCreationReference";
import { buildPublicLink, copyPublicLink } from "../../utils/publicLinks";
import { onboardingServicePath, safeServiceId } from "../onboarding/navigation";

const SERVICE_PUBLICATION_PENDING =
  "pelo menos um serviço ativo";
const FIRST_SERVICE_ONBOARDING_PATH =
  "/painel/servicos/novo?onboarding=servico";

// Coordena estado, operações e recuperação; a página mantém a apresentação.
export function useBusinessEditor({ create = false }) {
  const session = useSession();
  const usuarioId = Number(session.usuario?.id) || 0;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const selectedPlan = normalizePlanSlug(searchParams.get("plano"));
  const onboardingRevision = !create && searchParams.get("onboarding") === "revisao-negocio";
  const returnServiceId = safeServiceId(searchParams.get("servico_retorno"));
  const [form, setForm] = useState(() => create
    ? normalizeBusinessForm(readBusinessCreationDraft(usuarioId) || EMPTY)
    : EMPTY);
  const [savedForm, setSavedForm] = useState(EMPTY);
  const [loading, setLoading] = useState(() => !create || Boolean(readBusinessCreationReference(location.hash, usuarioId)));
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(() => location.state?.message || "");
  const [publication, setPublication] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [closingBusiness, setClosingBusiness] = useState(false);
  const [closureUncertain, setClosureUncertain] = useState(false);
  const [contextInvalid, setContextInvalid] = useState(false);
  const [creationUncertain, setCreationUncertain] = useState(false);
  const [creationEnded, setCreationEnded] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [closurePendings, setClosurePendings] = useState([]);
  const pageContextRef = useRef(null);
  const operationRef = useRef(null);
  const archiveTargetRef = useRef(null);
  const creationAttemptRef = useRef(null);
  const creationReadRef = useRef(null);
  const formRef = useRef(null);
  const creationCompletedRef = useRef(false);
  const draftOwnerRef = useRef(usuarioId);
  const skipDraftWriteRef = useRef(false);
  const mutationBusy = saving || photoUploading || publishing || closingBusiness || closureUncertain || contextInvalid || creationUncertain || creationEnded;

  const unsavedChanges = !loading
    && serializeBusinessForm(form) !== serializeBusinessForm(savedForm);
  const hasChanges = !create && unsavedChanges;
  const publicUrl = buildPublicLink({
    businessSlug: form.slug
  });
  const staleMapSearch = isStaleGeneratedMapSearch(form);
  const unchangedLegacyLocation = !create &&
    String(form.localizacao_url || "").trim() ===
    String(savedForm.localizacao_url || "").trim();
  const locationValid = !staleMapSearch && isValidLocationUrl(form.localizacao_url)
    && (unchangedLegacyLocation || !String(form.localizacao_url || "").trim() ||
      isBusinessMapUrl(form.localizacao_url));
  const whatsappError = validateWhatsApp(form.whatsapp);
  const timeZoneOptions = timeZonesForState(form.estado);
  const mapSuggestion = buildBusinessMapSearchUrl(form);

  function focusFormField(field) {
    formRef.current?.querySelector(`[name="${field}"]`)?.focus();
  }

  function suggestMapLink() {
    if (!mapSuggestion) return;
    update("localizacao_url", mapSuggestion);
    setMessage("Link de busca preparado. Confira o endereço no mapa antes de continuar.");
  }
  const { cepLookup, update, handleCepChange, handleCepBlur, resetCepLookup } = useBusinessAddress({
    create, usuarioId, form, setForm, setSavedForm, loading
  });

  // Rascunho temporário vinculado à conta e à guia; sem persistência no localStorage.
  useEffect(() => {
    if (!create || draftOwnerRef.current === usuarioId) return;
    draftOwnerRef.current = usuarioId;
    creationCompletedRef.current = false;
    skipDraftWriteRef.current = true;
    setForm(normalizeBusinessForm(readBusinessCreationDraft(usuarioId) || EMPTY));
    setSavedForm(EMPTY);
  }, [create, usuarioId]);

  useEffect(() => {
    if (!create || !usuarioId || creationCompletedRef.current) return;
    if (skipDraftWriteRef.current) {
      skipDraftWriteRef.current = false;
      return;
    }
    saveBusinessCreationDraft(usuarioId, form);
  }, [create, usuarioId, form]);

  useEffect(() => {
    if (!create) return undefined;
    const discardPrivateDraft = () => {
      creationCompletedRef.current = true;
      clearBusinessCreationDraft();
    };
    window.addEventListener(ANALYTICS_IDENTITY_BOUNDARY_EVENT, discardPrivateDraft);
    return () => window.removeEventListener(ANALYTICS_IDENTITY_BOUNDARY_EVENT, discardPrivateDraft);
  }, [create]);

  // O ViaCEP ou a edição do endereço pode trocar a UF depois da renderização.
  // Um fuso incompatível nunca acompanha automaticamente um novo estado.
  useEffect(() => {
    if (!create && !form.id) return;
    const choices = timeZonesForState(form.estado);
    setForm((current) => {
      const valid = choices.some(option => option.value === current.fuso_horario);
      const next = valid ? current.fuso_horario
        : choices.length === 1 ? choices[0].value : "";
      return current.fuso_horario === next ? current : { ...current, fuso_horario: next };
    });
  }, [create, form.estado, form.id]);

  useEffect(() => {
    const context = { create, usuarioId, generation: 0 };
    pageContextRef.current = context;
    operationRef.current = null;
    setSaving(false);
    setPhotoUploading(false);
    setPublishing(false);
    setClosingBusiness(false);
    setClosureUncertain(false);
    setCreationUncertain(false);
    setCreationEnded(false);
    creationAttemptRef.current = create ? readBusinessCreationReference(location.hash, usuarioId) : null;
    archiveTargetRef.current = null;

    return () => {
      if (pageContextRef.current === context) pageContextRef.current = null;
      creationReadRef.current?.abort();
    };
  }, [create, usuarioId]);

  function beginOperation({ archive = false, recovery = false } = {}) {
    // Bloqueia ações simultâneas antes de o React desabilitar os controles.
    if (loading || contextInvalid || creationEnded || (creationUncertain && !recovery) || operationRef.current || !pageContextRef.current || (closureUncertain && !archive)) return null;
    const operation = {
      context: pageContextRef.current,
      generation: pageContextRef.current.generation,
    };
    operationRef.current = operation;
    return operation;
  }

  function isCurrentOperation(operation) {
    return pageContextRef.current === operation.context
      && operation.context.generation === operation.generation;
  }

  function discardPendingOperations() {
    if (create) {
      creationCompletedRef.current = true;
      clearBusinessCreationDraft();
    }
    // Suspense pode manter a tela antiga montada enquanto o destino carrega.
    if (pageContextRef.current) pageContextRef.current.generation += 1;
    if (creationReadRef.current) {
      creationReadRef.current.abort();
      creationReadRef.current = null;
      if (create && creationAttemptRef.current) {
        setLoading(false);
        setCreationUncertain(true);
      }
    }
    operationRef.current = null;
    resetCepLookup();
    setSaving(false);
    setPhotoUploading(false);
    setPublishing(false);
    setClosingBusiness(false);
  }

  function finishOperation(operation) {
    if (operationRef.current === operation) operationRef.current = null;
  }

  function confirmBusinessTarget(result) {
    if (result.negocio?.id != null && Number(result.negocio.id) !== Number(savedForm.id)) {
      throw Object.assign(new Error("O contexto do negócio mudou. Atualize Meu negócio antes de continuar."), {
        status: 409, data: { codigo: "NEGOCIO_CONTEXTO_ALTERADO" },
      });
    }
  }

  function handleMutationError(requestError) {
    if (requestError.data?.codigo === "NEGOCIO_CONTEXTO_ALTERADO") setContextInvalid(true);
    setError(requestError.message);
  }

  function retainCreationReference(key) {
    const hash = businessCreationReferenceHash(location.hash, key ? { key, usuarioId } : null);
    navigate({ pathname: location.pathname, search: location.search, hash }, {
      replace: true, flushSync: true, state: location.state,
    });
  }

  function adoptCreatedBusiness(result, operation) {
    if (!result.negocio?.id) throw new Error("Não foi possível identificar o negócio salvo. Verifique novamente.");
    if (!isCurrentOperation(operation)) return;
    creationCompletedRef.current = true;
    clearBusinessCreationDraft();
    const normalized = normalizeBusinessForm(result.negocio);
    flushSync(() => { setForm(normalized); setSavedForm(normalized); });
    if (!isCurrentOperation(operation)) return;
    if (!session.adoptCreatedBusiness(result.negocio)) {
      navigate("/entrar?tipo=profissional", { replace: true });
      return;
    }
    creationAttemptRef.current = null;
    session.refresh({ silent: true }).catch(() => {});
    navigate(getPlanIntentPath(FIRST_SERVICE_ONBOARDING_PATH, selectedPlan), {
      replace: true, state: { onboarding: true, onboardingStep: "servico" },
    });
  }

  async function recoverBusinessCreation(operation, signal) {
    const attempt = creationAttemptRef.current;
    if (!attempt) throw new Error("Não foi possível identificar esta tentativa. Atualize a página.");
    const result = await apiRequest("/criar-negocio/tentativa", {
      headers: { "Idempotency-Key": attempt.key }, signal,
    });
    if (!isCurrentOperation(operation)) return;
    if (result.estado === "nao_encontrada") {
      // O POST pode chegar depois da leitura. A próxima escrita conserva a chave.
      attempt.body = null;
      setCreationUncertain(false);
      setError("");
      setMessage("Ainda não há negócio confirmado para esta tentativa. Confira os dados antes de continuar.");
      return;
    }
    adoptCreatedBusiness(result, operation);
  }

  function handleCreationFailure(requestError) {
    const status = Number(requestError.status || requestError.statusCode);
    const uncertain = !status || status >= 500 || status === 408
      || requestError.data?.codigo === "NEGOCIO_TENTATIVA_DIVERGENTE";
    if (status === 410) setCreationEnded(true);
    setCreationUncertain(uncertain);
    if (!uncertain && status !== 410) {
      creationAttemptRef.current = null;
      retainCreationReference(null);
    }
    setError(uncertain
      ? "Não foi possível confirmar a criação do negócio. Verifique esta tentativa antes de alterar os dados."
      : requestError.message);
  }

  useEffect(() => {
    if (!create) return;
    const accountWhatsapp = formatWhatsApp(session.usuario?.whatsapp);
    if (!accountWhatsapp) return;

    setForm((current) => current.whatsapp
      ? current
      : { ...current, whatsapp: accountWhatsapp });
    setSavedForm((current) => current.whatsapp
      ? current
      : { ...current, whatsapp: accountWhatsapp });
  }, [create, session.usuario?.whatsapp]);

  useEffect(() => {
    if (create) {
      if (!creationAttemptRef.current) { setLoading(false); return undefined; }
      const controller = new AbortController();
      creationReadRef.current = controller;
      const context = pageContextRef.current;
      const operation = { context, generation: context.generation };
      setLoading(true);
      recoverBusinessCreation(operation, controller.signal).catch(requestError => {
        if (isCurrentOperation(operation)) {
          setCreationUncertain(true);
          if (Number(requestError.status || requestError.statusCode) === 410) setCreationEnded(true);
          setError(requestError.message);
        }
      }).finally(() => {
        if (creationReadRef.current === controller) creationReadRef.current = null;
        if (isCurrentOperation(operation)) setLoading(false);
      });
      return () => controller.abort();
    }

    const controller = new AbortController();
    let active = true;
    setLoading(true);
    apiRequest("/configuracoes", { signal: controller.signal })
      .then((result) => {
        if (!active) return;
        const business = result.negocio || result.configuracoes || {};
        const normalized = normalizeBusinessForm(business);
        setForm(normalized);
        setSavedForm(normalized);
        setContextInvalid(false);
        setError("");
        setPublication(result.publicacao || {
          publicado: business.publicado === true,
          pode_publicar: false,
          pendencias: []
        });
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [create, loadAttempt, usuarioId]);

  useEffect(() => {
    if (!message) return undefined;
    const timeout = window.setTimeout(() => setMessage(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [message]);

  function toggleSpecialty(specialty) {
    setForm((current) => ({
      ...current,
      areas: current.areas.includes(specialty)
        ? current.areas.filter((item) => item !== specialty)
        : [...current.areas, specialty]
    }));
  }

  async function copyPublicUrl() {
    if (!publicUrl) return;

    try {
      await copyPublicLink(publicUrl);
      setMessage("Link público copiado.");
    } catch {
      setError("Não foi possível copiar o link automaticamente.");
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (operationRef.current || cepLookup.status === "loading") return;
    if (onboardingRevision && !unsavedChanges) {
      navigate(onboardingServicePath(selectedPlan, returnServiceId));
      return;
    }
    setError("");
    setMessage("");

    if (create && creationUncertain) {
      const operation = beginOperation({ recovery: true });
      if (!operation) return;
      const controller = new AbortController();
      creationReadRef.current = controller;
      setSaving(true);
      try { await recoverBusinessCreation(operation, controller.signal); }
      catch (requestError) {
        if (isCurrentOperation(operation)) {
          if (Number(requestError.status || requestError.statusCode) === 410) setCreationEnded(true);
          setError(requestError.message);
        }
      } finally {
        if (creationReadRef.current === controller) creationReadRef.current = null;
        if (isCurrentOperation(operation)) { finishOperation(operation); setSaving(false); }
      }
      return;
    }

    if (create) {
      const completenessError = validateCreationCompleteness(form);
      if (completenessError) {
        setError(completenessError);
        focusFormField(firstMissingBusinessField(form));
        return;
      }
    } else if (form.areas.length === 0) {
      setError("Selecione ao menos uma especialidade.");
      return;
    }

    if (whatsappError) {
      setError(whatsappError);
      focusFormField("whatsapp");
      return;
    }

    if (timeZoneOptions.length > 1 && !form.fuso_horario) {
      setError("Escolha o fuso horário da cidade do negócio.");
      focusFormField("fuso_horario");
      return;
    }

    if (!locationValid) {
      setError(staleMapSearch
        ? "O link de busca aponta para o endereço anterior. Gere outro link ou informe o local atualizado."
        : "Informe um link HTTPS do Google Maps ou Apple Mapas.");
      focusFormField("localizacao_url");
      return;
    }

    const operation = beginOperation();
    if (!operation) return;
    setSaving(true);

    const payload = {
      ...form,
      whatsapp: String(form.whatsapp).replace(/\D/g, ""),
      cep: String(form.cep).replace(/\D/g, ""),
      fuso_horario: create
        ? (form.fuso_horario || (timeZoneOptions.length === 1 ? timeZoneOptions[0].value : ""))
        : form.fuso_horario,
      especialidades: form.areas,
      areas: form.areas
    };

    delete payload.slug;
    delete payload.whatsapp_negocio;

    try {
      if (create) {
        if (!creationAttemptRef.current) {
          const key = `negocio-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
          creationAttemptRef.current = { key };
          retainCreationReference(key);
        }
        if (!isCurrentOperation(operation)) return;
        creationAttemptRef.current.body ||= payload;
      }
      const result = await apiRequest(create ? "/criar-negocio" : "/configuracoes", {
        method: create ? "POST" : "PUT",
        headers: create ? { "Idempotency-Key": creationAttemptRef.current.key } : { "X-AF-Negocio": String(savedForm.id) },
        body: create ? creationAttemptRef.current.body : payload
      });
      if (!isCurrentOperation(operation)) return;
      if (create) { adoptCreatedBusiness(result, operation); return; }
      if (!create) confirmBusinessTarget(result);
      const savedBusiness = result.negocio || {};
      const normalizedSaved = normalizeBusinessForm({
        ...form,
        ...savedBusiness,
        areas: savedBusiness.areas || form.areas
      });
      flushSync(() => {
        setForm(normalizedSaved);
        setSavedForm(normalizedSaved);
      });
      if (!isCurrentOperation(operation)) return;
      setMessage(result.mensagem || (create ? "Negócio criado." : "Alterações salvas."));
      if (result.publicacao) setPublication(result.publicacao);
      const profileOnboarding =
        !create
        && location.state?.onboarding === true
        && location.state?.onboardingStep === "perfil";

      session.refresh({ silent: true }).catch(() => {});

      if (onboardingRevision) {
        navigate(onboardingServicePath(selectedPlan, returnServiceId), { replace: true });
        return;
      }

      if (profileOnboarding) {
        const pending = Array.isArray(result.publicacao?.pendencias)
          ? result.publicacao.pendencias
          : [];
        const profilePending = pending.filter(
          (item) => item !== SERVICE_PUBLICATION_PENDING
        );

        if (profilePending.length === 0) {
          const servicePending = pending.includes(
            SERVICE_PUBLICATION_PENDING
          );

          const published = result.publicacao?.publicado === true;
          const destination = servicePending
            ? FIRST_SERVICE_ONBOARDING_PATH
            : published
              ? "/painel/horarios"
              : "/painel";

          navigate(
            getPlanIntentPath(destination, selectedPlan),
            {
              replace: true,
              state: servicePending
                ? { onboarding: true, onboardingStep: "servico" }
                : published
                  ? { onboarding: true, onboardingStep: "agenda" }
                  : {
                      message: "Dados essenciais concluídos. Estamos atualizando sua publicação.",
                      onboardingCompleted: false
                    }
            }
          );
        }
      }
    } catch (requestError) {
      if (isCurrentOperation(operation)) {
        if (create) handleCreationFailure(requestError);
        else handleMutationError(requestError);
      }
    } finally {
      if (isCurrentOperation(operation)) {
        finishOperation(operation);
        setSaving(false);
      }
    }
  }

  async function uploadPhoto(event) {
    if (operationRef.current) return;
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validateImage(file);
    if (validationError) {
      setError(validationError);
      event.target.value = "";
      return;
    }

    const operation = beginOperation();
    if (!operation) return;
    setPhotoUploading(true);
    setError("");
    setMessage("");
    const body = new FormData();
    body.append("foto", file);

    try {
      const result = await apiRequest("/configuracoes/foto", {
        method: "POST",
        headers: { "X-AF-Negocio": String(savedForm.id) },
        body
      });
      if (!isCurrentOperation(operation)) return;
      confirmBusinessTarget(result);
      const business = result.negocio || {};
      if (business.foto_url !== undefined) {
        setForm((current) => ({ ...current, foto_url: business.foto_url }));
        setSavedForm((current) => ({ ...current, foto_url: business.foto_url }));
      }
      if (result.publicacao) setPublication(result.publicacao);
      setMessage(result.mensagem || "Foto do negócio atualizada.");
      session.refresh({ silent: true }).catch(() => {});
    } catch (requestError) {
      if (isCurrentOperation(operation)) handleMutationError(requestError);
    } finally {
      if (isCurrentOperation(operation)) {
        finishOperation(operation);
        setPhotoUploading(false);
        event.target.value = "";
      }
    }
  }

  async function closeBusiness() {
    if (operationRef.current || loading) return;
    const targetId = archiveTargetRef.current || savedForm.id;
    if (!targetId) {
      setError("Atualize Meu negócio antes de solicitar o encerramento.");
      return;
    }
    if (
      !closureUncertain &&
      !window.confirm(
        "Encerrar este negócio? Ele sairá da descoberta, não receberá novos agendamentos e não poderá ser reativado pelo fluxo normal."
      )
    ) {
      return;
    }

    const operation = beginOperation({ archive: true });
    if (!operation) return;
    archiveTargetRef.current = targetId;
    setClosingBusiness(true);
    setClosurePendings([]);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest("/negocio/encerrar", {
        method: "POST",
        body: { negocio_id: targetId }
      });
      if (!isCurrentOperation(operation)) return;
      if (Number(result.negocio?.id) !== Number(targetId)) {
        throw new Error("Não foi possível confirmar qual negócio foi arquivado.");
      }
      flushSync(() => setSavedForm(form));
      if (!isCurrentOperation(operation)) return;
      session.adoptArchivedBusiness?.(result.negocio);
      // O arquivamento já foi confirmado. A leitura auxiliar não altera esse resultado.
      void session.refresh({ silent: true }).catch(() => {});
      navigate("/", {
        replace: true,
        // O destino público deve acompanhar a retirada do vínculo antes do guard de criação.
        flushSync: true,
        state: {
          message: result.mensagem
        }
      });
    } catch (requestError) {
      if (isCurrentOperation(operation)) {
        const status = Number(requestError.status || requestError.statusCode);
        const uncertain = !status || status === 408 || status >= 500;
        const pendingConfirmed = status === 409 && requestError.data?.codigo === "ENCERRAMENTO_COM_PENDENCIAS";
        if (pendingConfirmed) archiveTargetRef.current = null;
        setClosureUncertain(!pendingConfirmed && (uncertain || status === 404 || closureUncertain));
        setError(uncertain
          ? "Não foi possível confirmar o encerramento. Verifique novamente para confirmar a situação deste negócio."
          : requestError.message);
        setClosurePendings(
          Array.isArray(requestError.data?.pendencias)
            ? requestError.data.pendencias
            : []
        );
      }
    } finally {
      if (isCurrentOperation(operation)) {
        finishOperation(operation);
        setClosingBusiness(false);
      }
    }
  }

  async function togglePublication() {
    if (operationRef.current || loading || !publication) return;
    const nextPublished = !publication?.publicado;

    if (
      publication?.publicado
      && !window.confirm(
        "Ocultar este negócio da busca e do perfil público? Ele só voltará a aparecer quando você escolher Mostrar na busca."
      )
    ) {
      return;
    }

    const operation = beginOperation();
    if (!operation) return;
    setPublishing(true);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest("/configuracoes/publicacao", {
        method: "PATCH",
        headers: { "X-AF-Negocio": String(savedForm.id) },
        body: { publicado: nextPublished }
      });
      if (!isCurrentOperation(operation)) return;
      confirmBusinessTarget(result);
      setPublication(result.publicacao);
      setMessage(result.mensagem);
      session.refresh({ silent: true }).catch(() => {});
      if (
        nextPublished
        && location.state?.onboarding === true
        && location.state?.onboardingStep === "publicacao"
      ) {
        navigate("/painel", { replace: true });
      }
    } catch (requestError) {
      if (isCurrentOperation(operation)) handleMutationError(requestError);
    } finally {
      if (isCurrentOperation(operation)) {
        finishOperation(operation);
        setPublishing(false);
      }
    }
  }

  return {
    formRef,
    timeZoneOptions,
    mapSuggestion,
    suggestMapLink,
    selectedPlan,
    onboardingRevision,
    returnServiceId,
    form,
    savedForm,
    loading,
    saving,
    photoUploading,
    error,
    message,
    publication,
    publishing,
    closingBusiness,
    closureUncertain,
    contextInvalid,
    creationUncertain,
    creationEnded,
    setLoadAttempt,
    closurePendings,
    cepLookup,
    mutationBusy,
    unsavedChanges,
    hasChanges,
    publicUrl,
    locationValid,
    staleMapSearch,
    whatsappError,
    discardPendingOperations,
    update,
    toggleSpecialty,
    handleCepChange,
    handleCepBlur,
    copyPublicUrl,
    submit,
    uploadPhoto,
    closeBusiness,
    togglePublication
  };
}
