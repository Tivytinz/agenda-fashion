import { Component } from "react";
import { useLocation } from "react-router-dom";

class ContentErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, details) {
    console.error("Falha inesperada no conteúdo da área de trabalho", error, details);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="workspace-page">
        <div className="screen-state error-state" role="alert">
          <strong>Não conseguimos abrir este conteúdo</strong>
          <p>A navegação continua disponível. Atualize a página para tentar novamente.</p>
          <button
            className="button"
            onClick={() => window.location.reload()}
            type="button"
          >
            Atualizar página
          </button>
        </div>
      </main>
    );
  }
}

export function ShellContentBoundary({ children }) {
  const { pathname } = useLocation();

  return (
    <ContentErrorBoundary key={pathname}>
      {children}
    </ContentErrorBoundary>
  );
}
