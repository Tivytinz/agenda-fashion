import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useSession } from "../auth/SessionContext";
import { normalizePlanSlug, safeInternalPath } from "../auth/session";
import { BackLink } from "../components/BackLink";
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

function validateImage(file) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Use uma imagem JPG, PNG ou WEBP.";
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return "A imagem deve ter no máximo 5 MB.";
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
  const [loading, setLoading] = useState(!create);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(() => location.state?.message || "");
  const [publication, setPublication] = useState(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (create) return;

    apiRequest("/configuracoes")
      .then((result) => {
        const business = result.negocio || result.configuracoes || {};
        setForm({
          ...EMPTY,
          ...business,
          whatsapp: formatWhatsApp(
            business.whatsapp || business.whatsapp_negocio
          ),
          cep: formatCep(business.cep),
          areas: normalizeBusinessSpecialties(business)
        });
        setPublication(result.publicacao || {
          publicado: business.publicado === true,
          pode_publicar: false,
          pendencias: []
        });
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [create]);

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

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (form.areas.length === 0) {
      setError("Selecione ao menos uma especialidade.");
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

    // O endereço público é derivado do nome pelo backend. Não envie o slug
    // carregado anteriormente, pois isso faria uma troca de nome conservar
    // um endereço desatualizado.
    delete payload.slug;
    // O backend aceita whatsapp_negocio apenas como alias legado. Não envie
    // a cópia carregada anteriormente, pois ela pode sobrescrever o valor
    // atual do campo canônico whatsapp.
    delete payload.whatsapp_negocio;

    try {
      const result = await apiRequest(create ? "/criar-negocio" : "/configuracoes", {
        method: create ? "POST" : "PUT",
        body: payload
      });
      const savedBusiness = result.negocio || {};
      setForm((current) => ({
        ...current,
        ...savedBusiness,
        whatsapp: formatWhatsApp(
          savedBusiness.whatsapp || savedBusiness.whatsapp_negocio || current.whatsapp
        ),
        cep: formatCep(savedBusiness.cep || current.cep),
        areas: normalizeBusinessSpecialties({
          ...current,
          ...savedBusiness,
          areas: savedBusiness.areas || current.areas
        })
      }));
      setMessage(result.mensagem || (create ? "Negócio criado." : "Alterações salvas."));
      if (result.publicacao) setPublication(result.publicacao);
      await session.refresh();
      if (create) {
        const requestedPath = safeInternalPath(location.state?.from);
        const destination = selectedPlan
          ? `/checkout?plano=${encodeURIComponent(selectedPlan)}`
          : requestedPath || "/painel";
        navigate(destination, { replace: true });
      } else if (
        location.state?.onboarding === true
        && location.state?.onboardingStep === "perfil"
      ) {
        const pending = Array.isArray(result.publicacao?.pendencias)
          ? result.publicacao.pendencias
          : [];
        const profilePending = pending.filter(
          (item) => item !== "pelo menos um serviço ativo"
        );

        if (profilePending.length === 0) {
          const servicePending = pending.includes("pelo menos um serviço ativo");
          navigate(servicePending ? "/painel/servicos/novo" : "/painel", {
            state: servicePending
              ? { onboarding: true, onboardingStep: "servico" }
              : {
                  message: result.publicacao?.publicado
                    ? "Dados essenciais concluídos. Seu negócio foi publicado automaticamente."
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
      setForm((current) => ({
        ...current,
        ...business,
        areas: normalizeBusinessSpecialties({
          ...current,
          ...business,
          areas: business.areas || current.areas
        })
      }));
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

  return (
    <main className={create ? "container page-content narrow-page" : "workspace-page business-settings-page"}>
      <BackLink to={create ? selectedPlan ? "/planos" : "/" : "/painel"}>
        {create ? selectedPlan ? "Voltar aos planos" : "Voltar ao início" : "Voltar à visão geral"}
      </BackLink>
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">{create ? "Primeiro passo" : "Presença pública"}</p>
          <h1>{create ? "Crie seu negócio" : "Meu negócio"}</h1>
          <p>Esses dados ajudam clientes a encontrar, confiar e agendar com você.</p>
        </div>
      </header>

      {!create && publication && (
        <section className={`panel publication-panel ${publication.publicado ? "publication-panel-live" : ""}`}>
          <div>
            <p className="eyebrow">Visibilidade na página inicial</p>
            <h2>{publication.publicado ? "Seu negócio está publicado" : "Seu negócio ainda não está publicado"}</h2>
            <p>
              {publication.publicado
                ? "Clientes podem encontrar seus serviços e acessar seu perfil público."
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
              className={publication.publicado ? "button button-secondary" : "button"}
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
              <p>Ela aparece na página inicial, no perfil público e nos seus cards.</p>
            </div>
            <div className="business-photo-editor">
              <MediaThumb
                alt={`Foto do negócio ${form.nome || "Agenda Fashion"}`}
                className="business-photo-preview"
                src={form.foto_url}
              />
              <div>
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
                <small>JPG, PNG ou WEBP, até 5 MB.</small>
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
              <p className="field-wide muted public-address-hint" data-testid="public-address-hint">
                Endereço atual: <strong>app.agendafashion.com.br/negocio/{form.slug}</strong>.
                Ao salvar um novo nome, este endereço também será atualizado. Links antigos continuarão funcionando.
              </p>
            )}
            <label className="field-wide">
              Descrição (opcional)
              <textarea maxLength="1000" onChange={(event) => update("descricao", event.target.value)} rows="4" value={form.descricao} />
              <small>Ajuda clientes a conhecerem seu trabalho, mas não impede a publicação.</small>
            </label>
            <fieldset className="specialty-field field-wide">
              <legend>Especialidades</legend>
              <p>Selecione tudo o que o negócio oferece.</p>
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
                inputMode="tel"
                maxLength="15"
                onChange={(event) => update("whatsapp", formatWhatsApp(event.target.value))}
                placeholder="(00) 12345-6789"
                value={form.whatsapp}
              />
            </label>
            <label>
              Link do Google Maps
              <input onChange={(event) => update("localizacao_url", event.target.value)} type="url" value={form.localizacao_url} />
            </label>
          </div>
        </section>

        <section className="business-form-section">
          <div className="business-form-heading">
            <p className="eyebrow">Endereço</p>
            <h2>Onde acontece o atendimento</h2>
          </div>
          <div className="form-grid">
            <label>
              Cidade
              <input onChange={(event) => update("cidade", event.target.value)} value={form.cidade} />
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
            <label>
              Bairro
              <input onChange={(event) => update("bairro", event.target.value)} value={form.bairro} />
            </label>
            <label>
              Endereço
              <input autoComplete="street-address" onChange={(event) => update("endereco", event.target.value)} value={form.endereco} />
            </label>
            <label>
              Número
              <input onChange={(event) => update("numero", event.target.value)} value={form.numero} />
            </label>
            <label>
              Complemento
              <input onChange={(event) => update("complemento", event.target.value)} value={form.complemento} />
            </label>
            <label>
              CEP
              <input
                autoComplete="postal-code"
                inputMode="numeric"
                maxLength="9"
                onChange={(event) => update("cep", formatCep(event.target.value))}
                placeholder="00000-000"
                value={form.cep}
              />
            </label>
          </div>
        </section>

        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-success" role="status">{message}</p>}
        <div className="form-actions business-save-actions">
          <button className="button" disabled={saving || photoUploading} type="submit">
            {saving ? "Salvando..." : create ? "Criar negócio" : "Salvar alterações"}
          </button>
        </div>
      </form>
    </main>
  );
}
