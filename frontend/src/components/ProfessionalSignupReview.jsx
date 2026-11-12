import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";
import { getPlanIntentPath } from "../auth/session";
import { WHATSAPP_PATTERN, passwordByteLength } from "../auth/registrationValidation";
import { formatWhatsApp } from "../utils/format";
import { clearBusinessCreationDraft } from "../features/business/draft";
import { AuthFieldLabel } from "./AuthFieldLabel";
import { SetupFlowFrame, SetupTitle } from "./SetupFlowFrame";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const digits = (value) => String(value || "").replace(/\D/g, "");

function accountForm(user) {
  return {
    nome: String(user?.nome || ""),
    email: String(user?.email || ""),
    whatsapp: formatWhatsApp(user?.whatsapp)
  };
}

// Etapa 1 já criada: edita a mesma conta sem repetir o cadastro.
// Nenhuma credencial é copiada para sessionStorage ou para o rascunho do negócio.
export function ProfessionalSignupReview({ user, planSlug = "", refreshSession, reauthenticate }) {
  const navigate = useNavigate();
  const nextStep = getPlanIntentPath("/criar-negocio", planSlug);
  const [form, setForm] = useState(() => accountForm(user));
  const [password, setPassword] = useState({ atual: "", nova: "", confirmar: "" });
  const [showPasswordEdit, setShowPasswordEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const operationRef = useRef(null);

  useEffect(() => {
    setForm(accountForm(user));
    setPassword({ atual: "", nova: "", confirmar: "" });
  }, [user?.id]);

  useEffect(() => () => operationRef.current?.abort(), []);

  const nome = form.nome.trim();
  const email = form.email.trim().toLowerCase();
  const whatsapp = digits(form.whatsapp);
  const profileChanged = nome !== String(user.nome || "").trim()
    || whatsapp !== digits(user.whatsapp);
  const emailChanged = email !== String(user.email || "").toLowerCase();
  const passwordChanged = showPasswordEdit && Boolean(password.nova || password.confirmar);
  const needsCurrentPassword = emailChanged || passwordChanged;
  const changed = profileChanged || emailChanged || passwordChanged;
  const passwordValid = !passwordChanged || (
    password.nova.length >= 8 && passwordByteLength(password.nova) <= 72 &&
    password.nova === password.confirmar
  );
  const valid = nome.length >= 2 && nome.length <= 120 &&
    EMAIL_PATTERN.test(email) && email.length <= 160 &&
    (whatsapp.length === 10 || whatsapp.length === 11) &&
    (!needsCurrentPassword || password.atual.length > 0) && passwordValid;

  async function submit(event) {
    event.preventDefault();
    if (!valid || operationRef.current) return;
    if (!changed) {
      navigate(nextStep);
      return;
    }

    const controller = new AbortController();
    operationRef.current = controller;
    setSaving(true);
    setError("");
    try {
      // Primeiro a credencial protegida. Alterações de perfil usam a rota canônica.
      if (emailChanged) {
        await apiRequest("/conta/email", {
          method: "PUT",
          body: { email, senhaAtual: password.atual },
          signal: controller.signal
        });
      }
      if (controller.signal.aborted) return;
      if (profileChanged) {
        await apiRequest("/conta", {
          method: "PUT",
          body: { nome, whatsapp },
          signal: controller.signal
        });
      }
      if (controller.signal.aborted) return;
      if (passwordChanged) {
        await apiRequest("/conta/senha", {
          method: "PUT",
          body: { senhaAtual: password.atual, novaSenha: password.nova },
          signal: controller.signal
        });
      }
      if (controller.signal.aborted) return;
      // PUT /conta/senha invalida o token anterior. Renovar a sessão
      // automaticamente pela autenticação canônica com a nova senha.
      const current = passwordChanged
        ? await reauthenticate({ email, senha: password.nova })
        : await refreshSession({ silent: true });
      if (controller.signal.aborted) return;
      if (!current?.authenticated || String(current.usuario?.id) !== String(user.id)) {
        throw new Error("Os dados foram salvos, mas não foi possível atualizar sua sessão. Tente novamente.");
      }
      setPassword({ atual: "", nova: "", confirmar: "" });
      navigate(nextStep);
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setError(requestError.message || "Não foi possível salvar seus dados. Tente novamente.");
      }
    } finally {
      if (operationRef.current === controller) {
        operationRef.current = null;
        if (!controller.signal.aborted) setSaving(false);
      }
    }
  }

  function exit(event) {
    if (operationRef.current) { event.preventDefault(); return; }
    if (changed && !window.confirm("Sair sem salvar as alterações da conta?")) {
      event.preventDefault();
      return;
    }
    clearBusinessCreationDraft();
  }

  return (
    <SetupFlowFrame onExit={exit} step={1}>
      <main className="auth-page">
        <section aria-labelledby="professional-review-title"
          className="auth-card auth-card-professional-register professional-signup-edit">
          <SetupTitle emoji="💖" id="professional-review-title">Sua conta</SetupTitle>
          <p className="muted">Etapa 1 de 4. Revise ou edite seus dados e continue.</p>
          <form className="stack-form" onSubmit={submit}>
            <label>
              <AuthFieldLabel emoji="👤">Nome completo</AuthFieldLabel>
              <input aria-label="Nome completo" autoComplete="name" disabled={saving}
                maxLength={120} minLength={2} required
                onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
                value={form.nome} />
            </label>
            <label>
              <AuthFieldLabel emoji="✉️">E-mail</AuthFieldLabel>
              <input aria-label="E-mail" autoComplete="email" disabled={saving}
                maxLength={160} required type="email"
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                value={form.email} />
            </label>
            <label>
              <AuthFieldLabel emoji="📱">WhatsApp com DDD</AuthFieldLabel>
              <input aria-label="WhatsApp com DDD" autoComplete="tel"
                disabled={saving} inputMode="tel" maxLength={20} pattern={WHATSAPP_PATTERN}
                required type="tel" onChange={(event) => setForm((current) => ({
                  ...current, whatsapp: event.target.value
                }))} value={form.whatsapp} />
            </label>
            <button aria-expanded={showPasswordEdit} className="signup-edit-password-toggle"
              disabled={saving} onClick={() => {
                if (showPasswordEdit) setPassword({ atual: "", nova: "", confirmar: "" });
                setShowPasswordEdit((value) => !value);
              }} type="button">
              🔒 {showPasswordEdit ? "Não alterar senha" : "Alterar senha"}
            </button>
            {(needsCurrentPassword || showPasswordEdit) && (
              <div className="professional-signup-password-fields">
                <label>
                  Senha atual
                  <input aria-label="Senha atual" autoComplete="current-password"
                    disabled={saving} required={needsCurrentPassword} type="password"
                    onChange={(event) => setPassword((p) => ({ ...p, atual: event.target.value }))}
                    value={password.atual} />
                </label>
                {emailChanged && <small>Para proteger seu login, confirme a senha atual ao trocar o e-mail.</small>}
                {showPasswordEdit && <>
                  <label>
                    Nova senha
                    <input aria-label="Nova senha" autoComplete="new-password"
                      disabled={saving} minLength={8} type="password"
                      onChange={(event) => setPassword((p) => ({ ...p, nova: event.target.value }))}
                      value={password.nova} />
                  </label>
                  <label>
                    Confirmar nova senha
                    <input aria-label="Confirmar nova senha" autoComplete="new-password"
                      disabled={saving} type="password"
                      onChange={(event) => setPassword((p) => ({ ...p, confirmar: event.target.value }))}
                      value={password.confirmar} />
                  </label>
                  <small>A nova senha deve ter pelo menos 8 caracteres.</small>
                </>}
              </div>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button-full" disabled={saving || !valid} type="submit">
              {saving ? "Salvando..." : changed ? "Salvar e continuar" : "Continuar para o negócio"}
            </button>
          </form>
          <small className="professional-signup-review-note">
            Seus dados continuam vinculados à mesma conta. Você pode voltar às etapas anteriores sem cadastrar tudo novamente.
          </small>
        </section>
      </main>
    </SetupFlowFrame>
  );
}
