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
    <section className="panel marketing-ga4-panel" aria-label="Google Analytics 4">
      <div className="marketing-ga4-heading">
        <div>
          <p className="eyebrow">Comportamento</p>
          <h2>Google Analytics 4</h2>
          <p className="muted">
            O GA4 explica como as pessoas chegam e navegam. Ativação, agendamento,
            assinatura e receita continuam vindo do banco do Agenda Fashion.
          </p>
        </div>
        <span
          className={`admin-status-badge ${
            configured ? "is-success" : enabled ? "is-warning" : "is-muted"
          }`}
        >
          {configured
            ? "Leitura conectada"
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
          <strong>Coleta e leitura são configurações diferentes</strong>
          <p>
            O AF já possui suporte à coleta GA4 com consentimento. Para exibir relatórios aqui,
            configure a Data API e conceda acesso de leitura da propriedade à conta
            de serviço do backend.
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
                Use estes números como leitura de comportamento; as métricas comerciais
                e financeiras continuam vindo do AF.
              </p>
            </div>
          )}

          <div className="marketing-ga4-kpis" aria-label="Resumo do GA4">
            {[
              ["Sessões", number(summary.sessoes)],
              ["Usuários", number(summary.usuarios)],
              ["Novos usuários", number(summary.novosUsuarios)],
              ["Sessões engajadas", number(summary.sessoesEngajadas)],
              ["Taxa de engajamento", formatPercent(summary.taxaEngajamentoPercentual)],
              ["Visualizações", number(summary.visualizacoes)]
            ].map(([label, value]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>

          <div className="marketing-ga4-grid">
            <section className="marketing-ga4-block" aria-label="Canais no GA4">
              <div className="marketing-ga4-block-heading">
                <strong>Canais</strong>
                <small>Origem da sessão</small>
              </div>
              {channels.length === 0 ? (
                <EmptyList>Sem sessões por canal neste período.</EmptyList>
              ) : (
                <div className="marketing-ga4-list">
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
                </div>
              )}
            </section>

            <section className="marketing-ga4-block" aria-label="Dispositivos no GA4">
              <div className="marketing-ga4-block-heading">
                <strong>Dispositivos</strong>
                <small>Onde a experiência acontece</small>
              </div>
              {devices.length === 0 ? (
                <EmptyList>Sem dados de dispositivo neste período.</EmptyList>
              ) : (
                <div className="marketing-ga4-list">
                  {devices.map((item, index) => (
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
                </div>
              )}
            </section>

            <section className="marketing-ga4-block" aria-label="Localidades no GA4">
              <div className="marketing-ga4-block-heading">
                <strong>Localização</strong>
                <small>Distribuição geográfica agregada</small>
              </div>
              {locations.length === 0 ? (
                <EmptyList>Sem dados de localização neste período.</EmptyList>
              ) : (
                <div className="marketing-ga4-list">
                  {locations.slice(0, 8).map((item, index) => (
                    <article key={`${item.pais}-${item.regiao}-${item.cidade}-${index}`}>
                      <div>
                        <strong>{item.cidade || "Não identificada"}</strong>
                        <small>
                          {[item.regiao, item.pais].filter(Boolean).join(" · ")}
                        </small>
                      </div>
                      <div className="marketing-ga4-list-value">
                        <strong>{number(item.sessoes)}</strong>
                        <small>sessões</small>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="marketing-ga4-block" aria-label="Campanhas vistas pelo GA4">
            <div className="marketing-ga4-block-heading">
              <strong>Campanhas vistas pelo GA4</strong>
              <small>Para comparar comportamento com a atribuição oficial do AF</small>
            </div>
            {campaigns.length === 0 ? (
              <EmptyList>Nenhuma campanha identificada pelo GA4 neste período.</EmptyList>
            ) : (
              <div className="marketing-ga4-campaign-grid">
                {campaigns.slice(0, 8).map((item, index) => (
                  <article key={`${item.id || item.nome}-${index}`}>
                    <div>
                      <strong>{item.nome || "Campanha não identificada"}</strong>
                      <small>
                        {item.origem} / {item.midia}
                        {item.id && item.id !== "(not set)" ? ` · ID ${item.id}` : ""}
                      </small>
                    </div>
                    <div className="marketing-ga4-mini-metrics">
                      <span><strong>{number(item.sessoes)}</strong> sessões</span>
                      <span><strong>{number(item.usuarios)}</strong> usuários</span>
                      <span><strong>{number(item.sessoesEngajadas)}</strong> engajadas</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="marketing-ga4-block" aria-label="Landing pages no GA4">
            <div className="marketing-ga4-block-heading">
              <strong>Landing pages</strong>
              <small>Caminho sem query string, UTMs ou click IDs</small>
            </div>
            {landingPages.length === 0 ? (
              <EmptyList>Sem landing pages no período selecionado.</EmptyList>
            ) : (
              <div className="marketing-ga4-landing-list">
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
