import { readServiceMedia, reconcileGalleryUploads } from "./mediaRecovery";
import { EMPTY_FORM, serviceForm, serviceBody, validateImage, samePhoto } from "./form";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiRequest } from "../../api/client";
import { getBusinessContext, getPlanIntentPath, normalizePlanSlug } from "../../auth/session";
import { useSession } from "../../auth/SessionContext";
import { readServiceCreationReference, serviceCreationReferenceHash } from "../../utils/serviceCreationReference";
import { extractServices, uncertainWrite } from "../../utils/serviceCatalog";

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

// Coordena estado, operações e recuperação; a página mantém a apresentação.
export function useServiceEditor() {
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
    const result = await reconcileGalleryUploads({
      attempts: uploadAttemptsRef.current, signal,
      isCurrent: () => isCurrentOperation(operation),
      confirmPhoto: photo => setGallery(current => [...current.filter(item => item.id !== photo.id), photo]),
      resolveFile: file => setGalleryFiles(current => current.filter(item => item !== file)),
    });
    if (!result) return;
    const { removed } = result;
    setGalleryUncertain(false);
    setMediaMessage(removed
      ? "A foto foi removida e não será reenviada. Selecione outra foto para continuar."
      : "Fotos conferidas. Se houver arquivos pendentes, salve para concluir o envio.");
  }

  async function recoverMediaState(operation, signal) {
    const result = await readServiceMedia({ id: persistedId, signal, isCurrent: () => isCurrentOperation(operation) });
    if (!result) return;
    const { patch, photos } = result;
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

  return {
    galleryRef,
    editing,
    firstServiceOnboarding,
    form,
    setForm,
    cover,
    galleryFiles,
    loading,
    loadError,
    recoveryRemoved,
    recoveryMessage,
    setLoadAttempt,
    galleryLoading,
    galleryError,
    setGalleryLoadAttempt,
    saving,
    creationUncertain,
    galleryUncertain,
    mediaUncertain,
    removingPhotoId,
    definingCoverId,
    mediaMessage,
    error,
    fieldsDisabled,
    mediaBusy,
    hasChanges,
    galleryItems,
    discardPendingOperations,
    isGalleryCover,
    scrollGallery,
    selectCover,
    selectGallery,
    submit,
    chooseGalleryCover,
    removeGalleryPhoto
  };
}
