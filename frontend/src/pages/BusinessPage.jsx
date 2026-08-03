import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useSession } from "../auth/SessionContext";
import { BackLink } from "../components/BackLink";
import { ErrorState, LoadingState } from "../components/ScreenState";

const EMPTY = {
  nome: "",
  descricao: "",
  setor: "Beleza",
  whatsapp: "",
  cidade: "",
  estado: "",
  bairro: "",
  endereco: "",
  numero: "",
  complemento: "",
  cep: "",
  localizacao_url: "",
  areas: ""
};

export function BusinessPage({ create = false }) {
  const session = useSession();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(!create);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
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
          whatsapp: business.whatsapp || business.whatsapp_negocio || "",
          areas: Array.isArray(business.areas) ? business.areas.join(", ") : ""
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

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      ...form,
      whatsapp: String(form.whatsapp).replace(/\D/g, ""),
      areas: String(form.areas || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    };

    try {
      const result = await apiRequest(create ? "/criar-negocio" : "/configuracoes", {
        method: create ? "POST" : "PUT",
        body: payload
      });
      setMessage(result.mensagem || (create ? "Negócio criado." : "Alterações salvas."));
      if (result.publicacao) setPublication(result.publicacao);
      await session.refresh();
      if (create) navigate("/painel", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
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
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPublishing(false);
    }
  }

  if (loading) return <div className="workspace-page"><LoadingState>Carregando negócio...</LoadingState></div>;
  if (error && !form.nome && !create) return <div className="workspace-page"><ErrorState message={error} /></div>;

  return (
    <main className={create ? "container page-content narrow-page" : "workspace-page"}>
      <BackLink to={create ? "/" : "/painel"}>
        {create ? "Voltar a explorar" : "Voltar à visão geral"}
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
                : "Publique quando o perfil estiver pronto para aparecer em Negócios e Serviços."}
            </p>
            {!publication.pode_publicar && publication.pendencias.length > 0 && (
              <p className="publication-pending">
                Falta completar: {publication.pendencias.join(", ")}.
              </p>
            )}
          </div>
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
        </section>
      )}

      <form className="panel stack-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="field-wide">
            Nome do negócio
            <input minLength="2" onChange={(e) => update("nome", e.target.value)} required value={form.nome} />
          </label>
          <label>
            Área principal
            <input onChange={(e) => update("setor", e.target.value)} value={form.setor} />
          </label>
          <label>
            WhatsApp
            <input inputMode="tel" onChange={(e) => update("whatsapp", e.target.value)} value={form.whatsapp} />
          </label>
          <label className="field-wide">
            Descrição
            <textarea maxLength="1000" onChange={(e) => update("descricao", e.target.value)} rows="4" value={form.descricao} />
          </label>
          <label>
            Cidade
            <input onChange={(e) => update("cidade", e.target.value)} value={form.cidade} />
          </label>
          <label>
            Estado
            <input maxLength="2" onChange={(e) => update("estado", e.target.value.toUpperCase())} value={form.estado} />
          </label>
          <label>
            Bairro
            <input onChange={(e) => update("bairro", e.target.value)} value={form.bairro} />
          </label>
          {create && (
            <>
              <label>
                Endereço
                <input onChange={(e) => update("endereco", e.target.value)} value={form.endereco} />
              </label>
              <label>
                Número
                <input onChange={(e) => update("numero", e.target.value)} value={form.numero} />
              </label>
              <label>
                CEP
                <input inputMode="numeric" onChange={(e) => update("cep", e.target.value)} value={form.cep} />
              </label>
            </>
          )}
          {!create && (
            <label className="field-wide">
              Áreas atendidas
              <input
                onChange={(e) => update("areas", e.target.value)}
                placeholder="Unhas, cabelo, cílios"
                value={form.areas}
              />
              <small>Separe as áreas por vírgula.</small>
            </label>
          )}
          <label className="field-wide">
            Link do Google Maps
            <input onChange={(e) => update("localizacao_url", e.target.value)} type="url" value={form.localizacao_url} />
          </label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-success" role="status">{message}</p>}
        <div className="form-actions">
          <button className="button" disabled={saving} type="submit">
            {saving ? "Salvando..." : create ? "Criar negócio" : "Salvar alterações"}
          </button>
        </div>
      </form>
    </main>
  );
}
