import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, details) {
    console.error("Falha inesperada na interface", error, details);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="fatal-error-page">
        <div className="screen-state error-state" role="alert">
          <strong>Não conseguimos abrir esta página</strong>
          <p>Atualize a página para tentar novamente. Seu agendamento ainda não foi confirmado.</p>
          <div className="fatal-error-actions">
            <button className="button" onClick={() => window.location.reload()} type="button">
              Atualizar página
            </button>
            <a className="button button-secondary" href="/">Voltar ao início</a>
          </div>
        </div>
      </main>
    );
  }
}
