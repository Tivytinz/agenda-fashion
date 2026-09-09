import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import {
  EmptyState,
  ErrorState,
  LoadingState
} from "../components/ScreenState";
import {
  ADMIN_PERIODS,
  adminPeriodLabel,
  normalizeAdminPeriod,
  setPeriodSearchParam
} from "../utils/adminPeriods";
import "../styles/admin-refinements.css";

const CHANNEL_LABELS = {
  paid_search: "Busca paga",
  paid_social: "Social pago",
  organic_search: "Busca orgânica",
  ai_assistant: "Assistente de IA",
  direct: "Direto",
  referral: "Referência",
  email: "E-mail",
  organic_social: "Social orgânico",
  other: "Outros",
  unknown: "Não identificado"
};

const PAGE_LABELS = {
  home: "Página inicial",
  professional_landing: "Landing de profissionais",
  login: "Entrar",
  register: "Cadastro",
  create_business: "Criar negócio",
  plans: "Planos",
  checkout: "Checkout",
  owner_dashboard: "Painel profissional",
  owner_agenda: "Agenda do negócio",
  services: "Serviços",
  new_service: "Novo serviço",
  edit_service: "Editar serviço",
  schedule_settings: "Horários",
  business_settings: "Meu negócio",
  subscription: "Assinatura",
  account: "Conta",
  favorites: "Favoritos",
  customer_agenda: "Agenda da cliente",
  business_profile: "Perfil do negócio",
  local_catalog: "Catálogo local",
  other: "Outra página"
};

const EVENT_LABELS = {
  business_creation_started: "Criação de negócio iniciada",
  first_service_creation_started: "Primeiro serviço iniciado",
  profile_shared: "Perfil compartilhado",
  booking_started: "Agendamento iniciado",
  checkout_viewed: "Checkout visualizado"
};

function number(value) {
  const converted = Number(value);
  return Number.isFinite(converted) ? converted : 0;
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(number(value));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(number(value));
}

function formatCentavos(value) {
  if (value === null || value === undefined) return "—";
  return formatCurrency(number(value) / 100);
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1
  }).format(number(value))}%`;
}

function formatSeconds(value) {
  if (value === null || value === undefined) return "—";
  const seconds = number(value);
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return remaining > 0 ? `${minutes}min ${remaining}s` : `${minutes}min`;
}

function MetricCard({ hint, label, tone = "neutral", value }) {
  return (
    <article className={`admin-command-metric is-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function PeriodSelector({ period, refreshing, searchParams, setSearchParams }) {
  return (
    <div className="segmented-control" aria-label="Período administrativo">
      {ADMIN_PERIODS.map(([value, label]) => (
        <button
          aria-pressed={period === value}
          className={period === value ? "active" : ""}
          disabled={refreshing}
          key={value}
          onClick={() => {
            if (period === value) return;
            setSearchParams(setPeriodSearchParam(searchParams, value));
          }}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function useAdminSection(section) {
  const [searchParams, setSearchParams] = useSearchParams();
  const period = normalizeAdminPeriod(searchParams.get("periodo"));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setRefreshing(true);
    setError("");

    apiRequest(`/admin/analytics-v2/${section}?periodo=${period}`, {
      signal: controller.signal
    })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((requestError) => {
        if (active && requestError.name !== "AbortError") {
          setError(requestError.message || "Não foi possível carregar esta visão administrativa.");
        }
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [period, reloadKey, section]);

  return {
    data,
    error,
    period,
    refreshing,
    retry: () => setReloadKey((current) => current + 1),
    searchParams,
    setSearchParams
  };
}

function AdminSectionFrame({
  children,
  eyebrow,
  title,
  description,
  state
}) {
  const {
    data,
    error,
    period,
    refreshing,
    retry,
    searchParams,
    setSearchParams
  } = state;

  if (!data && !error) {
    return (
      <main className="workspace-page admin-workspace-page admin-command-page">
        <LoadingState>Carregando {title.toLocaleLowerCase("pt-BR")}...</LoadingState>
      </main>
    );
  }

  if (!data && error) {
    return (
      <main className="workspace-page admin-workspace-page admin-command-page">
        <ErrorState message={error} onRetry={retry} />
      </main>
    );
  }

  return (
    <main
      aria-busy={refreshing}
      className="workspace-page admin-workspace-page admin-command-page"
    >
      <header className="workspace-heading admin-command-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <PeriodSelector
          period={period}
          refreshing={refreshing}
          searchParams={searchParams}
          setSearchParams={setSearchParams}
        />
      </header>

      {refreshing && data && (
        <p className="data-refresh-status" role="status">
          Atualizando o recorte sem ocultar os últimos dados válidos…
        </p>
      )}
      {error && data && (
        <p className="form-error" role="alert">
          {error} Os últimos dados válidos continuam visíveis.
        </p>
      )}

      <section className="admin-period-context" aria-label="Recorte temporal">
        <span>Período</span>
        <strong>{adminPeriodLabel(data?.periodo || period)}</strong>
      </section>

      {children(data)}
    </main>
  );
}

export function AdminOverviewV2Page() {
  const state = useAdminSection("overview");

  return (
    <AdminSectionFrame
      description="O que entrou no AF, quanto valor foi entregue e quanto virou receita — sem misturar intenção com resultado."
      eyebrow="Administração"
      state={state}
      title="Visão geral"
    >
      {(data) => {
        const audience = data.audiencia || {};
        const acquisition = data.aquisicao || {};
        const activation = data.ativacao || {};
        const demand = data.demanda || {};
        const revenue = data.receita || {};

        const activationSteps = [
          ["Cadastros profissionais", acquisition.cadastrosProfissionais],
          ["Negócios criados", activation.negociosCriados],
          ["Serviços criados", activation.servicosCriados],
          ["Negócios publicados", activation.negociosPublicados],
          ["1º agendamento válido", activation.primeirosAgendamentos],
          ["Assinaturas pagas", revenue.assinaturasAtivadasCohorte]
        ];

        return (
          <>
            <section className="admin-command-summary-grid is-period-summary">
              <MetricCard
                hint="identidades first-party com atividade no período"
                label="Usuários ativos"
                value={formatNumber(audience.usuariosAtivos)}
              />
              <MetricCard
                hint="coorte de profissionais cadastrados no período"
                label="Cadastros profissionais"
                value={formatNumber(acquisition.cadastrosProfissionais)}
              />
              <MetricCard
                hint={`${formatPercent(activation.taxaPrimeiroAgendamentoSobreCadastro)} dos cadastros da coorte`}
                label="1º agendamento"
                tone={number(activation.primeirosAgendamentos) > 0 ? "success" : "neutral"}
                value={formatNumber(activation.primeirosAgendamentos)}
              />
              <MetricCard
                hint="somente pagamentos confirmados/recebidos de planos pagos no período"
                label="Receita confirmada"
                tone={number(revenue.receitaConfirmada) > 0 ? "success" : "neutral"}
                value={formatCurrency(revenue.receitaConfirmada)}
              />
            </section>

            <section className="panel admin-command-funnel-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Ativação e monetização</p>
                  <h2>Coorte profissional: do cadastro à assinatura</h2>
                  <p className="muted">
                    Todos os marcos deste funil acompanham os profissionais cadastrados no período selecionado. Receita confirmada e pagamentos do período ficam separados porque são fatos financeiros, não etapas desta coorte.
                  </p>
                </div>
              </div>
              <div className="admin-command-funnel is-milestones">
                {activationSteps.map(([label, value]) => (
                  <article key={label}>
                    <small>{label}</small>
                    <strong>{formatNumber(value)}</strong>
                  </article>
                ))}
              </div>
              <dl className="admin-command-data-list">
                <div>
                  <dt>Cadastro → negócio</dt>
                  <dd>{formatPercent(activation.taxaNegocioSobreCadastro)}</dd>
                </div>
                <div>
                  <dt>Cadastro → serviço</dt>
                  <dd>{formatPercent(activation.taxaServicoSobreCadastro)}</dd>
                </div>
                <div>
                  <dt>Cadastro → publicação</dt>
                  <dd>{formatPercent(activation.taxaPublicacaoSobreCadastro)}</dd>
                </div>
                <div>
                  <dt>Cadastro → 1º agendamento</dt>
                  <dd>{formatPercent(activation.taxaPrimeiroAgendamentoSobreCadastro)}</dd>
                </div>
                <div>
                  <dt>Cadastro → assinatura paga</dt>
                  <dd>{formatPercent(revenue.taxaAssinaturaSobreCadastro)}</dd>
                </div>
              </dl>
            </section>

            <div className="admin-command-two-column">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Uso do produto</p>
                    <h2>Engajamento first-party</h2>
                  </div>
                </div>
                <dl className="admin-command-data-list">
                  <div><dt>Sessões</dt><dd>{formatNumber(audience.sessoes)}</dd></div>
                  <div><dt>Visualizações</dt><dd>{formatNumber(audience.visualizacoes)}</dd></div>
                  <div><dt>Tempo médio por sessão</dt><dd>{formatSeconds(audience.tempoMedioSessaoSegundos)}</dd></div>
                </dl>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Demanda e receita</p>
                    <h2>Fatos ocorridos no período</h2>
                  </div>
                </div>
                <dl className="admin-command-data-list">
                  <div><dt>Agendamentos válidos</dt><dd>{formatNumber(demand.agendamentosValidos)}</dd></div>
                  <div><dt>Pagamentos confirmados</dt><dd>{formatNumber(revenue.pagamentosConfirmados)}</dd></div>
                  <div><dt>Negócios com pagamento no período</dt><dd>{formatNumber(revenue.negociosComPagamento)}</dd></div>
                </dl>
              </section>
            </div>

            <details className="admin-metric-definition">
              <summary>Fontes e critérios desta visão</summary>
              <p>{data.metodologia?.audiencia}</p>
              <p>{data.metodologia?.ativacao}</p>
              <p>{data.metodologia?.receita}</p>
            </details>
          </>
        );
      }}
    </AdminSectionFrame>
  );
}

export function AdminAcquisitionV2Page() {
  const state = useAdminSection("acquisition");

  return (
    <AdminSectionFrame
      description="Origem das sessões e qualidade dos profissionais adquiridos, separando tráfego de ativação e receita."
      eyebrow="Crescimento"
      state={state}
      title="Aquisição"
    >
      {(data) => {
        const origins = Array.isArray(data.sessoesPorOrigem) ? data.sessoesPorOrigem : [];
        const campaigns = Array.isArray(data.funilPorCampanha) ? data.funilPorCampanha : [];
        const totals = campaigns.reduce((acc, campaign) => ({
          cadastros: acc.cadastros + number(campaign.cadastros),
          primeiros: acc.primeiros + number(campaign.primeirosAgendamentos),
          pagas: acc.pagas + number(campaign.assinaturasAtivadas),
          investimento: acc.investimento + number(campaign.investimentoCentavos),
          receita: acc.receita + number(campaign.receitaPrimeiroPagamentoCentavos)
        }), { cadastros: 0, primeiros: 0, pagas: 0, investimento: 0, receita: 0 });

        return (
          <>
            <section className="admin-command-summary-grid is-period-summary">
              <MetricCard label="Cadastros atribuídos" hint="profissionais na coorte de aquisição" value={formatNumber(totals.cadastros)} />
              <MetricCard label="1º agendamento" hint="valor entregue pelos adquiridos" value={formatNumber(totals.primeiros)} />
              <MetricCard label="Assinaturas pagas" hint="primeiro pagamento válido" value={formatNumber(totals.pagas)} />
              <MetricCard label="Investimento atribuído" hint="gasto importado/registrado no backend" value={formatCentavos(totals.investimento)} />
            </section>

            {!data.qualidadeMensuracao?.prontaParaDecisao && data.qualidadeMensuracao?.bloqueios?.length > 0 && (
              <section className="panel admin-command-alert is-warning" role="status">
                <p className="eyebrow">Mensuração incompleta</p>
                <h2>Não use este recorte para escalar orçamento ainda</h2>
                {data.qualidadeMensuracao.bloqueios.map((block) => (
                  <p className="muted" key={block.codigo}>{block.mensagem}</p>
                ))}
              </section>
            )}

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">First-party</p>
                  <h2>Sessões por origem</h2>
                  <p className="muted">UTM, click IDs consentidos e referrer são resolvidos no backend.</p>
                </div>
              </div>
              {origins.length === 0 ? (
                <EmptyState title="Ainda não há sessões first-party neste recorte">
                  A coleta começa após a publicação desta versão. Histórico antigo permanece nas fontes legadas e não é inventado retroativamente.
                </EmptyState>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead><tr><th>Canal</th><th>Origem / mídia</th><th>Campanha</th><th>Sessões</th><th>Usuários</th><th>Tempo médio</th></tr></thead>
                    <tbody>
                      {origins.map((row, index) => (
                        <tr key={`${row.canal}-${row.source}-${row.medium}-${row.campanha_oficial_id || index}`}>
                          <td>{CHANNEL_LABELS[row.canal] || row.canal}</td>
                          <td><strong>{row.source}</strong><small> / {row.medium}</small></td>
                          <td>{row.campanha_nome || row.utm_campaign || "—"}</td>
                          <td>{formatNumber(row.sessoes)}</td>
                          <td>{formatNumber(row.usuarios)}</td>
                          <td>{number(row.sessoes) > 0 ? formatSeconds(number(row.tempo_engajado_ms) / number(row.sessoes) / 1000) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Qualidade por campanha</p>
                  <h2>Do cadastro à receita</h2>
                </div>
              </div>
              {campaigns.length === 0 ? (
                <EmptyState title="Nenhuma coorte atribuída neste período">
                  Sem cadastros profissionais atribuídos no recorte selecionado.
                </EmptyState>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead><tr><th>Campanha</th><th>Cadastros</th><th>Publicados</th><th>1º agendamento</th><th>Pagas</th><th>CAC</th><th>ROAS</th></tr></thead>
                    <tbody>
                      {campaigns.map((campaign, index) => (
                        <tr key={`${campaign.origem}-${campaign.midia}-${campaign.campanha}-${index}`}>
                          <td><strong>{campaign.campanha || "Sem campanha"}</strong><small>{campaign.origem} / {campaign.midia}</small></td>
                          <td>{formatNumber(campaign.cadastros)}</td>
                          <td>{formatNumber(campaign.negociosPublicados)}</td>
                          <td>{formatNumber(campaign.primeirosAgendamentos)}</td>
                          <td>{formatNumber(campaign.assinaturasAtivadas)}</td>
                          <td>{formatCentavos(campaign.cacAssinanteCentavos)}</td>
                          <td>{campaign.roas === null || campaign.roas === undefined ? "—" : `${number(campaign.roas).toFixed(2)}x`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <details className="admin-metric-definition">
              <summary>Como interpretar aquisição</summary>
              <p>{data.metodologia?.sessoes}</p>
              <p>{data.metodologia?.conversao}</p>
            </details>
          </>
        );
      }}
    </AdminSectionFrame>
  );
}

export function AdminJourneyV2Page() {
  const state = useAdminSection("journey");

  return (
    <AdminSectionFrame
      description="Onde as pessoas entram, quanto tempo realmente ficam com a página visível e para onde seguem."
      eyebrow="Produto"
      state={state}
      title="Jornada"
    >
      {(data) => {
        const screens = Array.isArray(data.telas) ? data.telas : [];
        const transitions = Array.isArray(data.transicoes) ? data.transicoes : [];
        const events = Array.isArray(data.eventos) ? data.eventos : [];
        const devices = Array.isArray(data.dispositivos) ? data.dispositivos : [];

        if (screens.length === 0 && events.length === 0) {
          return (
            <EmptyState title="A jornada first-party começa a ser construída nesta versão">
              Não há backfill artificial de páginas ou tempo de permanência. Assim que houver novas sessões, esta área passa a mostrar caminhos reais.
            </EmptyState>
          );
        }

        return (
          <>
            <section className="panel">
              <div className="panel-heading"><div><p className="eyebrow">Telas</p><h2>Onde as pessoas passam tempo</h2></div></div>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>Tela</th><th>Visualizações</th><th>Sessões</th><th>Tempo médio visível</th></tr></thead>
                  <tbody>
                    {screens.map((screen) => (
                      <tr key={screen.page_key}>
                        <td><strong>{PAGE_LABELS[screen.page_key] || screen.page_key}</strong><small>{screen.route_template}</small></td>
                        <td>{formatNumber(screen.visualizacoes)}</td>
                        <td>{formatNumber(screen.sessoes)}</td>
                        <td>{formatSeconds(screen.tempo_medio_segundos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="admin-command-two-column">
              <section className="panel">
                <div className="panel-heading"><div><p className="eyebrow">Caminhos</p><h2>Transições mais comuns</h2></div></div>
                {transitions.length === 0 ? <p className="muted">Ainda não há sessões com duas ou mais telas.</p> : (
                  <div className="admin-ranking-list">
                    {transitions.map((item) => (
                      <article key={`${item.origem}-${item.destino}`}>
                        <div><strong>{PAGE_LABELS[item.origem] || item.origem} → {PAGE_LABELS[item.destino] || item.destino}</strong></div>
                        <span>{formatNumber(item.transicoes)}</span>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="panel">
                <div className="panel-heading"><div><p className="eyebrow">Marcos de intenção</p><h2>Ações observadas no navegador</h2></div></div>
                {events.length === 0 ? <p className="muted">Nenhum marco frontend neste recorte.</p> : (
                  <dl className="admin-command-data-list">
                    {events.map((event) => (
                      <div key={event.nome}>
                        <dt>{EVENT_LABELS[event.nome] || event.nome}</dt>
                        <dd>{formatNumber(event.eventos)} <small>· {formatNumber(event.sessoes)} sessões</small></dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>
            </div>

            <section className="panel">
              <div className="panel-heading"><div><p className="eyebrow">Compatibilidade</p><h2>Dispositivo e navegador</h2></div></div>
              <div className="admin-ranking-list">
                {devices.map((item) => (
                  <article key={`${item.device_type}-${item.browser_family}`}>
                    <div><strong>{item.device_type}</strong><small>{item.browser_family}</small></div>
                    <span>{formatNumber(item.sessoes)} sessões</span>
                  </article>
                ))}
              </div>
            </section>
          </>
        );
      }}
    </AdminSectionFrame>
  );
}

export function AdminRetentionV2Page() {
  const state = useAdminSection("retention");

  return (
    <AdminSectionFrame
      description="Se os profissionais continuam gerando agendamentos depois do primeiro valor entregue."
      eyebrow="Retenção"
      state={state}
      title="Retenção"
    >
      {(data) => {
        const summary = data.resumo || {};
        const timing = data.tempos?.primeiroParaSegundo || {};
        const windows = Array.isArray(data.janelasCandidatas) ? data.janelasCandidatas : [];
        const cohorts = Array.isArray(data.coortesSemanais) ? data.coortesSemanais : [];

        return (
          <>
            <section className="admin-command-summary-grid is-period-summary">
              <MetricCard label="Com 1º agendamento" hint="negócios que chegaram ao primeiro valor" value={formatNumber(summary.comPrimeiroAgendamento)} />
              <MetricCard label="Com 2º agendamento" hint={formatPercent(summary.taxaSegundoSobrePrimeiro) + " sobre o primeiro"} value={formatNumber(summary.comSegundoAgendamento)} />
              <MetricCard label="Com 3º agendamento" hint={formatPercent(summary.taxaTerceiroSobrePrimeiro) + " sobre o primeiro"} value={formatNumber(summary.comTerceiroAgendamento)} />
              <MetricCard label="Mediana até o 2º" hint={`${formatNumber(timing.amostra)} negócios na amostra`} value={timing.medianaDias === null || timing.medianaDias === undefined ? "—" : `${timing.medianaDias} dias`} />
            </section>

            <section className="panel">
              <div className="panel-heading"><div><p className="eyebrow">Maturidade</p><h2>Recorrência nas janelas candidatas</h2></div></div>
              {windows.length === 0 ? <p className="muted">Amostra insuficiente.</p> : (
                <div className="admin-command-funnel is-milestones">
                  {windows.map((window) => (
                    <article key={window.janelaDias}>
                      <small>D{window.janelaDias}</small>
                      <strong>{formatPercent(window.taxaSegundoNaJanela)}</strong>
                      <span>{formatNumber(window.comSegundoNaJanela)} de {formatNumber(window.elegiveis)} maduros chegaram ao 2º</span>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-heading"><div><p className="eyebrow">Coortes</p><h2>Cadastro por semana</h2></div></div>
              {cohorts.length === 0 ? (
                <EmptyState title="Sem coortes no período">Ainda não existe base suficiente neste recorte.</EmptyState>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead><tr><th>Semana</th><th>Profissionais</th><th>Com 1º agendamento</th><th>Taxa</th></tr></thead>
                    <tbody>
                      {cohorts.map((cohort) => (
                        <tr key={cohort.semanaCadastro}>
                          <td>{cohort.semanaCadastro}</td>
                          <td>{formatNumber(cohort.profissionais)}</td>
                          <td>{formatNumber(cohort.comPrimeiroAgendamento)}</td>
                          <td>{formatPercent(cohort.taxaPrimeiroSobreProfissionais)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <details className="admin-metric-definition">
              <summary>Metodologia</summary>
              <p>{data.metodologia?.criterio}</p>
              <p>{data.metodologia?.janelas}</p>
              <p>{data.metodologia?.observacao}</p>
            </details>
          </>
        );
      }}
    </AdminSectionFrame>
  );
}

export function AdminRevenueV2Page() {
  const state = useAdminSection("revenue");

  return (
    <AdminSectionFrame
      description="Checkout, primeiro pagamento, renovações e base pagante — cada um com significado financeiro separado."
      eyebrow="Monetização"
      state={state}
      title="Receita"
    >
      {(data) => {
        const summary = data.resumo || {};
        const plans = Array.isArray(data.planos) ? data.planos : [];

        return (
          <>
            <section className="admin-command-summary-grid is-period-summary">
              <MetricCard label="Receita confirmada" hint="primeiros pagamentos + renovações no período" tone={number(summary.receitaTotal) > 0 ? "success" : "neutral"} value={formatCurrency(summary.receitaTotal)} />
              <MetricCard label="Receita de 1º pagamento" hint="monetização inicial, sem renovações" value={formatCurrency(summary.receitaPrimeiroPagamento)} />
              <MetricCard label="Novas assinaturas pagas" hint="primeiro pagamento válido no período" value={formatNumber(summary.novasAssinaturasPagas)} />
              <MetricCard label="Assinaturas pagas ativas" hint="estoque atual, não criação no período" value={formatNumber(summary.assinaturasPagasAtivas)} />
            </section>

            <section className="panel">
              <div className="panel-heading"><div><p className="eyebrow">Checkout</p><h2>Da intenção de compra ao pagamento</h2></div></div>
              <dl className="admin-command-data-list">
                <div><dt>Checkouts iniciados</dt><dd>{formatNumber(summary.checkoutsIniciados)}</dd></div>
                <div><dt>Checkouts concluídos tecnicamente</dt><dd>{formatNumber(summary.checkoutsConcluidos)}</dd></div>
                <div><dt>Checkouts com falha</dt><dd>{formatNumber(summary.checkoutsFalhos)}</dd></div>
                <div><dt>Novas assinaturas pagas</dt><dd>{formatNumber(summary.novasAssinaturasPagas)}</dd></div>
                <div><dt>Checkout → nova assinatura paga</dt><dd>{formatPercent(summary.conversaoCheckoutParaNovaAssinatura)}</dd></div>
                <div><dt>Pagamentos confirmados no período</dt><dd>{formatNumber(summary.pagamentosConfirmados)}</dd></div>
              </dl>
            </section>

            <section className="panel">
              <div className="panel-heading"><div><p className="eyebrow">Base atual</p><h2>Assinaturas ativas por plano</h2></div></div>
              {plans.length === 0 ? (
                <EmptyState title="Nenhuma assinatura paga ativa">A base paga ativa ainda está vazia.</EmptyState>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead><tr><th>Plano</th><th>Assinaturas ativas</th><th>Valor mensal contratado</th></tr></thead>
                    <tbody>
                      {plans.map((plan) => (
                        <tr key={plan.id}>
                          <td><strong>{plan.nome}</strong><small>{plan.slug}</small></td>
                          <td>{formatNumber(plan.assinaturas_ativas)}</td>
                          <td>{formatCurrency(plan.valor_mensal_contratado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <details className="admin-metric-definition">
              <summary>Critérios financeiros</summary>
              <p>{data.metodologia?.checkout}</p>
              <p>{data.metodologia?.novaAssinatura}</p>
              <p>{data.metodologia?.receita}</p>
              <p>{data.metodologia?.ativas}</p>
            </details>
          </>
        );
      }}
    </AdminSectionFrame>
  );
}

export const adminAnalyticsV2Internals = {
  formatPercent,
  formatSeconds,
  number
};
