import { useCallback, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { trackGoogleSignUp } from "../analytics/googleMeasurement";
import {
  createMetaEventContext,
  trackMetaEvent
} from "../analytics/metaAds";
import { getMarketingContext } from "../analytics/track";
import {
  getAuthDestination,
  normalizePlanSlug,
  safeInternalPath
} from "../auth/session";
import { useSession } from "../auth/SessionContext";
import { buildProfessionalSignupPath } from "../utils/professionalEntry";
import { SetupFlowFrame, SetupTitle } from "../components/SetupFlowFrame";
import { GoogleLoginButton } from "../components/GoogleLoginButton";
import { ErrorState, LoadingState } from "../components/ScreenState";
import { AuthFieldLabel } from "../components/AuthFieldLabel";
import { PasswordField } from "../components/PasswordField";
import { isRegistrationComplete, WHATSAPP_PATTERN } from "../auth/registrationValidation";

export { WHATSAPP_PATTERN } from "../auth/registrationValidation";

export function safeReturnPath(value) {
  return safeInternalPath(value);
}

export function AuthPage({ mode = "login" }) {
  const isRegister = mode === "register";
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({
    nome: "",
    email: "",
    whatsapp: "",
    senha: "",
    confirmarSenha: "",
    aceitaNotificacoesWhatsapp: false
  });
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const authIntent = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const planSlug = normalizePlanSlug(params.get("plano"));

    return {
      planSlug,
      professional: params.get("tipo") === "profissional" || Boolean(planSlug)
    };
  }, [location.search]);
  const professionalIntent = authIntent.professional;
  const registrationComplete = isRegistrationComplete(form);

  const authRequestedPath = safeReturnPath(location.state?.from);

  const destination = useMemo(() => getAuthDestination(session, {
    requestedPath: authRequestedPath,
    planSlug: authIntent.planSlug,
    professionalIntent
  }), [
    authIntent.planSlug,
    authRequestedPath,
    professionalIntent,
    session
  ]);

  const finish = useCallback((current) => {
    navigate(getAuthDestination(current, {
      requestedPath: authRequestedPath,
      planSlug: authIntent.planSlug,
      professionalIntent
    }), { replace: true });
  }, [
    authIntent.planSlug,
    authRequestedPath,
    professionalIntent,
    navigate
  ]);

  const handleGoogle = useCallback(async (credential) => {
    if (submittingRef.current || session.loading) return;
    submittingRef.current = true;
    setError("");
    setSubmitting(true);
    try {
      const marketing = isRegister
        ? getMarketingContext(
            professionalIntent
              ? "profissional"
              : "indefinida"
          )
        : undefined;
      const meta =
        isRegister && professionalIntent
          ? createMetaEventContext(
              "professional-registration"
            )
          : undefined;

      const current = await session.loginWithGoogle(
        credential,
        marketing,
        meta,
        isRegister && !professionalIntent
          ? form.aceitaNotificacoesWhatsapp
          : undefined,
        isRegister
          ? professionalIntent
          : undefined
      );

      if (
        current?.contaCriada &&
        professionalIntent
      ) {
        if (meta?.event_id) {
          void trackMetaEvent(
            "CompleteRegistration",
            {},
            meta.event_id
          );
        }

        void trackGoogleSignUp(
          "google",
          current?.usuario?.id
            ? `af-signup-${current.usuario.id}`
            : undefined
        );
      }

      finish(current);
    } catch (requestError) {
      if (requestError.name !== "AbortError") setError(requestError.message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [finish, form.aceitaNotificacoesWhatsapp, isRegister, professionalIntent, session]);

  if (session.loading) {
    return <main className="auth-page"><LoadingState>Carregando sua conta...</LoadingState></main>;
  }
  if (session.syncError && !session.usuario) {
    return <main className="auth-page"><ErrorState message={session.syncError} onRetry={() => session.refresh().catch(() => {})} /></main>;
  }
  if (session.authenticated) {
    return <Navigate replace to={destination} />;
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (submittingRef.current || session.loading) return;
    setError("");

    if (isRegister && !registrationComplete) {
      setError(form.confirmarSenha && form.senha !== form.confirmarSenha
        ? "As senhas precisam ser iguais."
        : "Preencha todos os campos corretamente para criar sua conta.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const action = isRegister ? session.register : session.login;
      const meta =
        isRegister && professionalIntent
          ? createMetaEventContext(
              "professional-registration"
            )
          : undefined;
      const current = await action({
        ...(isRegister ? {
          nome: form.nome.trim(),
          whatsapp: form.whatsapp.replace(/\D/g, ""),
          aceitaNotificacoesWhatsapp:
            professionalIntent
              ? false
              : form.aceitaNotificacoesWhatsapp,
          marketing: getMarketingContext(
            professionalIntent
              ? "profissional"
              : "indefinida"
          ),
          perfil_profissional:
            professionalIntent,
          ...(meta ? { meta } : {})
        } : {}),
        email: form.email.trim().toLowerCase(),
        senha: form.senha
      });

      if (
        current?.contaCriada &&
        professionalIntent
      ) {
        if (meta?.event_id) {
          void trackMetaEvent(
            "CompleteRegistration",
            {},
            meta.event_id
          );
        }

        void trackGoogleSignUp(
          "email",
          current?.usuario?.id
            ? `af-signup-${current.usuario.id}`
            : undefined
        );
      }

      finish(current);
    } catch (requestError) {
      if (requestError.name !== "AbortError") setError(requestError.message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <SetupFlowFrame enabled={professionalIntent} step={1}>
    <main className="auth-page">
      <section aria-labelledby="auth-title"
        className={"auth-card" + (professionalIntent && isRegister ? " auth-card-professional-register" : "")}>
        {!professionalIntent && <p className="eyebrow">{isRegister ? "Comece agora" : "Boas-vindas"}</p>}
        <SetupTitle emoji={professionalIntent ? "💖" : undefined} id="auth-title">{isRegister ? "Crie sua conta" : "Entre no Agenda Fashion"}</SetupTitle>
        {(!professionalIntent || !isRegister) && (
          <p className="muted">
            {professionalIntent
              ? "Entre para continuar."
              : "Uma conta para agendar como cliente ou administrar seu negócio."}
          </p>
        )}

        {isRegister && !professionalIntent && (
          <label className="checkbox-label">
            <input
              checked={form.aceitaNotificacoesWhatsapp}
              onChange={(event) => update(
                "aceitaNotificacoesWhatsapp",
                event.target.checked
              )}
              type="checkbox"
            />
            <span>
              Quero receber confirmações, lembretes e atualizações dos meus agendamentos pelo WhatsApp. Posso desativar quando quiser em Minha conta.
            </span>
          </label>
        )}

        <GoogleLoginButton disabled={submitting} onAvailabilityChange={setGoogleAvailable} onCredential={handleGoogle} />
        {googleAvailable && <div className="auth-divider"><span>ou use seu e-mail</span></div>}

        <form className="stack-form" onSubmit={submit}>
          {isRegister && (
            <label>
              <AuthFieldLabel emoji={professionalIntent ? "👤" : undefined}>Nome completo</AuthFieldLabel>
              <input
                aria-label="Nome completo"
                autoComplete="name"
                maxLength={120}
                minLength="2"
                onChange={(event) => update("nome", event.target.value)}
                required
                value={form.nome}
              />
            </label>
          )}
          <label>
            <AuthFieldLabel emoji={professionalIntent ? "✉️" : undefined}>E-mail</AuthFieldLabel>
            <input
              aria-label="E-mail"
              autoComplete="email"
              maxLength={160}
              onChange={(event) => update("email", event.target.value)}
              required
              type="email"
              value={form.email}
            />
          </label>
          {isRegister && (
            <label>
              <AuthFieldLabel emoji={professionalIntent ? "📱" : undefined}>WhatsApp com DDD</AuthFieldLabel>
              <input
                aria-label="WhatsApp com DDD"
                autoComplete="tel"
                inputMode="tel"
                onChange={(event) => update("whatsapp", event.target.value)}
                pattern={WHATSAPP_PATTERN}
                required
                title="Informe um WhatsApp com DDD, usando 10 ou 11 dígitos."
                value={form.whatsapp}
              />
            </label>
          )}
          <PasswordField
            autoComplete={isRegister ? "new-password" : "current-password"}
            emoji={professionalIntent ? "🔒" : undefined}
            id="af-auth-password"
            label="Senha"
            describedBy={isRegister ? "af-auth-password-hint" : undefined}
            minLength={isRegister ? 8 : undefined}
            onChange={(event) => update("senha", event.target.value)}
            value={form.senha}
          />
          {isRegister && (
            <small id="af-auth-password-hint" className="auth-password-hint">
              Use pelo menos 8 caracteres.
            </small>
          )}
          {!isRegister && (
            <Link className="forgot-password-link" to="/esqueci-senha">
              Esqueci minha senha
            </Link>
          )}
          {isRegister && (
            <PasswordField autoComplete="new-password"
              emoji={professionalIntent ? "🔒" : undefined}
              id="af-auth-confirm-password"
              label="Confirme a senha"
              describedBy={form.confirmarSenha && form.senha !== form.confirmarSenha
                ? "af-auth-password-match-status"
                : undefined}
              minLength={8}
              onChange={(event) => update("confirmarSenha", event.target.value)}
              value={form.confirmarSenha}
            />
          )}
          {isRegister && form.confirmarSenha.length > 0 && form.senha !== form.confirmarSenha && (
            <small className="auth-password-feedback" id="af-auth-password-match-status" role="status">As senhas precisam ser iguais.</small>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-full"
            disabled={submitting || (isRegister && !registrationComplete)} type="submit">
            {submitting ? "Aguarde..." : isRegister ? "Criar conta" : "Entrar"}
          </button>
          {isRegister && !registrationComplete && !submitting && (
            <small className="auth-required-hint">Preencha os campos e confirme a senha para continuar.</small>
          )}
          {isRegister && (
            <small className="legal-agreement">
              Ao criar a conta, você declara que leu e concorda com os <Link to="/termos">Termos de uso</Link> e a <Link to="/privacidade">Política de Privacidade</Link>.
            </small>
          )}
        </form>

        {!professionalIntent && (
          <p className="auth-switch">
            Trabalha com beleza?{" "}
            <Link to={buildProfessionalSignupPath(location.search)}>Cadastrar meu negócio</Link>
          </p>
        )}
        <p className="auth-switch">
          {isRegister ? "Já tem uma conta?" : "Ainda não tem conta?"}{" "}
          <Link
            state={location.state}
            to={`${isRegister ? "/entrar" : "/cadastro"}${location.search}`}
          >
            {isRegister ? "Entrar" : "Criar conta"}
          </Link>
        </p>
      </section>
    </main>
    </SetupFlowFrame>
  );
}
