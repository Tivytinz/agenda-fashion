import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useSession } from "../auth/SessionContext";
import {
  getPlanIntentPath,
  normalizePlanSlug
} from "../auth/session";
import { BackLink } from "../components/BackLink";
import { ConfirmationIcon } from "../components/ConfirmationIcon";
import { FlowSteps } from "../components/FlowSteps";
import { ErrorState, LoadingState } from "../components/ScreenState";
import { UnsavedChangesGuard } from "../components/UnsavedChangesGuard";
import { MediaThumb } from "../components/profile/MediaThumb";
import { formatCep, formatWhatsApp } from "../utils/format";
import { businessCreationReferenceHash, readBusinessCreationReference } from "../utils/businessCreationReference";
import { buildPublicLink, copyPublicLink } from "../utils/publicLinks";
import {
  BUSINESS_SPECIALTIES,
  normalizeBusinessSpecialties
} from "../utils/specialties";

const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const EMPTY = {
  nome: "",
  descricao: "",
  whatsapp: "",
  cidade: "",
  estado: "",
  bairro: "",
  endereco: "",
  numero: "",
  complemento: "",
  cep: "",
  localizacao_url: "",
  foto_url: "",
  slug: "",
  areas: []
};

const CREATION_REQUIRED_FIELDS = [
  ["nome", "Nome do negócio"],
  ["whatsapp", "WhatsApp"],
  ["cidade", "Cidade"],
  ["estado", "Estado"],
  ["bairro", "Bairro"],
  ["endereco", "Endereço"],
  ["numero", "Número"],
  ["cep", "CEP"],
  ["localizacao_url", "Link do Google Maps"]
];
const SERVICE_PUBLICATION_PENDING =
  "pelo menos um serviço ativo";
const ACTIVATION_STEPS = ["Negócio", "Serviço"];
const FIRST_SERVICE_ONBOARDING_PATH =
  "/painel/servicos/novo?onboarding=servico";

function validateImage(file) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Use uma imagem JPG, PNG ou WEBP.";
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return "A imagem deve ter no máximo 5 MB.";
  }

  return "";
}

function normalizeBusinessForm(business = {}) {
  return {
    ...EMPTY,
    ...business,
    whatsapp: formatWhatsApp(
      business.whatsapp || business.whatsapp_negocio
    ),
    cep: formatCep(business.cep),
    areas: normalizeBusinessSpecialties(business)
  };
}

function serializeBusinessForm(value) {
  return JSON.stringify({
    ...value,
    areas: [...(value.areas || [])].sort()
  });
}

function isValidLocationUrl(value) {
  if (!String(value || "").trim()) return true;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateWhatsApp(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 || digits.length === 11
    ? ""
    : "Informe um WhatsApp com DDD e 10 ou 11 dígitos.";
}

function validateCreationCompleteness(form) {
  if (!Array.isArray(form.areas) || form.areas.length === 0) {
    return "Preencha todas as informações do negócio antes de continuar. Campo pendente: Especialidades.";
  }

  for (const [field, label] of CREATION_REQUIRED_FIELDS) {
    if (!String(form[field] ?? "").trim()) {
      return `Preencha todas as informações do negócio antes de continuar. Campo pendente: ${label}.`;
    }
  }

  return "";
}

export function BusinessPage({ create = false }) {
  const session = useSession();
  const usuarioId = Number(session.usuario?.id) || 0;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const selectedPlan = normalizePlanSlug(searchParams.get("plano"));
  const [form, setForm] = useState(EMPTY);
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
  const [cepLookup, setCepLookup] = useState({ status: "idle", message: "" });
  const cepRequestRef = useRef(0);
  const addressEditsRef = useRef({ endereco: 0, bairro: 0, cidade: 0, estado: 0 });
  const pageContextRef = useRef(null);
  const operationRef = useRef(null);
  const archiveTargetRef = useRef(null);
  const creationAttemptRef = useRef(null);
  const creationReadRef = useRef(null);
  const mutationBusy = saving || photoUploading || publishing || closingBusiness || closureUncertain || contextInvalid || creationUncertain || creationEnded;

  const unsavedChanges = !loading
    && serializeBusinessForm(form) !== serializeBusinessForm(savedForm);
  const hasChanges = !create && unsavedChanges;
  const publicUrl = buildPublicLink({
    businessSlug: form.slug
  });
  const locationValid = isValidLocationUrl(form.localizacao_url);
  const whatsappError = validateWhatsApp(form.whatsapp);

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
    setCepLookup({ status: "idle", message: "" });

    return () => {
      if (pageContextRef.current === context) pageContextRef.current = null;
      creationReadRef.current?.abort();
      cepRequestRef.current += 1;
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
    cepRequestRef.current += 1;
    setSaving(false);
    setPhotoUploading(false);
    setPublishing(false);
    setClosingBusiness(false);
    setCepLookup({ status: "idle", message: "" });
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

  useEffect(() => {
    if (create || loading) return;

    const cepDigits = String(form.cep || "").replace(/\D/g, "");
    if (cepDigits.length === 8 && !String(form.endereco || "").trim()) {
      lookupCep(cepDigits, { syncBaseline: true });
    }
  }, [create, loading]);

  function update(field, value) {
    if (Object.hasOwn(addressEditsRef.current, field)) addressEditsRef.current[field] += 1;
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleSpecialty(specialty) {
    setForm((current) => ({
      ...current,
      areas: current.areas.includes(specialty)
        ? current.areas.filter((item) => item !== specialty)
        : [...current.areas, specialty]
    }));
  }

  async function lookupCep(value, { syncBaseline = false } = {}) {
    const cepDigits = String(value || "").replace(/\D/g, "");
    if (cepDigits.length !== 8) return;

    const requestId = cepRequestRef.current + 1;
    cepRequestRef.current = requestId;
    const addressEditsAtRequest = { ...addressEditsRef.current };
    setCepLookup({ status: "loading", message: "Buscando endereço..." });

    try {
      const result = await apiRequest(`/cep/${cepDigits}`, {
        timeoutMs: 6000
      });
      if (requestId !== cepRequestRef.current) return;

      const addressPatch = Object.fromEntries(Object.entries({
        endereco: result.endereco || "",
        bairro: result.bairro || "",
        cidade: result.cidade || "",
        estado: result.estado || ""
      }).filter(([field]) => addressEditsRef.current[field] === addressEditsAtRequest[field]));

      setForm((current) => {
        const currentCep = String(current.cep || "").replace(/\D/g, "");
        if (currentCep !== cepDigits) return current;

        return {
          ...current,
          ...addressPatch
        };
      });

      if (syncBaseline) {
        setSavedForm((current) => {
          const currentCep = String(current.cep || "").replace(/\D/g, "");
          if (currentCep !== cepDigits) return current;

          return {
            ...current,
            ...addressPatch
          };
        });
      }

      setCepLookup({
        status: "success",
        message: result.endereco
          ? "Endereço encontrado. Complete o número. O complemento é opcional."
          : "CEP encontrado. Complete o endereço e o número. O complemento é opcional."
      });
    } catch (requestError) {
      if (requestId !== cepRequestRef.current) return;

      const notFound = /CEP não encontrado/i.test(requestError?.message || "");
      setCepLookup({
        status: "error",
        message: notFound
          ? "CEP não encontrado. Confira os números ou preencha o endereço manualmente."
          : "Não foi possível consultar o CEP agora. Preencha o endereço manualmente."
      });
    }
  }

  function handleCepChange(event) {
    const formattedCep = formatCep(event.target.value);
    const cepDigits = String(formattedCep || "").replace(/\D/g, "");
    update("cep", formattedCep);

    if (cepDigits.length !== 8) {
      cepRequestRef.current += 1;
      setCepLookup({ status: "idle", message: "" });
      return;
    }

    lookupCep(cepDigits);
  }

  function handleCepBlur() {
    const cepDigits = String(form.cep || "").replace(/\D/g, "");
    if (
      cepDigits.length === 8
      && cepLookup.status !== "loading"
      && cepLookup.status !== "success"
    ) {
      lookupCep(cepDigits);
    }
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
        return;
      }
    } else if (form.areas.length === 0) {
      setError("Selecione ao menos uma especialidade.");
      return;
    }

    if (whatsappError) {
      setError(whatsappError);
      return;
    }

    if (!locationValid) {
      setError("Informe um link HTTP ou HTTPS válido para a localização.");
      return;
    }

    const operation = beginOperation();
    if (!operation) return;
    setSaving(true);

    const payload = {
      ...form,
      whatsapp: String(form.whatsapp).replace(/\D/g, ""),
      cep: String(form.cep).replace(/\D/g, ""),
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

  if (loading) return <main className="workspace-page"><UnsavedChangesGuard onLeave={discardPendingOperations} /><LoadingState>Carregando negócio...</LoadingState></main>;
  if (error && !form.nome && !create) return <main className="workspace-page"><ErrorState message={error} /></main>;

  const addressFields = (
    <div className="form-grid business-address-grid">
      <label className="business-cep-field">
        CEP
        <input
          aria-busy={cepLookup.status === "loading" ? "true" : undefined}
          aria-invalid={cepLookup.status === "error" ? "true" : undefined}
          autoComplete="postal-code"
          disabled={saving || closingBusiness || closureUncertain || contextInvalid || creationUncertain || creationEnded}
          inputMode="numeric"
          maxLength="9"
          onBlur={handleCepBlur}
          onChange={handleCepChange}
          placeholder="00000-000"
          required={create}
          value={form.cep}
        />
        <small
          aria-live="polite"
          className={`field-helper cep-lookup-helper is-${cepLookup.status}`}
        >
          {cepLookup.message || "Ao completar o CEP, rua, bairro, cidade e estado serão preenchidos."}
        </small>
      </label>
      <span className="field-wide business-address-divider" aria-hidden="true" />
      <label>
        Endereço
        <input autoComplete="street-address" disabled={saving || closingBusiness || closureUncertain || contextInvalid || creationUncertain || creationEnded} onChange={(event) => update("endereco", event.target.value)} required={create} value={form.endereco} />
      </label>
      <label>
        Número
        <input disabled={saving || closingBusiness || closureUncertain || contextInvalid || creationUncertain || creationEnded} onChange={(event) => update("numero", event.target.value)} required={create} value={form.numero} />
      </label>
      <label>
        {create ? "Complemento (opcional)" : "Complemento"}
        <input disabled={saving || closingBusiness || closureUncertain || contextInvalid || creationUncertain || creationEnded} onChange={(event) => update("complemento", event.target.value)} value={form.complemento} />
      </label>
      <label>
        Bairro
        <input disabled={saving || closingBusiness || closureUncertain || contextInvalid || creationUncertain || creationEnded} onChange={(event) => update("bairro", event.target.value)} required={create} value={form.bairro} />
      </label>
      <label>
        Cidade
        <input disabled={saving || closingBusiness || closureUncertain || contextInvalid || creationUncertain || creationEnded} onChange={(event) => update("cidade", event.target.value)} required={create} value={form.cidade} />
      </label>
      <label>
        Estado
        <select aria-label="Estado" disabled={saving || closingBusiness || closureUncertain || contextInvalid || creationUncertain || creationEnded} onChange={(event) => update("estado", event.target.value)} required value={form.estado}>
          <option value="">Selecione a UF</option>
          {BRAZILIAN_STATES.map((state) => (
            <option key={state} value={state}>{state}</option>
          ))}
        </select>
      </label>
    </div>
  );

  return (
    <main className={create ? "container page-content narrow-page" : "workspace-page business-settings-page"}>
      <UnsavedChangesGuard when={unsavedChanges} onDiscard={discardPendingOperations} onLeave={discardPendingOperations} />
      {create && (
        <BackLink to={selectedPlan ? "/planos" : "/"}>
          {selectedPlan ? "Voltar aos planos" : "Voltar ao início"}
        </BackLink>
      )}
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">{create ? "✨ Primeiro passo" : "Presença pública"}</p>
          <h1>{create ? "Crie seu negócio" : "Meu negócio"}</h1>
          <p>
            {create
              ? "Complete as informações do negócio e, em seguida, cadastre seu primeiro serviço. É só isso para colocar o perfil no ar."
              : "Esses dados ajudam clientes a encontrar, confiar e agendar com você."}
          </p>
        </div>
      </header>

      {create && (
        <FlowSteps
          ariaLabel="Etapas para publicar o negócio"
          current={1}
          steps={ACTIVATION_STEPS}
        />
      )}

      {create && (
        <section className="panel" aria-labelledby="business-create-guide-title">
          <p className="eyebrow"><span aria-hidden="true">💅</span>{" "}Negócio completo desde o início</p>
          <h2 id="business-create-guide-title">Preencha os dados essenciais do perfil</h2>
          <p className="muted">
            Dados completos melhoram descoberta, confiança e qualidade do catálogo. Descrição, foto e complemento são opcionais; os demais dados do perfil são necessários para criar o negócio.
          </p>
        </section>
      )}

      {!create && publication && (
        <section className={`panel publication-panel ${publication.publicado ? "publication-panel-live" : ""}`}>
          <div>
            <p className="eyebrow">Descoberta no Agenda Fashion</p>
            <h2>{publication.publicado ? "Seu negócio está visível para clientes" : "Seu negócio não está aparecendo na busca"}</h2>
            <p>
              {publication.publicado
                ? "Clientes podem encontrar seus serviços e acessar seu perfil público."
                : publication.oculto_manual
                  ? "Você ocultou este negócio. Ele continuará fora da busca e do perfil público até você escolher Mostrar na busca."
                  : "A publicação acontece automaticamente com os dados essenciais e pelo menos um serviço ativo. O AF já prepara uma sugestão de horários, que pode ser alterada depois."}
            </p>
            {!publication.pode_publicar && publication.pendencias.length > 0 && (
              <p className="publication-pending">
                Falta completar: {publication.pendencias.join(", ")}.
              </p>
            )}
          </div>
          <div className="publication-actions">
            {form.slug && (
              <Link className="button button-secondary" to={`/negocio/${encodeURIComponent(form.slug)}`}>
                Ver meu perfil público
              </Link>
            )}
            <button
              className={publication.publicado
                ? "button button-secondary business-publication-toggle is-danger"
                : "button business-publication-toggle"}
              disabled={mutationBusy || (!publication.publicado && !publication.pode_publicar)}
              onClick={togglePublication}
              type="button"
            >
              {publishing
                ? "Atualizando..."
                : publication.publicado
                  ? "Ocultar da busca"
                  : "Mostrar na busca"}
            </button>
          </div>
        </section>
      )}

      <form aria-busy={mutationBusy} className="panel stack-form business-settings-form" onSubmit={submit}>
        {!create && (
          <section className="business-form-section business-photo-section">
            <div className="business-form-heading">
              <p className="eyebrow">Foto</p>
              <h2>Imagem do negócio</h2>
              <p>Essa imagem aparece na busca, no perfil público e nos seus cards.</p>
            </div>
            <div className="business-photo-editor">
              <MediaThumb
                alt={`Foto do negócio ${form.nome || "Agenda Fashion"}`}
                className="business-photo-preview"
                src={form.foto_url}
              />
              <div className="business-photo-controls">
                <label className="button button-secondary button-small">
                  {photoUploading
                    ? "Enviando..."
                    : form.foto_url
                      ? "Trocar foto"
                      : "Adicionar foto"}
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={mutationBusy}
                    onChange={uploadPhoto}
                    type="file"
                  />
                </label>
                <small>JPG, PNG ou WEBP · até 5 MB.</small>
              </div>
            </div>
          </section>
        )}

        <section className="business-form-section">
          <div className="business-form-heading">
            <p className="eyebrow">Identidade</p>
            <h2>Como clientes encontram você</h2>
          </div>
          <div className="form-grid">
            <label className="field-wide">
              Nome do negócio
              <input disabled={saving || closingBusiness || closureUncertain || contextInvalid || creationUncertain || creationEnded} minLength="2" onChange={(event) => update("nome", event.target.value)} required value={form.nome} />
            </label>
            {!create && form.slug && (
              <div className="field-wide public-address-card" data-testid="public-address-hint">
                <div className="public-address-copy">
                  <span>Seu link público</span>
                  <strong>{publicUrl}</strong>
                  <small>Alterar o nome também atualiza este endereço. Links antigos continuam funcionando.</small>
                </div>
                <button className="button button-secondary button-small" onClick={copyPublicUrl} type="button">
                  Copiar link
                </button>
              </div>
            )}
            <label className="field-wide">
              Descrição (opcional)
              <textarea
                disabled={saving || closingBusiness || closureUncertain || contextInvalid || creationUncertain || creationEnded}
                maxLength="1000"
                onChange={(event) => update("descricao", event.target.value)}
                rows="4"
                value={form.descricao}
              />
              <small>
                Ajuda clientes a conhecerem seu trabalho, mas não impede a criação nem a publicação.
              </small>
            </label>
            <fieldset className="specialty-field field-wide" disabled={saving || closingBusiness || closureUncertain || contextInvalid || creationUncertain || creationEnded}>
              <legend>Especialidades</legend>
              <div className="specialty-heading-row">
                <p>Selecione tudo o que o negócio oferece.</p>
                <span>{form.areas.length} {form.areas.length === 1 ? "selecionada" : "selecionadas"}</span>
              </div>
              <div className="specialty-selector">
                {BUSINESS_SPECIALTIES.map(([value, label]) => (
                  <label className={form.areas.includes(value) ? "specialty-option selected" : "specialty-option"} key={value}>
                    <input
                      checked={form.areas.includes(value)}
                      onChange={() => toggleSpecialty(value)}
                      type="checkbox"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </section>

        <section className="business-form-section">
          <div className="business-form-heading">
            <p className="eyebrow">Contato</p>
            <h2>Como falar com o negócio</h2>
          </div>
          <div className="form-grid">
            <label>
              WhatsApp
              <input
                autoComplete="tel"
                disabled={saving || closingBusiness || closureUncertain || contextInvalid || creationUncertain || creationEnded}
                aria-invalid={whatsappError ? "true" : undefined}
                inputMode="tel"
                maxLength="15"
                onChange={(event) => update("whatsapp", formatWhatsApp(event.target.value))}
                placeholder="(00) 12345-6789"
                required={create}
                value={form.whatsapp}
              />
              <small className={whatsappError ? "field-helper is-error" : "field-helper"}>
                {whatsappError || (create
                  ? "Trouxemos o número da sua conta. Você pode trocar antes de continuar."
                  : "Usado para confirmações e contato das clientes.")}
              </small>
            </label>
            <label>
              Link do Google Maps
              <input
                aria-invalid={!locationValid ? "true" : undefined}
                disabled={saving || closingBusiness || closureUncertain || contextInvalid || creationUncertain || creationEnded}
                onChange={(event) => update("localizacao_url", event.target.value)}
                placeholder="https://maps.app.goo.gl/..."
                required={create}
                type="url"
                value={form.localizacao_url}
              />
              <span className="maps-field-helper">
                <small className={!locationValid ? "field-helper is-error" : "field-helper"}>
                  {!locationValid
                    ? "Use um link HTTP ou HTTPS válido."
                    : form.localizacao_url
                      ? "Link de localização válido."
                      : create
                        ? "Obrigatório na criação. Cole o link da localização no Google Maps."
                        : "Cole o link da localização no Google Maps."}
                </small>
                {locationValid && form.localizacao_url && (
                  <a href={form.localizacao_url} rel="noreferrer" target="_blank">Testar link ↗</a>
                )}
              </span>
            </label>
          </div>
        </section>

        <section className="business-form-section business-address-section">
          <div className="business-form-heading">
            <p className="eyebrow">Endereço</p>
            <h2>Onde acontece o atendimento</h2>
            <p>
              {create
                ? "Preencha os dados principais do endereço. O complemento é opcional, e o CEP ajuda a preencher parte dos dados automaticamente."
                : "Comece pelo CEP e complete os detalhes do local."}
            </p>
          </div>
          {addressFields}
        </section>

        {error && <p className="form-error business-form-feedback" role="alert">{error}</p>}
        {contextInvalid && <button className="button button-secondary" onClick={() => setLoadAttempt((attempt) => attempt + 1)} type="button">Atualizar Meu negócio</button>}
        {creationEnded && <Link className="button button-secondary" to="/">Voltar ao início</Link>}
        {!create && message && (
          <div className="business-save-toast" role="status">
            <ConfirmationIcon className="business-save-icon" />
            <span>{message}</span>
          </div>
        )}
        {create && message && <p className="form-success" role="status">{message}</p>}
        {(create || hasChanges || saving) && (
          <div className={create ? "form-actions business-save-actions" : "business-floating-save"}>
            <button className="button" disabled={saving || photoUploading || publishing || closingBusiness || closureUncertain || contextInvalid || creationEnded || cepLookup.status === "loading"} formNoValidate={creationUncertain} type="submit">
              {saving ? "Salvando..." : creationUncertain ? "Verificar negócio" : create ? "Criar negócio" : "Salvar alterações"}
            </button>
          </div>
        )}
      </form>

      {!create && (
        <section className="panel stack-form business-danger-zone">
          <div>
            <p className="eyebrow">Encerramento</p>
            <h2>Encerrar este negócio</h2>
            <p className="muted">
              O encerramento é permanente no fluxo normal. Antes de arquivar, o AF
              exige que agendamentos confirmados e pendências de cobrança estejam resolvidos.
            </p>
          </div>

          {closurePendings.length > 0 && (
            <div role="alert">
              <strong>Resolva antes de encerrar:</strong>
              <ul>
                {closurePendings.map((pending) => (
                  <li key={pending.codigo}>
                    {pending.mensagem}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            className="button button-secondary danger-text"
            disabled={saving || photoUploading || publishing || closingBusiness || contextInvalid || !savedForm.id}
            onClick={closeBusiness}
            type="button"
          >
            {closingBusiness ? "Verificando pendências..." : closureUncertain ? "Verificar encerramento" : "Encerrar negócio"}
          </button>
        </section>
      )}
    </main>
  );
}
