import { MarketingCostIntegrationsPanel } from "../components/MarketingCostIntegrationsPanel";

export function AdminMarketingIntegrationsPage() {
  return (
    <main className="admin-page admin-workspace-page admin-marketing-page admin-integrations-page">
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Marketing</p>
          <h1>Integrações de mídia</h1>
          <p>Confira as conexões, vincule campanhas e acompanhe a sincronização dos custos.</p>
        </div>
      </header>
      <MarketingCostIntegrationsPanel />
    </main>
  );
}
