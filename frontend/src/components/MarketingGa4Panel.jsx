function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPercent(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "Sem base";
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1
  }).format(parsed)}%`;
}

function deviceLabel(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "mobile") return "Celular";
  if (normalized === "desktop") return "Computador";
  if (normalized === "tablet") return "Tablet";
  return value || "Não identificado";
}

function EmptyList({ children }) {
  return <p className="muted marketing-ga4-empty">{children}</p>;
}

function AnalyticsList({ children }) {
  return <div className="marketing-ga4-list marketing-ga4-list-v3">{children}</div>;
}

export function MarketingGa4Panel({ data }) {
  const configured = data?.configurado === true;
  const enabled = data?.habilitado === true;
  const summary = data?.resumo || {};
  const channels = data?.canais || [];
  const campaigns = data?.campanhas || [];
  const landingPages = data?.landingPages || [];
  const devices = data?.dispositivos || [];
  const locations = data?.localidades || [];

  return (
    <section
      className="panel marketing-ga4-panel marketing-ga4-panel-v3"
      aria-label="Google Analytics 4"
    >
      <div className="marketing-ga4-heading marketing-ga4-heading-v3">
        <div>
          <p className="eyebrow">Comportamento no site</p>
          <h2>O que acontece depois do clique</h2>
          <p className="muted">
            O GA4 mostra navegação e interesse. Ativação, agendamento, assinatura
            e receita continuam vindo do banco do Agenda Fashion.
          </p>
        </div>
        <span
          className={`admin-status-badge ${
            configured ? "is-success" : enabled ? "is-warning" : "is-muted"
          }`}
        >
          {configured
            ? "GA4 conectado"
            : enabled
              ? "Configuração incompleta"
              : "Leitura desativada"}
        </span>
      </div>

      {data?.erro ? (
        <div className="marketing-ga4-notice is-warning" role="status">
          <strong>GA4 temporariamente indisponível</strong>
          <p>{data.erro}</p>
        </div>
      ) : !configured ? (
        <div className="marketing-ga4-notice">
          <strong>Leitura do GA4 ainda não está disponível</strong>
          <p>
            A coleta e a leitura administrativa são configurações diferentes.
            Quando a Data API estiver disponível, o comportamento aparecerá aqui
            sem alterar a fonte de verdade do funil do AF.
          </p>
        </div>
      ) : (
        <>
          {(data.amostrado || data.dadosLimitados) && (
            <div className="marketing-ga4-notice is-warning" role="status">
              <strong>O GA4 aplicou limites ao relatório</strong>
              <p>
                {data.amostrado ? "Há amostragem nos dados. " : ""}
                {data.dadosLimitados
                  ? "Também pode haver agregação por cardinalidade ou limiar de privacidade. "
                  : ""}
                Use estes números como leitura de comportamento; as métricas
                comerciais e financeiras continuam vindo do AF.
              </p>
            </div>
          )}

          <div className="marketing-ga4-kpis marketing-ga4-kpis-v3" aria-label="Resumo do GA4">
            {[
              ["Sessões", number(summary.sessoes), "visitas no período"],
              ["Usuários", number(summary.usuarios), `${number(summary.novosUsuarios)} novos`],
              [
                "Engajamento",
                formatPercent(summary.taxaEngajamentoPercentual),
                `${number(summary.sessoesEngajadas)} sessões engajadas`
              ],
              ["Visualizações", number(summary.visualizacoes), "páginas e telas vistas"]
            ].map(([label, value, hint]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{hint}</small>
              </article>
            ))}
          </div>

          <div className="marketing-ga4-priority-grid">
            <section className="marketing-ga4-block" aria-label="Canais no GA4">
              <div className="marketing-ga4-block-heading">
                <div>
                  <strong>De onde chegam</strong>
                  <small>Canais e origem da sessão</small>
                </div>
              </div>
              {channels.length === 0 ? (
                <EmptyList>Sem sessões por canal neste período.</EmptyList>
              ) : (
                <AnalyticsList>
                  {channels.slice(0, 8).map((item, index) => (
                    <article key={`${item.canal}-${item.origem}-${item.midia}-${index}`}>
                      <div>
                        <strong>{item.canal}</strong>
                        <small>{item.origem} / {item.midia}</small>
                      </div>
                      <div className="marketing-ga4-list-value">
                        <strong>{number(item.sessoes)}</strong>
                        <small>sessões</small>
                      </div>
                    </article>
                  ))}
                </AnalyticsList>
              )}
            </section>

            <section className="marketing-ga4-block" aria-label="Landing pages no GA4">
              <div className="marketing-ga4-block-heading">
                <div>
                  <strong>Onde entram</strong>
                  <small>Landing pages sem query string ou click IDs</small>
                </div>
              </div>
              {landingPages.length === 0 ? (
                <EmptyList>Sem landing pages no período selecionado.</EmptyList>
              ) : (
                <div className="marketing-ga4-landing-list marketing-ga4-landing-list-v3">
                  {landingPages.slice(0, 8).map((item, index) => (
                    <article key={`${item.pagina}-${index}`}>
                      <strong>{item.pagina}</strong>
                      <span>{number(item.sessoes)} sessões</span>
                      <span>{number(item.usuarios)} usuários</span>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="marketing-ga4-secondary-grid">
            <section className="marketing-ga4-block" aria-label="Campanhas vistas pelo GA4">
              <div className="marketing-ga4-block-heading">
                <div>
                  <strong>Campanhas no GA4</strong>
                  <small>Comportamento, não atribuição financeira</small>
                </div>
              </div>
              {campaigns.length === 0 ? (
                <EmptyList>Nenhuma campanha identificada pelo GA4 neste período.</EmptyList>
              ) : (
                <AnalyticsList>
                  {campaigns.slice(0, 6).map((item, index) => (
                    <article key={`${item.id || item.nome}-${index}`}>
                      <div>
                        <strong>{item.nome || "Campanha não identificada"}</strong>
                        <small>
                          {item.origem} / {item.midia}
                          {item.id && item.id !== "(not set)" ? ` · ID ${item.id}` : ""}
                        </small>
                      </div>
                      <div className="marketing-ga4-list-value">
                        <strong>{number(item.sessoes)}</strong>
                        <small>{number(item.sessoesEngajadas)} engajadas</small>
                      </div>
                    </article>
                  ))}
                </AnalyticsList>
              )}
            </section>

            <section className="marketing-ga4-block" aria-label="Dispositivos no GA4">
              <div className="marketing-ga4-block-heading">
                <div>
                  <strong>Dispositivos</strong>
                  <small>Onde a experiência acontece</small>
                </div>
              </div>
              {devices.length === 0 ? (
                <EmptyList>Sem dados de dispositivo neste período.</EmptyList>
              ) : (
                <AnalyticsList>
                  {devices.slice(0, 5).map((item, index) => (
                    <article key={`${item.categoria}-${index}`}>
                      <div>
                        <strong>{deviceLabel(item.categoria)}</strong>
                        <small>{number(item.usuarios)} usuários</small>
                      </div>
                      <div className="marketing-ga4-list-value">
                        <strong>{number(item.sessoes)}</strong>
                        <small>sessões</small>
                      </div>
                    </article>
                  ))}
                </AnalyticsList>
              )}
            </section>

            <section className="marketing-ga4-block" aria-label="Localidades no GA4">
              <div className="marketing-ga4-block-heading">
                <div>
                  <strong>Localização</strong>
                  <small>Distribuição geográfica agregada</small>
                </div>
              </div>
              {locations.length === 0 ? (
                <EmptyList>Sem dados de localização neste período.</EmptyList>
              ) : (
                <AnalyticsList>
                  {locations.slice(0, 6).map((item, index) => (
                    <article key={`${item.pais}-${item.regiao}-${item.cidade}-${index}`}>
                      <div>
                        <strong>{item.cidade || "Não identificada"}</strong>
                        <small>{[item.regiao, item.pais].filter(Boolean).join(" · ")}</small>
                      </div>
                      <div className="marketing-ga4-list-value">
                        <strong>{number(item.sessoes)}</strong>
                        <small>sessões</small>
                      </div>
                    </article>
                  ))}
                </AnalyticsList>
              )}
            </section>
          </div>

          <p className="marketing-ga4-footnote">
            Fonte: {data.fonte || "Google Analytics 4"}
            {data?.metadados?.fusoHorario
              ? ` · fuso ${data.metadados.fusoHorario}`
              : ""}
          </p>
        </>
      )}
    </section>
  );
}
