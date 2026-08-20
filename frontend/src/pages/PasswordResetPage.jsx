import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiRequest } from "../api/client";

export function PasswordResetPage({ mode = "request" }) {
  const isReset = mode === "reset";
  const location = useLocation();
  const token = new URLSearchParams(location.search).get("token") || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setMessage("");

    if (isReset && password !== confirmation) {
      setStatus("error");
      setMessage("As senhas precisam ser iguais.");
      return;
    }

    setStatus("loading");

    try {
      const result = await apiRequest(
        isReset ? "/auth/redefinir-senha" : "/auth/esqueci-senha",
        {
          method: "POST",
          body: isReset
            ? { token, senha: password }
            : { email: email.trim().toLowerCase() },
        }
      );

      setStatus("success");
      setMessage(result.mensagem);
      setPassword("");
      setConfirmation("");
    } catch (error) {
      setStatus("error");
      setMessage(error.message);
    }
  }

  const missingToken = isReset && !token;
  const completedReset = isReset && status === "success";

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="password-reset-title">
        <p className="eyebrow">Acesso à conta</p>
        <h1 id="password-reset-title">
          {isReset ? "Crie uma nova senha" : "Esqueceu sua senha?"}
        </h1>
        <p className="muted">
          {isReset
            ? "Escolha uma nova senha com pelo menos 8 caracteres."
            : "Informe seu e-mail e enviaremos um link seguro para você voltar à sua conta."}
        </p>

        {missingToken ? (
          <div className="stack-form password-reset-state">
            <p className="form-error" role="alert">
              Este link de recuperação está incompleto.
            </p>
            <Link className="button button-full" to="/esqueci-senha">
              Solicitar outro link
            </Link>
          </div>
        ) : completedReset ? (
          <div className="stack-form password-reset-state">
            <p className="form-success" role="status">{message}</p>
            <Link className="button button-full" to="/entrar">
              Entrar com a nova senha
            </Link>
          </div>
        ) : (
          <form className="stack-form password-reset-form" onSubmit={submit}>
            {isReset ? (
              <>
                <label>
                  Nova senha
                  <input
                    autoComplete="new-password"
                    minLength="8"
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    type="password"
                    value={password}
                  />
                </label>
                <label>
                  Confirme a nova senha
                  <input
                    autoComplete="new-password"
                    minLength="8"
                    onChange={(event) => setConfirmation(event.target.value)}
                    required
                    type="password"
                    value={confirmation}
                  />
                </label>
              </>
            ) : (
              <label>
                E-mail da conta
                <input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>
            )}

            {message && (
              <p
                className={status === "success" ? "form-success" : "form-error"}
                role={status === "success" ? "status" : "alert"}
              >
                {message}
              </p>
            )}

            {status !== "success" && (
              <button
                className="button button-full"
                disabled={status === "loading"}
                type="submit"
              >
                {status === "loading"
                  ? "Aguarde..."
                  : isReset
                    ? "Salvar nova senha"
                    : "Enviar link de recuperação"}
              </button>
            )}
          </form>
        )}

        {!completedReset && (
          <p className="auth-switch">
            <Link to="/entrar">Voltar para entrar</Link>
          </p>
        )}
      </section>
    </main>
  );
}
