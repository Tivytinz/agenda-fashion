import { useCallback, useMemo, useState } from "react";
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
import { GoogleLoginButton } from "../components/GoogleLoginButton";

export const WHATSAPP_PATTERN = "(?:[^0-9]*[0-9]){10,11}[^0-9]*";

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
    aceitaLembretesWhatsapp: false
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const authIntent = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const planSlug = normalizePlanSlug(params.get("plano"));

    return {
      planSlug,
      professional: params.get("tipo") === "profissional" || Boolean(planSlug)
    };
  }, [location.search]);
  const professionalIntent = isRegister && authIntent.professional;

  const destination = useMemo(() => getAuthDestination(session, {
    requestedPath: safeReturnPath(location.state?.from),
    planSlug: authIntent.planSlug
  }), [authIntent.planSlug, location.state, session]);

  const finish = useCallback((current) => {
    navigate(getAuthDestination(current, {
      requestedPath: safeReturnPath(location.state?.from),
      planSlug: authIntent.planSlug
    }), { replace: true });
  }, [authIntent.planSlug, location.state, navigate]);

  const handleGoogle = useCallback(async (credential) => {
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
        meta
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
          "google"
        );
      }

      finish(current);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }, [finish, isRegister, professionalIntent, session]);

  if (!session.loading && session.authenticated) {
    return <Navigate replace to={destination} />;
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");

    if (isRegister && form.senha !== form.confirmarSenha) {
      setError("As senhas precisam ser iguais.");
      return;
    }

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
          aceitaLembretesWhatsapp:
            professionalIntent && form.aceitaLembretesWhatsapp,
          marketing: getMarketingContext(
            professionalIntent
              ? "profissional"
              : "indefinida"
          ),
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
          "email"
        );
      }

      finish(current);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">{isRegister ? "Comece agora" : "Boas-vindas"}</p>
        <h1 id="auth-title">{isRegister ? "Crie sua conta" : "Entre no Agenda Fashion"}</h1>
        <p className="muted">
          {professionalIntent
            ? "Crie sua conta para montar seu negócio, publicar serviços e receber agendamentos."
            : "Uma conta para agendar como cliente ou administrar seu negócio."}
        </p>

        <GoogleLoginButton onCredential={handleGoogle} />
        <div className="auth-divider"><span>ou continue com e-mail</span></div>

        <form className="stack-form" onSubmit={submit}>
          {isRegister && (
            <label>
              Nome completo
              <input
                autoComplete="name"
                minLength="2"
                onChange={(event) => update("nome", event.target.value)}
                required
                value={form.nome}
              />
            </label>
          )}
          <label>
            E-mail
            <input
              autoComplete="email"
              onChange={(event) => update("email", event.target.value)}
              required
              type="email"
              value={form.email}
            />
          </label>
          {isRegister && (
            <label>
              WhatsApp com DDD
              <input
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
          <label>
            Senha
            <input
              autoComplete={isRegister ? "new-password" : "current-password"}
              minLength="8"
              onChange={(event) => update("senha", event.target.value)}
              required
              type="password"
              value={form.senha}
            />
          </label>
          {!isRegister && (
            <Link className="forgot-password-link" to="/esqueci-senha">
              Esqueci minha senha
            </Link>
          )}
          {isRegister && (
            <label>
              Confirme a senha
              <input
                autoComplete="new-password"
                minLength="8"
                onChange={(event) => update("confirmarSenha", event.target.value)}
                required
                type="password"
                value={form.confirmarSenha}
              />
            </label>
          )}
          {professionalIntent && (
            <label className="checkbox-label">
              <input
                checked={form.aceitaLembretesWhatsapp}
                onChange={(event) => update(
                  "aceitaLembretesWhatsapp",
                  event.target.checked
                )}
                type="checkbox"
              />
              <span>
                Quero receber no WhatsApp um lembrete por dia para concluir e divulgar meu negócio. Posso desativar quando quiser.
              </span>
            </label>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-full" disabled={submitting} type="submit">
            {submitting ? "Aguarde..." : isRegister ? "Criar conta" : "Entrar"}
          </button>
        </form>

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
  );
}
