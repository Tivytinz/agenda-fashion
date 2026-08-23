import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useSession } from "../auth/SessionContext";
import { BackLink } from "../components/BackLink";
import { ErrorState, LoadingState } from "../components/ScreenState";
import { MediaThumb } from "../components/profile/MediaThumb";
import { formatWhatsApp } from "../utils/format";

export function AccountPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ nome: "", whatsapp: "" });
  const [password, setPassword] = useState({ senhaAtual: "", novaSenha: "", confirmar: "" });
  const [bookingNotifications, setBookingNotifications] = useState(false);
  const [dailyReminders, setDailyReminders] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState("");
  const insideNavigation = Boolean(
    session.temNegocio ||
    session.ehAdministrador
  );
  const pageClassName = insideNavigation
    ? "workspace-page account-page"
    : "container page-content account-page";

  const load = useCallback(() => {
    setError("");
    apiRequest("/conta")
      .then((result) => {
        setUser(result.usuario);
        setProfile({
          nome: result.usuario?.nome || "",
          whatsapp: formatWhatsApp(result.usuario?.whatsapp)
        });
        setDailyReminders(
          result.usuario?.aceita_lembretes_whatsapp === true
        );
        setBookingNotifications(
          result.usuario?.aceita_notificacoes_whatsapp === true
        );
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

  async function saveWhatsAppPreferences(event) {
    event.preventDefault();
    setSaving("whatsapp-preferences");
    setError("");
    setMessage("");

    try {
      const result = await apiRequest(
        "/conta/preferencias-whatsapp",
        {
          method: "PUT",
          body: {
            aceitaLembretes: dailyReminders
          }
        }
      );

      setDailyReminders(
        result.preferencia?.aceita_lembretes_whatsapp === true
      );
      setMessage(result.mensagem);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving("");
    }
  }

  async function saveBookingNotifications(event) {
    event.preventDefault();
    setSaving("booking-notifications");
    setError("");
    setMessage("");

    try {
      const result = await apiRequest(
        "/conta/notificacoes-whatsapp",
        {
          method: "PUT",
          body: {
            aceitaNotificacoes: bookingNotifications
          }
        }
      );

      setBookingNotifications(
        result.preferencia?.aceita_notificacoes_whatsapp === true
      );
      setMessage(result.mensagem);
      await session.refresh();
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

  if (!user && !error) return <main className={pageClassName}><LoadingState>Carregando sua conta...</LoadingState></main>;
  if (!user && error) return <main className={pageClassName}><ErrorState message={error} onRetry={load} /></main>;

  const backPath = session.ehAdministrador
    ? "/admin/trafego-pago"
    : session.temNegocio
      ? session.negocio?.papel === "dono"
        ? "/painel"
        : "/profissional/agenda"
      : "/";
  const backLabel = session.ehAdministrador
    ? "Voltar à administração"
    : session.temNegocio
      ? "Voltar à área de trabalho"
      : "Voltar ao início";

  return (
    <main className={pageClassName}>
      <BackLink to={backPath}>
        {backLabel}
      </BackLink>
      <header className="workspace-heading">
        <div><p className="eyebrow">Seu perfil</p><h1>Minha conta</h1><p>Atualize seus dados e mantenha sua conta protegida.</p></div>
      </header>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <section className="account-grid">
        <form className="panel stack-form" onSubmit={saveProfile}>
          <div className="profile-editor">
            <MediaThumb alt={`Foto de perfil de ${user.nome || "usuária"}`} className="account-avatar" emoji={String(user.nome || "A").trim().slice(0, 1).toUpperCase() || "A"} src={user.foto_url} />
            <label className="button button-secondary button-small">
              {saving === "photo" ? "Enviando..." : "Trocar foto"}
              <input accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={saving === "photo"} onChange={uploadPhoto} type="file" />
            </label>
          </div>
          <label>Nome<input minLength="2" onChange={(e) => setProfile({ ...profile, nome: e.target.value })} required value={profile.nome} /></label>
          <label>E-mail<input disabled type="email" value={user.email || ""} /></label>
          <label>
            WhatsApp
            <input
              autoComplete="tel"
              inputMode="tel"
              maxLength="15"
              onChange={(e) => setProfile({
                ...profile,
                whatsapp: formatWhatsApp(e.target.value)
              })}
              placeholder="(00) 12345-6789"
              required
              value={profile.whatsapp}
            />
          </label>
          <button className="button" disabled={saving === "profile"} type="submit">{saving === "profile" ? "Salvando..." : "Salvar perfil"}</button>
        </form>
        <form className="panel stack-form" onSubmit={savePassword}>
          <div><p className="eyebrow">Segurança</p><h2>Alterar senha</h2></div>
          <label>Senha atual<input autoComplete="current-password" onChange={(e) => setPassword({ ...password, senhaAtual: e.target.value })} required type="password" value={password.senhaAtual} /></label>
          <label>Nova senha<input autoComplete="new-password" minLength="8" onChange={(e) => setPassword({ ...password, novaSenha: e.target.value })} required type="password" value={password.novaSenha} /></label>
          <label>Confirme a nova senha<input autoComplete="new-password" minLength="8" onChange={(e) => setPassword({ ...password, confirmar: e.target.value })} required type="password" value={password.confirmar} /></label>
          <button className="button" disabled={saving === "password"} type="submit">{saving === "password" ? "Alterando..." : "Alterar senha"}</button>
        </form>
      </section>
      <form
        className="panel stack-form"
        id="notificacoes-whatsapp"
        onSubmit={saveBookingNotifications}
      >
        <div>
          <p className="eyebrow">Seus agendamentos</p>
          <h2>Mensagens no WhatsApp</h2>
          <p className="muted">
            Receba confirmações, lembretes e atualizações importantes dos seus agendamentos.
          </p>
        </div>
        <label className="switch-field">
          <input
            checked={bookingNotifications}
            onChange={(event) => setBookingNotifications(event.target.checked)}
            type="checkbox"
          />
          <span>
            Autorizar mensagens dos meus agendamentos
            <small className="muted">
              Você pode desativar esta opção a qualquer momento.
            </small>
          </span>
        </label>
        <button
          className="button button-secondary"
          disabled={saving === "booking-notifications"}
          type="submit"
        >
          {saving === "booking-notifications"
            ? "Salvando..."
            : "Salvar autorização"}
        </button>
      </form>
      {session.temNegocio && session.negocio?.papel === "dono" && (
        <form className="panel stack-form" onSubmit={saveWhatsAppPreferences}>
          <div>
            <p className="eyebrow">Lembretes do negócio</p>
            <h2>Ativação pelo WhatsApp</h2>
            <p className="muted">
              Escolha se deseja receber um lembrete diário para cadastrar seu primeiro serviço ou divulgar o link público do negócio.
            </p>
          </div>
          <label className="switch-field">
            <input
              checked={dailyReminders}
              onChange={(event) => setDailyReminders(event.target.checked)}
              type="checkbox"
            />
            <span>
              Receber um lembrete por dia no WhatsApp
              <small className="muted">
                Você pode desativar esta opção a qualquer momento.
              </small>
            </span>
          </label>
          <button
            className="button button-secondary"
            disabled={saving === "whatsapp-preferences"}
            type="submit"
          >
            {saving === "whatsapp-preferences"
              ? "Salvando..."
              : "Salvar preferência"}
          </button>
        </form>
      )}
      <button className="button button-secondary account-logout-button" onClick={() => { session.logout(); navigate("/"); }} type="button">
        <span aria-hidden="true">↪</span>
        Sair da conta
      </button>
    </main>
  );
}
