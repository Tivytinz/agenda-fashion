import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useSession } from "../auth/SessionContext";
import { normalizePlanSlug, safeInternalPath } from "../auth/session";
import { BackLink } from "../components/BackLink";
import { ConfirmationIcon } from "../components/ConfirmationIcon";
import { ErrorState, LoadingState } from "../components/ScreenState";
import { MediaThumb } from "../components/profile/MediaThumb";
import { formatCep, formatWhatsApp } from "../utils/format";
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
const SCHEDULE_PUBLICATION_PENDING =
  "confirmar os horários de atendimento";

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

function isValidGoogleMapsUrl(value) {
  if (!String(value || "").trim()) return true;

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return host === "maps.app.goo.gl"
      || host === "maps.google.com"
      || host.endsWith(".maps.google.com")
      || (host === "google.com" && url.pathname.startsWith("/maps"))
      || (host.endsWith(".google.com") && url.pathname.startsWith("/maps"))
      || (host === "goo.gl" && url.pathname.startsWith("/maps"));
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
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const selectedPlan = normalizePlanSlug(searchParams.get("plano"));
  const [form, setForm] = useState(EMPTY);
  const [savedForm, setSavedForm] = useState(EMPTY);
  const [loading, setLoading] = useState(!create);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(() => location.state?.message || "");
  const [publication, setPublication] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [cepLookup, setCepLookup] = useState({ status: "idle", message: "" });
  const cepRequestRef = useRef(0);

  const hasChanges = !create
    && serializeBusinessForm(form) !== serializeBusinessForm(savedForm);
  const publicUrl = form.slug
    ? `https://app.agendafashion.com.br/negocio/${form.slug}`
    : "";
  const googleMapsValid = isValidGoogleMapsUrl(form.localizacao_url);
  const whatsappError = validateWhatsApp(form.whatsapp);

  useEffect(() => {
    if (!create) return;
    const accountWhatsapp = formatWhatsApp(session.usuario?.whatsapp);
    if (!accountWhatsapp) return;

    setForm((current) => current.whatsapp
      ? current
      : { ...current, whatsapp: accountWhatsapp });
  }, [create, session.usuario?.whatsapp]);

  useEffect(() => {
    if (create) return;

    apiRequest("/configuracoes")
      .then((result) => {
        const business = result.negocio || result.configuracoes || {};
        const normalized = normalizeBusinessForm(business);
        setForm(normalized);
        setSavedForm(normalized);
        setPublication(result.publicacao || {
          publicado: business.publicado === true,
          pode_publicar: false,
          pendencias: []
        });
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [create]);

  useEffect(() => {
    if (!message) return undefined;
    const timeout = window.setTimeout(() => setMessage(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    if (!hasChanges || saving) return undefined;

    const preventAccidentalExit = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", preventAccidentalExit);
    return () => window.removeEventListener("beforeunload", preventAccidentalExit);
  }, [hasChanges, saving]);

  useEffect(() => {
    if (create || loading) return;

    const cepDigits = String(form.cep || "").replace(/\D/g, "");
    if (cepDigits.length === 8 && !String(form.endereco || "").trim()) {
      lookupCep(cepDigits, { syncBaseline: true });
    }
  }, [create, loading]);

  function update(field, value) {
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
    setCepLookup({ status: "loading", message: "Buscando endereço..." });

    try {
      const result = await apiRequest(`/cep/${cepDigits}`, {
        timeoutMs: 6000
      });
      if (requestId !== cepRequestRef.current) return;

      const addressPatch = {
        endereco: result.endereco || "",
        bairro: result.bairro || "",
        cidade: result.cidade || "",
        estado: result.estado || ""
      };

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
      await navigator.clipboard.writeText(publicUrl);
      setMessage("Link público copiado.");
    } catch {
      setError("Não foi possível copiar o link automaticamente.");
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

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

    if (!googleMapsValid) {
      setError("Informe um link válido do Google Maps.");
      return;
    }

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
      const result = await apiRequest(create ? "/criar-negocio" : "/configuracoes", {
        method: create ? "POST" : "PUT",
        body: payload
      });
      const savedBusiness = result.negocio || {};
      const normalizedSaved = normalizeBusinessForm({
        ...form,
        ...savedBusiness,
        areas: savedBusiness.areas || form.areas
      });
      setForm(normalizedSaved);
      if (!create) setSavedForm(normalizedSaved);
      setMessage(result.mensagem || (create ? "Negócio criado." : "Alterações salvas."));
      if (result.publicacao) setPublication(result.publicacao);
      await session.refresh();
      if (create) {
        const requestedPath = safeInternalPath(location.state?.from);

        if (selectedPlan) {
          navigate(
            `/checkout?plano=${encodeURIComponent(selectedPlan)}`,
            { replace: true }
          );
        } else if (requestedPath) {
          navigate(requestedPath, { replace: true });
        } else {
          navigate("/painel/servicos/novo", {
            replace: true,
            state: {
              onboarding: true,
              onboardingStep: "servico"
            }
          });
        }
      } else if (
        location.state?.onboarding === true
        && location.state?.onboardingStep === "perfil"
      ) {
        const pending = Array.isArray(result.publicacao?.pendencias)
          ? result.publicacao.pendencias
          : [];
        const profilePending = pending.filter(
          (item) => ![
            SERVICE_PUBLICATION_PENDING,
            SCHEDULE_PUBLICATION_PENDING
          ].includes(item)
        );

        if (profilePending.length === 0) {
          const servicePending = pending.includes(
            SERVICE_PUBLICATION_PENDING
          );
          const schedulePending = pending.includes(
            SCHEDULE_PUBLICATION_PENDING
          );
          const destination = servicePending
            ? "/painel/servicos/novo"
            : schedulePending
              ? "/painel/horarios"
              : "/painel";

          navigate(destination, {
            state: servicePending
              ? { onboarding: true, onboardingStep: "servico" }
              : schedulePending
                ? {
                    message:
                      "Dados essenciais concluídos. Agora confirme seus horários para publicar o negócio.",
                    onboarding: true,
                    onboardingStep: "agenda"
                  }
              : {
                  message: result.publicacao?.publicado
                    ? "Dados essenciais concluídos. Seu negócio está publicado."
                    : "Dados essenciais concluídos. Estamos atualizando sua publicação.",
                  onboardingCompleted: result.publicacao?.publicado === true
                }
          });
        }
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validateImage(file);
    if (validationError) {
      setError(validationError);
      event.target.value = "";
      return;
    }

    setPhotoUploading(true);
    setError("");
    setMessage("");
    const body = new FormData();
    body.append("foto", file);

    try {
      const result = await apiRequest("/configuracoes/foto", {
        method: "POST",
        body
      });
      const business = result.negocio || {};
      if (business.foto_url !== undefined) {
        setForm((current) => ({ ...current, foto_url: business.foto_url }));
        setSavedForm((current) => ({ ...current, foto_url: business.foto_url }));
      }
      if (result.publicacao) setPublication(result.publicacao);
      setMessage(result.mensagem || "Foto do negócio atualizada.");
      await session.refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPhotoUploading(false);
      event.target.value = "";
    }
  }

  async function togglePublication() {
    const nextPublished = !publication?.publicado;

    if (
      publication?.publicado
      && !window.confirm(
        "Retirar o negócio da página inicial? Seu perfil público continuará disponível pelo link direto."
      )
    ) {
      return;
    }

    setPublishing(true);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest("/configuracoes/publicacao", {
        method: "PATCH",
        body: { publicado: nextPublished }
      });
      setPublication(result.publicacao);
      setMessage(result.mensagem);
      await session.refresh();
      if (
        nextPublished
        && location.state?.onboarding === true
        && location.state?.onboardingStep === "publicacao"
      ) {
        navigate("/painel", { replace: true });
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPublishing(false);
    }
  }

  if (loading) return <div className="workspace-page"><LoadingState>Carregando negócio...</LoadingState></div>;
  if (error && !form.nome && !create) return <div className="workspace-page"><ErrorState message={error} /></div>;

  const addressFields = (
    <div className="form-grid business-address-grid">
      <label className="business-cep-field">
        CEP
        <input
          aria-busy={cepLookup.status === "loading" ? "true" : undefined}
          aria-invalid={cepLookup.status === "error" ? "true" : undefined}
          autoComplete="postal-code"
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
        <input autoComplete="street-address" onChange={(event) => update("endereco", event.target.value)} required={create} value={form.endereco} />
      </label>
      <label>
        Número
        <input onChange={(event) => update("numero", event.target.value)} required={create} value={form.numero} />
      </label>
      <label>
        {create ? "Complemento (opcional)" : "Complemento"}
        <input onChange={(event) => update("complemento", event.target.value)} value={form.complemento} />
      </label>
      <label>
        Bairro
        <input onChange={(event) => update("bairro", event.target.value)} required={create} value={form.bairro} />
      </label>
      <label>
        Cidade
        <input onChange={(event) => update("cidade", event.target.value)} required={create} value={form.cidade} />
      </label>
      <label>
        Estado
        <select aria-label="Estado" onChange={(event) => update("estado", event.target.value)} required value={form.estado}>
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
              ? "Complete as informações do negócio para começar com um perfil consistente. Depois, cadastre o primeiro serviço."
              : "Esses dados ajudam clientes a encontrar, confiar e agendar com você."}
          </p>
        </div>
      </header>

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
            <p className="eyebrow">Visibilidade na página inicial</p>
            <h2>{publication.publicado ? "Seu negócio está publicado" : "Seu negócio ainda não está publicado"}</h2>
            <p>
              {publication.publicado
                ? "Clientes podem encontrar seus serviços e acessar seu perfil público."
                : form.publicacao_exige_agenda
                  ? "A publicação acontece automaticamente depois de confirmar os dados essenciais, um serviço ativo e os horários de atendimento."
                  : "A publicação acontece automaticamente com os dados essenciais e um serviço ativo."}
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
              disabled={publishing || (!publication.publicado && !publication.pode_publicar)}
              onClick={togglePublication}
              type="button"
            >
              {publishing
                ? "Atualizando..."
                : publication.publicado
                  ? "Retirar da página inicial"
                  : "Publicar meu negócio"}
            </button>
          </div>
        </section>
      )}

      <form className="panel stack-form business-settings-form" onSubmit={submit}>
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
                    disabled={photoUploading}
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
              <input minLength="2" onChange={(event) => update("nome", event.target.value)} required value={form.nome} />
            </label>
            {!create && form.slug && (
              <div className="field-wide public-address-card" data-testid="public-address-hint">
                <div className="public-address-copy">
                  <span>Seu link público</span>
                  <strong>app.agendafashion.com.br/negocio/{form.slug}</strong>
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
                maxLength="1000"
                onChange={(event) => update("descricao", event.target.value)}
                rows="4"
                value={form.descricao}
              />
              <small>
                Ajuda clientes a conhecerem seu trabalho, mas não impede a criação nem a publicação.
              </small>
            </label>
            <fieldset className="specialty-field field-wide">
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
                aria-invalid={!googleMapsValid ? "true" : undefined}
                onChange={(event) => update("localizacao_url", event.target.value)}
                placeholder="https://maps.app.goo.gl/..."
                required={create}
                type="url"
                value={form.localizacao_url}
              />
              <span className="maps-field-helper">
                <small className={!googleMapsValid ? "field-helper is-error" : "field-helper"}>
                  {!googleMapsValid
                    ? "Use um link válido do Google Maps."
                    : form.localizacao_url
                      ? "Link válido do Google Maps."
                      : create
                        ? "Obrigatório na criação. Cole o link da localização no Google Maps."
                        : "Cole o link da localização no Google Maps."}
                </small>
                {googleMapsValid && form.localizacao_url && (
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
        {!create && message && (
          <div className="business-save-toast" role="status">
            <ConfirmationIcon className="business-save-icon" />
            <span>{message}</span>
          </div>
        )}
        {create && message && <p className="form-success" role="status">{message}</p>}
        {(create || hasChanges || saving) && (
          <div className={create ? "form-actions business-save-actions" : "business-floating-save"}>
            <button className="button" disabled={saving || photoUploading} type="submit">
              {saving ? "Salvando..." : create ? "Criar negócio" : "Salvar alterações"}
            </button>
          </div>
        )}
      </form>
    </main>
  );
}
