import { EMPTY_FORM, serviceForm, serviceBody, validateImage, samePhoto } from "../features/services/form";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams
} from "react-router-dom";
import { apiRequest } from "../api/client";
import { getBusinessContext, getPlanIntentPath, normalizePlanSlug } from "../auth/session";
import { useSession } from "../auth/SessionContext";
import { SetupFlowFrame, SetupTitle } from "../components/SetupFlowFrame";
import { BackLink } from "../components/BackLink";
import { ConfirmationIcon } from "../components/ConfirmationIcon";
import { ErrorState, LoadingState } from "../components/ScreenState";
import { UnsavedChangesGuard } from "../components/UnsavedChangesGuard";
import { MediaThumb } from "../components/profile/MediaThumb";
import { readServiceCreationReference, serviceCreationReferenceHash } from "../utils/serviceCreationReference";
import { SERVICE_CATEGORIES, extractServices, uncertainWrite } from "../utils/serviceCatalog";

// Preserva a importação existente do catálogo durante a separação dos módulos.
export { ServicesPage } from "./ServiceCatalogPage";

function operationKey(prefix) {
  const unique = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${unique}`;
}

async function uploadImage(path, file, key) {
  const body = new FormData();
  body.append("foto", file);
  return apiRequest(path, { method: "POST", body, ...(key ? { headers: { "Idempotency-Key": key } } : {}) });
}

export function ServiceEditorPage() {
  const session = useSession();
  const usuarioId = Number(session.usuario?.id) || 0;
  const negocioId = Number(getBusinessContext(session, "dono")?.id) || 0;
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedPlan = normalizePlanSlug(searchParams.get("plano"));
  const galleryRef = useRef(null);
  const galleryResourceRef = useRef(id);
  const editorContextRef = useRef(null);
  const operationRef = useRef(null);
  const creationAttemptRef = useRef(null);
  const creationReadRef = useRef(null);
  const uploadAttemptsRef = useRef(new Map());
  const uploadRecoveryRef = useRef(null);
  const mediaRecoveryRef = useRef(null);
  const editing = Boolean(id);
  const firstServiceOnboarding =
    !editing
    && (
      searchParams.get("onboarding") === "servico"
      || (
        location.state?.onboarding === true
        && location.state?.onboardingStep === "servico"
      )
    );
  const [form, setForm] = useState(EMPTY_FORM);
  const [savedForm, setSavedForm] = useState(EMPTY_FORM);
  const [cover, setCover] = useState(null);
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [persistedId, setPersistedId] = useState(id || "");
  const [loading, setLoading] = useState(() => editing || Boolean(
    readServiceCreationReference(location.hash, usuarioId, negocioId)
  ));
  const [loadError, setLoadError] = useState("");
  const [recoveryRemoved, setRecoveryRemoved] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [galleryLoading, setGalleryLoading] = useState(editing);
  const [galleryError, setGalleryError] = useState("");
  const [galleryLoadAttempt, setGalleryLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [creationUncertain, setCreationUncertain] = useState(false);
  const [galleryUncertain, setGalleryUncertain] = useState(false);
  const [mediaUncertain, setMediaUncertain] = useState(false);
  const [removingPhotoId, setRemovingPhotoId] = useState(null);
  const [definingCoverId, setDefiningCoverId] = useState(null);
  const [mediaMessage, setMediaMessage] = useState("");
  const [error, setError] = useState("");
  const fieldsDisabled = saving || creationUncertain || galleryUncertain || mediaUncertain;
  const mediaBusy = fieldsDisabled || Boolean(removingPhotoId) || Boolean(definingCoverId);
  const hasChanges = !loading && (
    JSON.stringify({ ...form, foto_url: "", foto_public_id: "" })
      !== JSON.stringify({ ...savedForm, foto_url: "", foto_public_id: "" })
    || Boolean(cover)
    || galleryFiles.length > 0
  );
  const coverPreview = useMemo(() => cover ? URL.createObjectURL(cover) : "", [cover]);
  const galleryItems = useMemo(() => {
    if (!form.foto_url || gallery.some((photo) => samePhoto(photo, form.foto_url, form.foto_public_id))) {
      return gallery;
    }

    return [
      {
        id: "current-cover",
        foto_url: form.foto_url,
        foto_public_id: form.foto_public_id,
        virtualCover: true
      },
      ...gallery
    ];
  }, [form.foto_public_id, form.foto_url, gallery]);

  useEffect(() => {
    const context = { id, usuarioId, negocioId, generation: 0 };
    editorContextRef.current = context;
    operationRef.current = null;
    creationAttemptRef.current = id ? null : readServiceCreationReference(location.hash, usuarioId, negocioId);
    creationReadRef.current?.abort();
    creationReadRef.current = null;
    uploadAttemptsRef.current = new Map();
    uploadRecoveryRef.current?.abort();
    uploadRecoveryRef.current = null;
    mediaRecoveryRef.current = null;
    setCreationUncertain(false);
    setGalleryUncertain(false);
    setMediaUncertain(false);
    setSaving(false);
    setRemovingPhotoId(null);
    setDefiningCoverId(null);

    return () => {
      if (editorContextRef.current === context) editorContextRef.current = null;
      creationReadRef.current?.abort();
      uploadRecoveryRef.current?.abort();
    };
  }, [id, usuarioId, negocioId]);

  function retainCreationReference(key) {
    const hash = serviceCreationReferenceHash(location.hash, key ? { key, usuarioId, negocioId } : null);
    navigate({ pathname: location.pathname, search: location.search, hash }, {
      replace: true, flushSync: true, state: location.state,
    });
  }

  function beginOperation() {
    // O lock vale antes de o React renderizar os controles desabilitados.
    if (operationRef.current || !editorContextRef.current) return null;
    const operation = {
      context: editorContextRef.current,
      generation: editorContextRef.current.generation,
    };
    operationRef.current = operation;
    return operation;
  }

  function isCurrentOperation(operation) {
    return editorContextRef.current === operation.context
      && operation.context.generation === operation.generation;
  }

  function discardPendingOperations() {
    // Suspense pode manter este editor montado enquanto o destino carrega.
    if (editorContextRef.current) editorContextRef.current.generation += 1;
    if (creationReadRef.current) {
      creationReadRef.current.abort();
      creationReadRef.current = null;
      setLoading(false);
      setRecoveryRemoved(false);
      setLoadError("A consulta do cadastro foi interrompida. Tente novamente para recuperar o serviço.");
    }
    uploadRecoveryRef.current?.abort();
    operationRef.current = null;
    setSaving(false);
    setRemovingPhotoId(null);
    setDefiningCoverId(null);
  }

  function finishOperation(operation) {
    if (operationRef.current === operation) operationRef.current = null;
  }

  useEffect(() => () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);

  useEffect(() => {
    if (!mediaMessage) return undefined;
    const timeoutId = window.setTimeout(() => setMediaMessage(""), 2800);
    return () => window.clearTimeout(timeoutId);
  }, [mediaMessage]);

  useEffect(() => {
    if (!editing) {
      setLoadError("");
      setRecoveryRemoved(false);
      setRecoveryMessage("");
      setForm(EMPTY_FORM);
      setSavedForm(EMPTY_FORM);
      setPersistedId("");
      setCover(null);
      setGalleryFiles([]);
      setError("");
      const attempt = creationAttemptRef.current;
      if (!attempt) {
        setLoading(false);
        return undefined;
      }

      const controller = new AbortController();
      creationReadRef.current = controller;
      const context = editorContextRef.current;
      const generation = context.generation;
      let active = true;
      const isCurrent = () => active && !controller.signal.aborted
        && editorContextRef.current === context && context.generation === generation;
      setLoading(true);
      apiRequest(`/servicos/tentativa?negocio_id=${encodeURIComponent(negocioId)}`, {
        headers: { "Idempotency-Key": attempt.key }, signal: controller.signal,
      }).then((result) => {
        if (!isCurrent()) return;
        if (result.estado === "nao_encontrada") {
          // Um POST antigo ainda pode chegar depois desta leitura. Conservar a
          // chave impede outra criação mesmo se os dados forem preenchidos de novo.
          setCreationUncertain(false);
          setRecoveryMessage("Ainda não há cadastro confirmado para esta tentativa. Preencha os dados para continuar com segurança.");
          return;
        }
        if (!result.servico?.id) throw new Error("Não foi possível recuperar o cadastro. Verifique novamente.");
        const confirmed = serviceForm(result.servico);
        flushSync(() => {
          setForm(confirmed);
          setSavedForm(confirmed);
          setPersistedId(String(result.servico.id));
        });
        if (!isCurrent()) return;
        if (firstServiceOnboarding) continueFirstServiceOnboarding(result);
        else navigate(`/painel/servicos/${encodeURIComponent(result.servico.id)}/editar`, { replace: true });
      }).catch((requestError) => {
        if (!isCurrent()) return;
        setLoadError(requestError.message);
        setRecoveryRemoved(Number(requestError.status) === 410);
      }).finally(() => {
        if (creationReadRef.current === controller) creationReadRef.current = null;
        if (isCurrent()) setLoading(false);
      });
      return () => { active = false; controller.abort(); };
    }

    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setLoadError("");
    apiRequest("/servicos", { signal: controller.signal })
      .then((servicesResult) => {
        if (!active) return;
        const service = extractServices(servicesResult).find((item) => Number(item.id) === Number(id));
        if (!service) throw new Error("Serviço não encontrado.");
        const loadedForm = serviceForm(service);
        setForm(loadedForm);
        setSavedForm(loadedForm);
        setPersistedId(id);
        setCover(null);
        setGalleryFiles([]);
        setError("");
      })
      .catch((requestError) => {
        if (active) setLoadError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [editing, id, usuarioId, negocioId, loadAttempt]);

  useEffect(() => {
    if (galleryResourceRef.current !== id) {
      galleryResourceRef.current = id;
      setGallery([]);
    }
    if (!editing) {
      setGalleryLoading(false);
      setGalleryError("");
      return undefined;
    }

    const controller = new AbortController();
    let active = true;
    const photosAtRequest = new Set(gallery.map((photo) => photo.id));
    setGalleryLoading(true);
    setGalleryError("");
    apiRequest(`/servicos/${encodeURIComponent(id)}/fotos`, { signal: controller.signal })
      .then((result) => {
        if (!active) return;
        const photos = Array.isArray(result) ? result : result?.fotos || [];
        const receivedIds = new Set(photos.map((photo) => photo.id));
        // Um upload pode terminar enquanto esta leitura opcional ainda está pendente.
        setGallery((current) => [
          ...photos,
          ...current.filter((photo) => !photosAtRequest.has(photo.id) && !receivedIds.has(photo.id))
        ]);
      })
      .catch((requestError) => {
        if (active) setGalleryError(requestError.message);
      })
      .finally(() => {
        if (active) setGalleryLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [editing, id, galleryLoadAttempt]);

  function isGalleryCover(photo) {
    return samePhoto(photo, form.foto_url, form.foto_public_id);
  }

  function scrollGallery(direction) {
    const scroller = galleryRef.current;
    if (!scroller) return;
    const distance = Math.max(210, Math.min((scroller.clientWidth || 320) * 0.85, 440));
    scroller.scrollBy?.({ left: direction * distance, behavior: "smooth" });
  }

  function selectCover(event) {
    if (operationRef.current) return;
    const file = event.target.files?.[0];
    if (!file) return;
    const validationError = validateImage(file);
    if (validationError) {
      setError(validationError);
      event.target.value = "";
      return;
    }
    setError("");
    setMediaMessage("");
    setCover(file);
    event.target.value = "";
  }

  function selectGallery(event) {
    if (operationRef.current) return;
    const files = Array.from(event.target.files || []);
    const validationError = files.map(validateImage).find(Boolean);
    if (validationError) {
      setError(validationError);
      event.target.value = "";
      return;
    }
    setError("");
    setMediaMessage("");
    setGalleryFiles((current) => {
      const pending = [...current];
      for (const file of files) {
        if (!pending.some((item) => item.name === file.name
          && item.size === file.size
          && item.type === file.type
          && item.lastModified === file.lastModified)) {
          pending.push(file);
        }
      }
      return pending;
    });
    event.target.value = "";
  }

  function continueFirstServiceOnboarding(saveResult) {
    if ((saveResult.servico?.ativo ?? form.ativo) === false) {
      navigate(getPlanIntentPath("/painel/servicos", selectedPlan), {
        replace: true,
        state: { message: "Serviço salvo como indisponível. Ative um serviço para continuar a publicação do perfil." }
      });
      return;
    }
    const published = saveResult.publicacao?.publicado === true;

    if (published) {
      // A sessão atual já contém o vínculo e o papel da dona. Atualizar o
      // marcador de publicação é útil, mas não pode bloquear Serviço → Horários
      // em uma falha ou lentidão transitória de /minha-sessao.
      session.refresh({ silent: true }).catch(() => {});
    }

    const destination = !published
      ? getPlanIntentPath("/painel/negocio", selectedPlan)
      : getPlanIntentPath("/painel/horarios", selectedPlan);

    navigate(destination, {
      replace: true,
      state: !published
        ? {
            message: "Serviço cadastrado. Revise os dados obrigatórios do negócio para concluir a publicação.",
            onboarding: true,
            onboardingStep: "perfil"
          }
        : {
            message: "Serviço cadastrado e perfil publicado. Agora confirme ou ajuste os horários sugeridos.",
            onboarding: true,
            onboardingStep: "agenda"
          }
    });
  }

  async function recoverGalleryUploads(operation, signal) {
    let removed = false;
    for (const [file, attempt] of uploadAttemptsRef.current) {
      if (!attempt.uncertain) continue;
      try {
        const result = await apiRequest(`/servicos/${attempt.servicoId}/fotos/tentativa`, {
          headers: { "Idempotency-Key": attempt.key },
          signal,
        });
        if (!isCurrentOperation(operation)) return;
        if (result.estado === "nao_encontrada") {
          // Conservar a chave: o envio original ainda pode concluir depois do GET.
          attempt.uncertain = false;
          continue;
        }
        if (!result.foto?.id) throw new Error("Não foi possível identificar a foto salva.");
        setGallery((current) => [...current.filter((photo) => photo.id !== result.foto.id), result.foto]);
      } catch (failure) {
        if (!isCurrentOperation(operation)) return;
        if (Number(failure.status) !== 410) throw failure;
        removed = true;
      }
      uploadAttemptsRef.current.delete(file);
      setGalleryFiles((current) => current.filter((item) => item !== file));
    }
    if (!isCurrentOperation(operation)) return;
    setGalleryUncertain(false);
    setMediaMessage(removed
      ? "A foto foi removida e não será reenviada. Selecione outra foto para continuar."
      : "Fotos conferidas. Se houver arquivos pendentes, salve para concluir o envio.");
  }

  async function recoverMediaState(operation, signal) {
    const [servicesResult, photosResult] = await Promise.all([
      apiRequest("/servicos", { signal }),
      apiRequest(`/servicos/${persistedId}/fotos`, { signal }),
    ]);
    if (!isCurrentOperation(operation)) return;
    const confirmed = extractServices(servicesResult).find(item => Number(item.id) === Number(persistedId));
    if (!confirmed) throw new Error("Serviço não encontrado. Volte aos serviços para continuar.");
    const photos = Array.isArray(photosResult) ? photosResult : photosResult?.fotos;
    if (!Array.isArray(photos)) throw new Error("Não foi possível confirmar as fotos atuais. Verifique novamente.");
    const patch = { foto_url: confirmed.foto_url || "", foto_public_id: confirmed.foto_public_id || "" };
    if (mediaRecoveryRef.current?.type === "cover" && samePhoto(mediaRecoveryRef.current.photo, patch.foto_url, patch.foto_public_id)) {
      setCover(null);
    }
    // Somente mídia é reconciliada: preço, descrição e demais rascunhos ficam intactos.
    setForm(current => ({ ...current, ...patch }));
    setSavedForm(current => ({ ...current, ...patch }));
    setGallery(photos);
    const pendingUpload = cover && mediaRecoveryRef.current?.type === "upload";
    mediaRecoveryRef.current = null;
    setMediaUncertain(false);
    setMediaMessage(pendingUpload
      ? "Capa atual conferida. Confira a galeria antes de salvar para substituí-la pela imagem selecionada."
      : "Fotos conferidas. Você pode continuar editando.");
  }

  async function submit(event) {
    event.preventDefault();
    if (loading || loadError) return;
    const operation = beginOperation();
    if (!operation) return;
    setSaving(true);
    setError("");
    setMediaMessage("");
    try {
      if (galleryUncertain || mediaUncertain) {
        const controller = new AbortController();
        uploadRecoveryRef.current = controller;
        try {
          if (mediaUncertain) await recoverMediaState(operation, controller.signal);
          else await recoverGalleryUploads(operation, controller.signal);
        }
        catch (failure) {
          if (isCurrentOperation(operation)) setError(`Não foi possível consultar o envio das fotos. ${failure.message}`);
        }
        finally {
          if (uploadRecoveryRef.current === controller) uploadRecoveryRef.current = null;
        }
        return;
      }
      let savedId = persistedId;
      let saveResult;
      try {
        const body = serviceBody(form);
        // Salvar sem alterações não regrava dados já confirmados. Outra
        // aba pode ter pausado ou editado o serviço desde o primeiro salvamento.
        const coreUnchanged = savedId
          && JSON.stringify(body) === JSON.stringify(serviceBody(savedForm));
        if (!savedId) {
          if (!usuarioId || !negocioId) throw Object.assign(new Error("Atualize sua sessão antes de cadastrar o serviço."), { status: 403 });
          if (!creationAttemptRef.current) {
            creationAttemptRef.current = { key: operationKey("servico") };
            retainCreationReference(creationAttemptRef.current.key);
          }
          if (!isCurrentOperation(operation)) return;
          creationAttemptRef.current.body ||= { ...body, negocio_id: negocioId };
        }
        if (!coreUnchanged) {
          saveResult = await apiRequest(savedId ? `/servicos/${savedId}` : "/servicos", {
            method: savedId ? "PUT" : "POST",
            ...(!savedId ? { headers: { "Idempotency-Key": creationAttemptRef.current.key } } : {}),
            body: savedId ? body : creationAttemptRef.current.body,
          });
          if (!isCurrentOperation(operation)) return;
          savedId = saveResult.servico?.id || savedId;
          if (!savedId) {
            throw new Error("O serviço foi salvo, mas não foi possível identificar o cadastro.");
          }
          setPersistedId(String(savedId));
          setCreationUncertain(false);
          creationAttemptRef.current = null;
          const confirmedForm = serviceForm(saveResult.servico || {}, form);
          flushSync(() => {
            setForm(confirmedForm);
            setSavedForm(confirmedForm);
          });
          if (!isCurrentOperation(operation)) return;
        } else {
          // Normalizar também o baseline local, para que diferenças apenas de
          // espaços ou formato numérico não bloqueiem a navegação de sucesso.
          const confirmedForm = serviceForm(body, form);
          flushSync(() => {
            setForm(confirmedForm);
            setSavedForm(confirmedForm);
          });
          if (!isCurrentOperation(operation)) return;
        }
      } catch (requestError) {
        if (isCurrentOperation(operation)) {
          if (!persistedId && requestError.data?.codigo === "SERVICO_TENTATIVA_DIVERGENTE") {
            creationAttemptRef.current = { key: creationAttemptRef.current.key };
            setLoadAttempt((attempt) => attempt + 1);
            return;
          }
          if (!persistedId && Number(requestError.status) === 410) {
            setLoadError(requestError.message);
            setRecoveryRemoved(true);
            return;
          }
          const uncertain = !persistedId && uncertainWrite(requestError);
          setCreationUncertain(uncertain);
          if (!uncertain && !persistedId) {
            creationAttemptRef.current = null;
            retainCreationReference(null);
          }
          setError(uncertain
            ? "Não foi possível confirmar o cadastro. Verifique novamente para recuperar esta tentativa antes de alterar os dados."
            : requestError.message);
        }
        return;
      }

      try {
        if (cover) {
          let uploaded;
          try { uploaded = await uploadImage(`/servicos/${savedId}/foto`, cover); }
          catch (failure) {
            if (isCurrentOperation(operation) && uncertainWrite(failure)) {
              mediaRecoveryRef.current = { type: "upload" };
              setMediaUncertain(true);
            }
            throw failure;
          }
          if (!isCurrentOperation(operation)) return;
          if (uploaded.servico) {
            const coverPatch = {
              foto_url: uploaded.servico.foto_url || "",
              foto_public_id: uploaded.servico.foto_public_id || ""
            };
            setForm((current) => ({ ...current, ...coverPatch }));
            setSavedForm((current) => ({ ...current, ...coverPatch }));
          }
          setCover(null);
        }
        for (const file of galleryFiles) {
          let attempt = uploadAttemptsRef.current.get(file);
          if (!attempt) {
            attempt = { key: operationKey("foto"), servicoId: savedId, uncertain: false };
            uploadAttemptsRef.current.set(file, attempt);
          }
          let uploaded;
          try { uploaded = await uploadImage(`/servicos/${savedId}/fotos`, file, attempt.key); }
          catch (failure) {
            if (!isCurrentOperation(operation)) return;
            if (uncertainWrite(failure)) {
              attempt.uncertain = true;
              setGalleryUncertain(true);
            } else if (Number(failure.status) === 410) {
              uploadAttemptsRef.current.delete(file);
              setGalleryFiles((current) => current.filter((item) => item !== file));
            }
            throw failure;
          }
          if (!isCurrentOperation(operation)) return;
          if (uploaded.foto) {
            setGallery((current) => [...current.filter((photo) => photo.id !== uploaded.foto.id), uploaded.foto]);
          }
          setGalleryFiles((current) => current.filter((item) => item !== file));
          uploadAttemptsRef.current.delete(file);
        }
      } catch (requestError) {
        if (isCurrentOperation(operation)) {
          setError(mediaRecoveryRef.current?.type === "upload"
            ? `O serviço foi salvo, mas não foi possível confirmar o envio da capa. ${requestError.message} Verifique as fotos antes de continuar.`
            : `O serviço foi salvo, mas algumas fotos não foram enviadas. ${requestError.message} Tente novamente para enviar apenas as fotos pendentes.`);
        }
        return;
      }

      flushSync(() => {
        setCover(null);
        setGalleryFiles([]);
      });
      if (!isCurrentOperation(operation)) return;
      if (firstServiceOnboarding) {
        try {
          // Após uma falha de mídia, o núcleo já está salvo. Revalidar a
          // publicação sem repetir a criação ou sobrescrever outra aba.
          const result = saveResult || await apiRequest("/configuracoes", {
            headers: { "X-AF-Negocio": String(negocioId) }
          });
          if (isCurrentOperation(operation)) continueFirstServiceOnboarding(result);
        } catch (failure) {
          if (isCurrentOperation(operation)) setError(`Serviço salvo. Não foi possível confirmar a publicação. ${failure.message} Tente novamente.`);
        }
        return;
      }
      navigate("/painel/servicos", {
        replace: true,
        state: {
          message: editing
            ? "Serviço atualizado."
            : "Serviço criado."
        }
      });
    } finally {
      if (isCurrentOperation(operation)) {
        finishOperation(operation);
        setSaving(false);
      }
    }
  }

  async function chooseGalleryCover(photo) {
    if (!persistedId || mediaBusy || galleryLoading || isGalleryCover(photo) || photo.virtualCover) return;
    const operation = beginOperation();
    if (!operation) return;

    setDefiningCoverId(photo.id);
    setError("");
    setMediaMessage("");

    try {
      const result = await apiRequest(`/servicos/${persistedId}/capa`, {
        method: "PUT",
        body: { foto_id: photo.id }
      });
      if (!isCurrentOperation(operation)) return;
      const service = result.servico || {};
      const coverPatch = {
        foto_url: service.foto_url || photo.foto_url || "",
        foto_public_id: service.foto_public_id || photo.foto_public_id || ""
      };
      setCover(null);
      setForm((current) => ({ ...current, ...coverPatch }));
      setSavedForm((current) => ({ ...current, ...coverPatch }));
      setMediaMessage("Foto escolhida como capa do serviço.");
    } catch (requestError) {
      if (isCurrentOperation(operation)) {
        if (uncertainWrite(requestError) || Number(requestError.status || requestError.statusCode) === 404) {
          mediaRecoveryRef.current = { type: "cover", photo };
          setMediaUncertain(true);
        }
        setError(requestError.message);
      }
    } finally {
      if (isCurrentOperation(operation)) {
        finishOperation(operation);
        setDefiningCoverId(null);
      }
    }
  }

  async function removeGalleryPhoto(photo) {
    if (mediaBusy || galleryLoading || photo.virtualCover) return;
    const operation = beginOperation();
    if (!operation) return;
    const wasCover = isGalleryCover(photo);
    setRemovingPhotoId(photo.id);
    setError("");
    setMediaMessage("");
    try {
      const result = await apiRequest(`/servicos/fotos/${photo.id}`, { method: "DELETE" });
      if (!isCurrentOperation(operation)) return;
      setGallery((current) => current.filter((item) => item.id !== photo.id));
      if (wasCover || result.capa_removida) {
        setForm((current) => ({ ...current, foto_url: "", foto_public_id: "" }));
        setSavedForm((current) => ({ ...current, foto_url: "", foto_public_id: "" }));
        setMediaMessage("A foto foi removida. Escolha outra imagem para a capa.");
      } else {
        setMediaMessage("Foto removida da galeria.");
      }
    } catch (requestError) {
      if (isCurrentOperation(operation)) {
        if (uncertainWrite(requestError) || Number(requestError.status || requestError.statusCode) === 404) {
          mediaRecoveryRef.current = { type: "remove" };
          setMediaUncertain(true);
        }
        setError(requestError.message);
      }
    } finally {
      if (isCurrentOperation(operation)) {
        finishOperation(operation);
        setRemovingPhotoId(null);
      }
    }
  }

  if (loading) return <main className="workspace-page"><UnsavedChangesGuard onLeave={discardPendingOperations} /><LoadingState>Carregando serviço...</LoadingState></main>;
  if (loadError) return <main className="workspace-page"><UnsavedChangesGuard onLeave={discardPendingOperations} /><BackLink to="/painel/servicos">Voltar aos serviços</BackLink><ErrorState message={loadError} onRetry={recoveryRemoved ? undefined : () => setLoadAttempt((attempt) => attempt + 1)} /></main>;

  return (
    <SetupFlowFrame enabled={firstServiceOnboarding} exitTo="/painel" step={3}>
    <main className="workspace-page service-editor-page">
      <UnsavedChangesGuard when={hasChanges} onDiscard={discardPendingOperations} onLeave={discardPendingOperations} />
      <div>
        {!firstServiceOnboarding && <BackLink to="/painel/servicos">Voltar aos serviços</BackLink>}
        <header className="workspace-heading">
          <div>
            <SetupTitle emoji={firstServiceOnboarding ? "💅" : undefined}>{editing ? "Editar serviço" : "Novo serviço"}</SetupTitle>
            <p>
              Qual cuidado você vai oferecer?
            </p>
          </div>
        </header>
      </div>

      <form aria-busy={saving} aria-label="Dados do serviço" className="service-editor-grid" onSubmit={submit}>
        <section className="panel stack-form">
          <label>
            Nome do serviço
            <input disabled={fieldsDisabled} minLength="2" onChange={(event) => setForm({ ...form, nome: event.target.value })} required value={form.nome} />
          </label>
          <label>
            Categoria
            <select
              disabled={fieldsDisabled}
              onChange={(event) => setForm({ ...form, categoria: event.target.value })}
              required
              value={form.categoria}
            >
              <option value="">Selecione a categoria</option>
              {SERVICE_CATEGORIES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Descrição (opcional)
            <textarea
              disabled={fieldsDisabled}
              maxLength="1200"
              onChange={(event) => setForm({ ...form, descricao: event.target.value })}
              placeholder="Explique o resultado, materiais ou diferenciais."
              rows="3"
              value={form.descricao}
            />
            <small>{form.descricao.length}/1200 caracteres</small>
          </label>
          <div className="form-grid">
            <label>
              Valor (R$)
              <input disabled={fieldsDisabled} inputMode="decimal" min="0" onChange={(event) => setForm({ ...form, valor: event.target.value })} required step="0.01" type="number" value={form.valor} />
            </label>
            <label>
              Duração em minutos
              <input disabled={fieldsDisabled} inputMode="numeric" min="5" onChange={(event) => setForm({ ...form, duracao_minutos: event.target.value })} required step="5" type="number" value={form.duracao_minutos} />
            </label>
          </div>
          <label className="switch-field">
            <input checked={form.ativo} disabled={fieldsDisabled} onChange={(event) => setForm({ ...form, ativo: event.target.checked })} type="checkbox" />
            <span><strong>Serviço disponível</strong><small>Quando inativo, ele não aparece para novos agendamentos.</small></span>
          </label>
        </section>

        <section className="panel stack-form service-media-panel">
          <div>
            <h2>Fotos do serviço</h2>
            <p className="muted service-media-help">Mostre seu talento. Fotos são opcionais.</p>
          </div>

          <div className="service-cover-section">
            <div className="service-media-section-heading">
              <strong>Capa do serviço</strong>
            </div>
            <div className="cover-upload">
              <div className="cover-preview">
                {coverPreview
                  ? <img alt="Prévia da nova capa" src={coverPreview} />
                  : form.foto_url
                    ? <MediaThumb alt={`Capa atual do serviço ${form.nome}`} className="editor-media" emoji="📷" src={form.foto_url} />
                    : <span><strong aria-hidden="true" className="native-emoji">📷</strong>Adicione uma foto de capa</span>}
              </div>
              <label className="button button-secondary button-small">
                {cover ? "Trocar imagem escolhida" : form.foto_url ? "Trocar capa" : "Escolher capa"}
                <input accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={mediaBusy} onChange={selectCover} type="file" />
              </label>
            </div>
          </div>

          <div className="service-gallery-upload">
            <div className="service-gallery-upload-copy">
              <strong>Adicionar fotos à galeria</strong>
              <small>JPG, PNG ou WEBP · até 5 MB por foto.</small>
            </div>
            <label className="button button-secondary button-small service-gallery-upload-button">
              <span aria-hidden="true">＋</span> Adicionar fotos
              <input
                accept="image/jpeg,image/png,image/webp"
                aria-label="Adicionar fotos à galeria"
                className="sr-only"
                disabled={mediaBusy}
                multiple
                onChange={selectGallery}
                type="file"
              />
            </label>
          </div>
          {galleryFiles.length > 0 && (
            <p className="upload-selection">{galleryFiles.length} {galleryFiles.length === 1 ? "foto selecionada" : "fotos selecionadas"}.</p>
          )}
          {mediaMessage && <p className="service-media-success" role="status">{mediaMessage}</p>}
          {galleryLoading && <p className="muted" role="status">Carregando fotos...</p>}
          {galleryError && (
            <div className="service-gallery-error">
              <p className="form-error" role="alert">Não foi possível carregar a galeria. {galleryError}</p>
              <button className="button button-secondary button-small" disabled={mediaBusy} onClick={() => setGalleryLoadAttempt((attempt) => attempt + 1)} type="button">
                Tentar carregar fotos novamente
              </button>
            </div>
          )}
          {galleryItems.length > 0 && (
            <div className="service-gallery-picker-wrap">
              <div className="service-gallery-heading">
                <div>
                  <strong>Galeria atual</strong>
                  <small>{galleryItems.length} {galleryItems.length === 1 ? "foto" : "fotos"}</small>
                </div>
                {galleryItems.length > 1 && (
                  <div className="service-gallery-nav" aria-label="Navegação da galeria">
                    <button aria-label="Fotos anteriores" onClick={() => scrollGallery(-1)} type="button">‹</button>
                    <button aria-label="Próximas fotos" onClick={() => scrollGallery(1)} type="button">›</button>
                  </div>
                )}
              </div>
              <div className="service-gallery service-gallery-picker" aria-label="Galeria atual" ref={galleryRef}>
                {galleryItems.map((photo) => {
                  const currentCover = isGalleryCover(photo);
                  const choosing = definingCoverId === photo.id;
                  return (
                    <figure className={currentCover ? "is-cover" : ""} key={photo.id}>
                      <div className="service-gallery-media">
                        <MediaThumb alt={`Foto da galeria de ${form.nome}`} className="editor-media" emoji="📷" src={photo.foto_url} />
                        {!photo.virtualCover && (
                          <button
                            aria-label="Remover foto da galeria"
                            className="service-gallery-remove"
                            disabled={mediaBusy || galleryLoading}
                            onClick={() => removeGalleryPhoto(photo)}
                            title="Remover foto"
                            type="button"
                          >
                            {removingPhotoId === photo.id ? "…" : "×"}
                          </button>
                        )}
                      </div>
                      <figcaption>
                        {currentCover ? (
                          <span className="service-cover-current-label">
                            <ConfirmationIcon className="service-cover-badge-icon" />
                            <span>Capa atual</span>
                          </span>
                        ) : (
                          <button
                            className="service-cover-choice"
                            disabled={mediaBusy || galleryLoading}
                            onClick={() => chooseGalleryCover(photo)}
                            type="button"
                          >
                            {choosing ? "Escolhendo..." : "Usar como capa"}
                          </button>
                        )}
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            </div>
          )}
        </section>
        {recoveryMessage && <p className="service-editor-message" role="status">{recoveryMessage}</p>}
        {error && <p className="form-error service-editor-message" role="alert">{error}</p>}
        <div className="form-actions service-editor-actions">
          <Link className="button button-secondary" to="/painel/servicos">Cancelar</Link>
          <button className="button" disabled={saving || Boolean(removingPhotoId) || Boolean(definingCoverId)} formNoValidate={galleryUncertain || mediaUncertain || creationUncertain} type="submit">
            {saving
              ? "Salvando..."
              : galleryUncertain || mediaUncertain
                ? "Verificar fotos"
                : creationUncertain
                ? "Verificar cadastro"
                : "Salvar serviço"}
          </button>
        </div>
      </form>
    </main>
    </SetupFlowFrame>
  );
}
