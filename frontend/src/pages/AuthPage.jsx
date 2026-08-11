import { useCallback, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  createMetaEventContext,
  trackMetaEvent
} from "../analytics/metaAds";
import { getMarketingContext } from "../analytics/track";
import { getWorkspacePath } from "../auth/session";
import { useSession } from "../auth/SessionContext";
import { GoogleLoginButton } from "../components/GoogleLoginButton";

export function safeReturnPath(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "";
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
    confirmarSenha: ""
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const professionalIntent = useMemo(() => {
    if (!isRegister) return false;

    const params = new URLSearchParams(location.search);
    return params.get("tipo") === "profissional";
  }, [isRegister, location.search]);

  const finish = useCallback((current) => {
    const requested = safeReturnPath(location.state?.from);
    navigate(requested || getWorkspacePath(current), { replace: true });
  }, [location.state, navigate]);

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
        professionalIntent &&
        meta?.event_id
      ) {
        void trackMetaEvent(
          "CompleteRegistration",
          {},
          meta.event_id
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
    return <Navigate replace to={getWorkspacePath(session)} />;
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
        professionalIntent &&
        meta?.event_id
      ) {
        void trackMetaEvent(
          "CompleteRegistration",
          {},
          meta.event_id
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
                pattern="(?:\\D*\\d){10,11}\\D*"
                required
                value={form.whatsapp}
              />
            </label>
          )}
          <label>
            Senha
            <input
              autoComplete={isRegister ? "new-password" : "current-password"}
              minLength="6"
              onChange={(event) => update("senha", event.target.value)}
              required
              type="password"
              value={form.senha}
            />
          </label>
          {isRegister && (
            <label>
              Confirme a senha
              <input
                autoComplete="new-password"
                minLength="6"
                onChange={(event) => update("confirmarSenha", event.target.value)}
                required
                type="password"
                value={form.confirmarSenha}
              />
            </label>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-full" disabled={submitting} type="submit">
            {submitting ? "Aguarde..." : isRegister ? "Criar conta" : "Entrar"}
          </button>
        </form>

        <p className="auth-switch">
          {isRegister ? "Já tem uma conta?" : "Ainda não tem conta?"}{" "}
          <Link to={isRegister ? "/entrar" : "/cadastro"}>
            {isRegister ? "Entrar" : "Criar conta"}
          </Link>
        </p>
      </section>
    </main>
  );
}
