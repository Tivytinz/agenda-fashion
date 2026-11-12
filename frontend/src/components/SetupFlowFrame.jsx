import { Link } from "react-router-dom";
import logo from "../assets/brand/performance/af-logo-96.webp";
import { useSetupFrame } from "./SetupFlowContext";
import "../styles/setup-flow.css";

const STEPS = ["Conta", "Negócio", "Serviço", "Horários"];

export function SetupTitle({ children, emoji, id }) {
  if (!emoji) return <h1 id={id}>{children}</h1>;
  return (
    <div className="setup-title">
      <span aria-hidden="true" className="setup-title-emoji">{emoji}</span>
      <h1 id={id}>{children}</h1>
    </div>
  );
}

export function SetupFlowFrame({ children, enabled = true, step, complete = false, wide = false, exitTo = "/", backTo, backDisabled = false, onExit }) {
  useSetupFrame(enabled);
  if (!enabled) return children;

  return (
    <div className={`setup-flow${wide ? " setup-flow-wide" : ""}${backTo ? " setup-flow-has-back" : ""}`}>
      <header className="setup-topbar">
        <span className="setup-brand"><img alt="" height="36" src={logo} width="36" />Agenda Fashion</span>
        <div className="setup-topbar-actions">
          {backTo && (backDisabled
            ? <span aria-disabled="true" className="setup-back is-disabled"><span aria-hidden="true">←</span>Voltar</span>
            : <Link className="setup-back" to={backTo}><span aria-hidden="true">←</span>Voltar</Link>)}
          <Link className="setup-exit setup-exit-button" onClick={onExit} to={exitTo}>
            <span aria-hidden="true">↗</span>Sair
          </Link>
        </div>
      </header>
      <div className="setup-body">
        {!complete && (
          <div aria-label={`Etapa ${step} de 4: ${STEPS[step - 1]}`} className="setup-progress">
            <p><span>{STEPS[step - 1]}</span><span>{step} de 4</span></p>
            <div aria-hidden="true"><span style={{ width: `${step * 25}%` }} /></div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
