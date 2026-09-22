import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useSession } from "../auth/SessionContext";
import { BackLink } from "../components/BackLink";
import { ErrorState, LoadingState } from "../components/ScreenState";
import { MediaThumb } from "../components/profile/MediaThumb";
import { formatWhatsApp } from "../utils/format";

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function profileSnapshot(user) {
  return {
    nome: user?.nome || "",
    whatsapp: formatWhatsApp(user?.whatsapp)
  };
}

function LogoutIcon() {
  return (
    <svg aria-hidden="true" className="account-logout-icon" fill="none" viewBox="0 0 24 24">
      <path d="M10 6H6.8A1.8 1.8 0 0 0 5 7.8v8.4A1.8 1.8 0 0 0 6.8 18H10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="m14 8 4 4-4 4M18 12H9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function PasswordVisibilityIcon({ visible }) {
  return (
    <svg aria-hidden="true" className="account-password-toggle-icon" fill="none" viewBox="0 0 24 24">
      <path d="M2.8 12s3.4-5.2 9.2-5.2 9.2 5.2 9.2 5.2-3.4 5.2-9.2 5.2S2.8 12 2.8 12Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.7" />
      {visible && <path d="M5 4.8 19 19.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />}
    </svg>
  );
}

export function AccountPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ nome: "", whatsapp: "" });
  const [savedProfile, setSavedProfile] = useState({ nome: "", whatsapp: "" });
  const [password, setPassword] = useState({ senhaAtual: "", novaSenha: "", confirmar: "" });
  const [passwordVisibility, setPasswordVisibility] = useState({ atual: false, nova: false, confirmar: false });
  const [bookingNotifications, setBookingNotifications] = useState(false);
  const [savedBookingNotifications, setSavedBookingNotifications] = useState(false);
  const [operationalAlerts, setOperationalAlerts] = useState(false);
  const [savedOperationalAlerts, setSavedOperationalAlerts] = useState(false);
  const [dailyReminders, setDailyReminders] = useState(false);
  const [savedDailyReminders, setSavedDailyReminders] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [photoMessage, setPhotoMessage] = useState("");
  const [saving, setSaving] = useState("");
  const [accountAction, setAccountAction] = useState("");
  const [deactivationResult, setDeactivationResult] = useState(null);
  const [closureResult, setClosureResult] = useState(null);
  const insideNavigation = Boolean(
    session.temNegocio ||
    session.ehAdministrador
  );
  const isBusinessOwner =
    session.temNegocio &&
    session.negocio?.papel === "dono";
  const pageClassName = insideNavigation
    ? "workspace-page account-page"
    : "container page-content account-page";

  const load = useCallback(() => {
    setError("");
    apiRequest("/conta")
      .then((result) => {
        const nextProfile = profileSnapshot(result.usuario);
        const nextDailyReminders = result.usuario?.aceita_lembretes_whatsapp === true;
        const nextBookingNotifications = result.usuario?.aceita_notificacoes_whatsapp === true;
        const nextOperationalAlerts = result.usuario?.aceita_alertas_operacionais_whatsapp === true;

        setUser(result.usuario);
        setProfile(nextProfile);
        setSavedProfile(nextProfile);
        setDailyReminders(nextDailyReminders);
        setSavedDailyReminders(nextDailyReminders);
        setBookingNotifications(nextBookingNotifications);
        setSavedBookingNotifications(nextBookingNotifications);
        setOperationalAlerts(nextOperationalAlerts);
        setSavedOperationalAlerts(nextOperationalAlerts);
      })
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(load, [load]);

  const profileChanged = profile.nome.trim() !== savedProfile.nome.trim()
    || onlyDigits(profile.whatsapp) !== onlyDigits(savedProfile.whatsapp);
  const bookingNotificationsChanged = bookingNotifications !== savedBookingNotifications;
  const operationalAlertsChanged = operationalAlerts !== savedOperationalAlerts;
  const dailyRemindersChanged = dailyReminders !== savedDailyReminders;
  const passwordsMatch = password.confirmar.length > 0 && password.novaSenha === password.confirmar;
  const passwordValid = password.senhaAtual.length > 0
    && password.novaSenha.length >= 8
    && passwordsMatch;

  async function saveProfile(event) {
    event.preventDefault();
    if (!profileChanged || saving === "profile") return;
    setSaving("profile");
    setError("");
    setMessage("");
    try {
      const result = await apiRequest("/conta", {
        method: "PUT",
        body: { nome: profile.nome.trim(), whatsapp: onlyDigits(profile.whatsapp) }
      });
      const updatedUser = result.usuario || {
        ...user,
        nome: profile.nome.trim(),
        whatsapp: onlyDigits(profile.whatsapp)
      };
      const nextProfile = profileSnapshot(updatedUser);
      setUser(updatedUser);
      setProfile(nextProfile);
      setSavedProfile(nextProfile);
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
      setPasswordVisibility({ atual: false, nova: false, confirmar: false });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving("");
    }
  }

  async function saveWhatsAppPreferences(event) {
    event.preventDefault();
    if (
      (!operationalAlertsChanged && !dailyRemindersChanged)
      || saving === "whatsapp-preferences"
    ) return;
    setSaving("whatsapp-preferences");
    setError("");
    setMessage("");

    try {
      const result = await apiRequest(
        "/conta/preferencias-whatsapp",
        {
          method: "PUT",
          body: {
            aceitaAlertasOperacionais: operationalAlerts,
            ...(isBusinessOwner
              ? { aceitaLembretes: dailyReminders }
              : {})
          }
        }
      );

      const nextValue = result.preferencia?.aceita_lembretes_whatsapp === true;
      const nextOperationalValue = result.preferencia?.aceita_alertas_operacionais_whatsapp === true;
      setDailyReminders(nextValue);
      setSavedDailyReminders(nextValue);
      setOperationalAlerts(nextOperationalValue);
      setSavedOperationalAlerts(nextOperationalValue);
      setMessage(result.mensagem);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving("");
    }
  }

  async function saveBookingNotifications(event) {
    event.preventDefault();
    if (!bookingNotificationsChanged || saving === "booking-notifications") return;
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

      const nextValue = result.preferencia?.aceita_notificacoes_whatsapp === true;
      setBookingNotifications(nextValue);
      setSavedBookingNotifications(nextValue);
      setMessage(result.mensagem);
      await session.refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving("");
    }
  }

  async function deactivateAccount() {
    if (
      !window.confirm(
        "Desativar sua conta? Você perderá o acesso ao AF. Agendamentos de cliente confirmados serão preservados e, se existirem, você receberá acessos seguros para consultá-los."
      )
    ) {
      return;
    }

    setSaving("deactivate-account");
    setError("");
    setMessage("");

    try {
      const result = await apiRequest("/conta/desativar", {
        method: "POST"
      });
      setClosureResult(result);
      setMessage(result.mensagem);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving("");
    }
  }

  async function closeAccountPermanently() {
    if (
      !window.confirm(
        "Encerrar sua conta definitivamente? O acesso não poderá ser retomado pelo fluxo normal. Históricos necessários para reservas, segurança, auditoria e retenção serão preservados."
      )
    ) {
      return;
    }

    setSaving("close-account");
    setError("");
    setMessage("");

    try {
      await apiRequest("/conta", {
        method: "DELETE"
      });
      await session.logout();
      navigate("/", {
        replace: true,
        state: {
          message: "Conta encerrada com sucesso."
        }
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving("");
    }
  }

  async function deactivateAccount() {
    if (
      !window.confirm(
        "Desativar sua conta? Você perderá o acesso ao AF. Agendamentos já confirmados como cliente serão preservados."
      )
    ) {
      return;
    }

    setAccountAction("deactivate");
    setError("");
    setMessage("");

    try {
      const result = await apiRequest("/conta/desativar", {
        method: "POST"
      });
      const accesses = Array.isArray(result.reservas_acesso)
        ? result.reservas_acesso
        : [];

      if (accesses.length > 0) {
        setDeactivationResult(result);
        return;
      }

      await session.logout();
      navigate("/", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAccountAction("");
    }
  }

  async function deleteAccount() {
    if (
      !window.confirm(
        "Encerrar definitivamente sua conta? O AF bloqueará a ação se existirem reservas ou pendências que precisam ser resolvidas."
      )
    ) {
      return;
    }

    setAccountAction("delete");
    setError("");
    setMessage("");

    try {
      await apiRequest("/conta", {
        method: "DELETE"
      });
      await session.logout();
      navigate("/", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAccountAction("");
    }
  }

  async function uploadPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSaving("photo");
    setError("");
    setPhotoMessage("");
    const body = new FormData();
    body.append("foto", file);
    try {
      const result = await apiRequest("/conta/foto", { method: "POST", body });
      setUser(result.usuario || { ...user, foto_url: result.foto });
      setPhotoMessage(result.mensagem || "Foto atualizada.");
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

  if (deactivationResult) {
    const accesses = Array.isArray(deactivationResult.reservas_acesso)
      ? deactivationResult.reservas_acesso
      : [];

    return (
      <main className="container page-content narrow-page account-page">
        <header className="workspace-heading">
          <div>
            <p className="eyebrow">Conta desativada</p>
            <h1>Seus agendamentos continuam preservados</h1>
            <p>
              Guarde estes acessos enquanto houver reservas ativas. Eles funcionam sem login e respeitam a política de cancelamento de cada booking.
            </p>
          </div>
        </header>

        <section className="panel stack-form">
          {accesses.map((item) => (
            <div className="account-preference-row" key={item.id}>
              <div className="account-preference-copy">
                <strong>{item.servico_nome || "Agendamento"}</strong>
                <span>
                  {item.negocio_nome || "Negócio"} · {item.data} às {item.horario}
                </span>
              </div>
              <a className="button button-secondary button-small" href={item.caminho}>
                Abrir acesso seguro
              </a>
            </div>
          ))}
          <button
            className="button"
            onClick={() => {
              session.logout();
              navigate("/", { replace: true });
            }}
            type="button"
          >
            Sair e voltar ao início
          </button>
        </section>
      </main>
    );
  }

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

  function passwordField(label, key, autoComplete) {
    const visible = passwordVisibility[key];
    const valueKey = key === "atual" ? "senhaAtual" : key === "nova" ? "novaSenha" : "confirmar";
    const toggleLabel = `${visible ? "Ocultar" : "Mostrar"} ${label.toLowerCase()}`;
    return (
      <label className="account-password-field">
        <span>{label}</span>
        <span className="account-password-input-wrap">
          <input
            autoComplete={autoComplete}
            minLength={key === "atual" ? undefined : 8}
            onChange={(event) => setPassword({ ...password, [valueKey]: event.target.value })}
            required
            type={visible ? "text" : "password"}
            value={password[valueKey]}
          />
          <button
            aria-label={toggleLabel}
            aria-pressed={visible}
            className="account-password-toggle"
            onClick={() => setPasswordVisibility({ ...passwordVisibility, [key]: !visible })}
            title={toggleLabel}
            type="button"
          >
            <PasswordVisibilityIcon visible={visible} />
          </button>
        </span>
      </label>
    );
  }

  return (
    <main className={pageClassName}>
      {!insideNavigation && (
        <BackLink to={backPath}>
          {backLabel}
        </BackLink>
      )}
      <header className="workspace-heading account-heading">
        <div><p className="eyebrow">Seu perfil</p><h1>Minha conta</h1><p>Atualize seus dados e mantenha sua conta protegida.</p></div>
      </header>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <section className="account-grid">
        <form className="panel stack-form account-profile-form" onSubmit={saveProfile}>
          <div className="profile-editor account-profile-editor">
            <MediaThumb alt={`Foto de perfil de ${user.nome || "usuária"}`} className="account-avatar" emoji={String(user.nome || "A").trim().slice(0, 1).toUpperCase() || "A"} src={user.foto_url} />
            <div className="account-photo-actions">
              <label className="button button-secondary button-small">
                {saving === "photo" ? "Enviando..." : "Trocar foto"}
                <input accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={saving === "photo"} onChange={uploadPhoto} type="file" />
              </label>
              {photoMessage && <small className="account-photo-feedback" role="status">{photoMessage}</small>}
            </div>
          </div>
          <label>Nome<input minLength="2" onChange={(e) => setProfile({ ...profile, nome: e.target.value })} required value={profile.nome} /></label>
          <label className="account-email-field">
            <span>E-mail</span>
            <input aria-describedby="account-email-help" readOnly type="email" value={user.email || ""} />
            <small className="muted" id="account-email-help">E-mail da conta. Não pode ser alterado aqui.</small>
          </label>
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
          {(profileChanged || saving === "profile") && (
            <button className="button account-profile-save" disabled={saving === "profile"} type="submit">
              {saving === "profile" ? "Salvando..." : "Salvar perfil"}
            </button>
          )}
        </form>
        <form className="panel stack-form account-password-form" onSubmit={savePassword}>
          <div><p className="eyebrow">Segurança</p><h2>Alterar senha</h2></div>
          {passwordField("Senha atual", "atual", "current-password")}
          {passwordField("Nova senha", "nova", "new-password")}
          <small className={password.novaSenha.length > 0 && password.novaSenha.length < 8 ? "account-password-hint is-warning" : "account-password-hint"}>
            Use pelo menos 8 caracteres.
          </small>
          {passwordField("Confirme a nova senha", "confirmar", "new-password")}
          {password.confirmar.length > 0 && (
            <small className={passwordsMatch ? "account-password-match is-valid" : "account-password-match is-invalid"} role="status">
              {passwordsMatch ? "As senhas coincidem." : "As senhas não coincidem."}
            </small>
          )}
          <button className="button" disabled={!passwordValid || saving === "password"} type="submit">{saving === "password" ? "Alterando..." : "Alterar senha"}</button>
        </form>
      </section>
      <section className="panel account-whatsapp-preferences" id="notificacoes-whatsapp">
        <div className="account-preferences-heading">
          <p className="eyebrow">WhatsApp</p>
          <h2>Preferências do WhatsApp</h2>
          <p className="muted">Escolha quais mensagens deseja receber e altere essas opções quando precisar.</p>
        </div>

        <form className="account-preference-row" onSubmit={saveBookingNotifications}>
          <div className="account-preference-copy">
            <strong>Agendamentos</strong>
            <span>Confirmações, lembretes e atualizações dos seus agendamentos.</span>
          </div>
          <label className="switch-field account-switch-field">
            <input
              checked={bookingNotifications}
              onChange={(event) => setBookingNotifications(event.target.checked)}
              type="checkbox"
            />
            <span>
              Receber mensagens dos meus agendamentos no WhatsApp
              <small className="muted">Você pode alterar esta autorização a qualquer momento.</small>
            </span>
          </label>
          {(bookingNotificationsChanged || saving === "booking-notifications") && (
            <button
              className="button button-secondary account-preference-action"
              disabled={saving === "booking-notifications"}
              type="submit"
            >
              {saving === "booking-notifications" ? "Salvando..." : "Salvar"}
            </button>
          )}
        </form>

        {session.temNegocio && (
          <form className="account-preference-row" onSubmit={saveWhatsAppPreferences}>
            <div className="account-preference-copy">
              <strong>Comunicação do negócio</strong>
              <span>
                {isBusinessOwner
                  ? "Avisos operacionais e orientações de marketing ficam separados."
                  : "Escolha se deseja receber os avisos operacionais do Agenda Fashion."}
              </span>
            </div>
            <label className="switch-field account-switch-field">
              <input
                checked={operationalAlerts}
                onChange={(event) => setOperationalAlerts(event.target.checked)}
                type="checkbox"
              />
              <span>
                Receber avisos operacionais de agendamentos
                <small className="muted">
                  Inclui novos agendamentos, lembretes, alterações e cancelamentos. Não inclui promoções.
                </small>
              </span>
            </label>
            {isBusinessOwner && (
              <label className="switch-field account-switch-field">
                <input
                  checked={dailyReminders}
                  onChange={(event) => setDailyReminders(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  Receber orientações do AF pelo WhatsApp
                  <small className="muted">
                    Até três mensagens de marketing, com intervalo mínimo de três dias. Desmarque ou responda PARAR MARKETING para interromper apenas essa categoria.
                  </small>
                </span>
              </label>
            )}
            {(operationalAlertsChanged || dailyRemindersChanged || saving === "whatsapp-preferences") && (
              <button
                className="button button-secondary account-preference-action"
                disabled={saving === "whatsapp-preferences"}
                type="submit"
              >
                {saving === "whatsapp-preferences" ? "Salvando..." : "Salvar"}
              </button>
            )}
          </form>
        )}
      </section>

      <section className="panel stack-form account-danger-zone">
        <div>
          <p className="eyebrow">Privacidade e encerramento</p>
          <h2>Desativar ou encerrar a conta</h2>
          <p className="muted">
            Desativar interrompe seu acesso sem cancelar automaticamente reservas de cliente.
            O encerramento definitivo exige que pendências operacionais e financeiras estejam resolvidas.
          </p>
        </div>

        {closureResult?.reservas_acesso?.length > 0 && (
          <div className="stack-form" role="status">
            <strong>Guarde estes acessos aos seus agendamentos</strong>
            <p className="muted">
              Eles continuam funcionando mesmo depois que você sair da conta.
            </p>
            {closureResult.reservas_acesso.map((reserva) => (
              <a
                className="text-link"
                href={reserva.caminho}
                key={reserva.id}
              >
                {reserva.servico_nome || "Agendamento"} · {reserva.data} às {reserva.horario}
              </a>
            ))}
          </div>
        )}

        <div className="form-actions">
          <button
            className="button button-secondary"
            disabled={Boolean(saving)}
            onClick={deactivateAccount}
            type="button"
          >
            {saving === "deactivate-account"
              ? "Desativando..."
              : "Desativar conta"}
          </button>
          <button
            className="button button-secondary danger-text"
            disabled={Boolean(saving)}
            onClick={closeAccountPermanently}
            type="button"
          >
            {saving === "close-account"
              ? "Encerrando..."
              : "Encerrar conta definitivamente"}
          </button>
        </div>

        {closureResult && (
          <button
            className="text-button"
            onClick={async () => {
              await session.logout();
              navigate("/");
            }}
            type="button"
          >
            Sair agora
          </button>
        )}
      </section>

      <button className="button button-secondary account-logout-button" onClick={() => { session.logout(); navigate("/"); }} type="button">
        <LogoutIcon />
        Sair da conta
      </button>
      <section className="panel account-danger-zone" aria-labelledby="account-danger-title">
        <div>
          <p className="eyebrow">Privacidade e encerramento</p>
          <h2 id="account-danger-title">Desativar ou encerrar conta</h2>
          <p className="muted">
            Desativar preserva reservas de cliente e fornece acessos seguros. O encerramento definitivo só prossegue quando não houver reservas profissionais, reservas de cliente ou pendências do negócio.
          </p>
        </div>
        <div className="form-actions">
          <button
            className="button button-secondary"
            disabled={Boolean(accountAction)}
            onClick={deactivateAccount}
            type="button"
          >
            {accountAction === "deactivate" ? "Desativando..." : "Desativar conta"}
          </button>
          <button
            className="button button-secondary danger-text"
            disabled={Boolean(accountAction)}
            onClick={deleteAccount}
            type="button"
          >
            {accountAction === "delete" ? "Encerrando..." : "Encerrar conta definitivamente"}
          </button>
        </div>
      </section>
    </main>
  );
}
