import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useSession } from "../auth/SessionContext";
import { BackLink } from "../components/BackLink";
import { ErrorState, LoadingState } from "../components/ScreenState";
import { MediaThumb } from "../components/profile/MediaThumb";

export function AccountPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ nome: "", whatsapp: "" });
  const [password, setPassword] = useState({ senhaAtual: "", novaSenha: "", confirmar: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState("");

  const load = useCallback(() => {
    setError("");
    apiRequest("/conta")
      .then((result) => {
        setUser(result.usuario);
        setProfile({
          nome: result.usuario?.nome || "",
          whatsapp: result.usuario?.whatsapp || ""
        });
      })
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(load, [load]);

  async function saveProfile(event) {
    event.preventDefault();
    setSaving("profile");
    setError("");
    setMessage("");
    try {
      const result = await apiRequest("/conta", {
        method: "PUT",
        body: { nome: profile.nome.trim(), whatsapp: profile.whatsapp.replace(/\D/g, "") }
      });
      setUser(result.usuario);
      setMessage(result.mensagem);
      await session.refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving("");
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (password.novaSenha !== password.confirmar) {
      setError("A confirmação da nova senha não confere.");
      return;
    }
    setSaving("password");
    try {
      const result = await apiRequest("/conta/senha", {
        method: "PUT",
        body: { senhaAtual: password.senhaAtual, novaSenha: password.novaSenha }
      });
      setMessage(result.mensagem);
      setPassword({ senhaAtual: "", novaSenha: "", confirmar: "" });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving("");
    }
  }

  async function uploadPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSaving("photo");
    setError("");
    const body = new FormData();
    body.append("foto", file);
    try {
      const result = await apiRequest("/conta/foto", { method: "POST", body });
      setUser(result.usuario || { ...user, foto_url: result.foto });
      setMessage(result.mensagem || "Foto atualizada.");
      await session.refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving("");
      event.target.value = "";
    }
  }

  if (!user && !error) return <main className="container page-content narrow-page"><LoadingState>Carregando sua conta...</LoadingState></main>;
  if (!user && error) return <main className="container page-content narrow-page"><ErrorState message={error} onRetry={load} /></main>;

  return (
    <main className="container page-content account-page">
      <BackLink to={session.temNegocio ? (session.negocio?.papel === "dono" ? "/painel" : "/profissional/agenda") : "/"}>
        {session.temNegocio ? "Voltar à área de trabalho" : "Voltar a explorar"}
      </BackLink>
      <header className="workspace-heading">
        <div><p className="eyebrow">Seu perfil</p><h1>Minha conta</h1><p>Atualize seus dados e mantenha sua conta protegida.</p></div>
      </header>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <section className="account-grid">
        <form className="panel stack-form" onSubmit={saveProfile}>
          <div className="profile-editor">
            <MediaThumb alt={`Foto de perfil de ${user.nome || "usuária"}`} className="account-avatar" emoji={String(user.nome || "A").slice(0, 1)} src={user.foto_url} />
            <label className="button button-secondary button-small">
              {saving === "photo" ? "Enviando..." : "Trocar foto"}
              <input accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={saving === "photo"} onChange={uploadPhoto} type="file" />
            </label>
          </div>
          <label>Nome<input minLength="2" onChange={(e) => setProfile({ ...profile, nome: e.target.value })} required value={profile.nome} /></label>
          <label>E-mail<input disabled type="email" value={user.email || ""} /></label>
          <label>WhatsApp<input inputMode="tel" onChange={(e) => setProfile({ ...profile, whatsapp: e.target.value })} required value={profile.whatsapp} /></label>
          <button className="button" disabled={saving === "profile"} type="submit">{saving === "profile" ? "Salvando..." : "Salvar perfil"}</button>
        </form>
        <form className="panel stack-form" onSubmit={savePassword}>
          <div><p className="eyebrow">Segurança</p><h2>Alterar senha</h2></div>
          <label>Senha atual<input autoComplete="current-password" onChange={(e) => setPassword({ ...password, senhaAtual: e.target.value })} required type="password" value={password.senhaAtual} /></label>
          <label>Nova senha<input autoComplete="new-password" minLength="6" onChange={(e) => setPassword({ ...password, novaSenha: e.target.value })} required type="password" value={password.novaSenha} /></label>
          <label>Confirme a nova senha<input autoComplete="new-password" minLength="6" onChange={(e) => setPassword({ ...password, confirmar: e.target.value })} required type="password" value={password.confirmar} /></label>
          <button className="button" disabled={saving === "password"} type="submit">{saving === "password" ? "Alterando..." : "Alterar senha"}</button>
        </form>
      </section>
      <button className="text-button danger-text logout-mobile" onClick={() => { session.logout(); navigate("/"); }} type="button">Sair da conta</button>
    </main>
  );
}
