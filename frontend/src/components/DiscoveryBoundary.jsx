import { Component } from "react";
import { reloadWithFreshAssets } from "../utils/runtimeRecovery";

export class DiscoveryBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="container screen-state error-state" role="alert">
        <strong>Não conseguimos carregar o catálogo</strong>
        <p>Atualize a página para exibir os profissionais e serviços.</p>
        <button className="button button-secondary" onClick={() => reloadWithFreshAssets()} type="button">
          Atualizar página
        </button>
      </div>
    );
  }
}
