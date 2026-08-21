import {
  useEffect,
  useState
} from "react";
import { apiRequest } from "../api/client";
import {
  ErrorState,
  LoadingState
} from "../components/ScreenState";

const PERIODOS = [
  ["hoje", "Hoje"],
  ["7", "7 dias"],
  ["30", "30 dias"],
  ["90", "90 dias"],
  ["total", "Todo período"],
];

const STATUS_META = {
  APPROVED: "Ativo",
  PAUSED: "Pausado",
  DISABLED: "Desativado pela Meta",
  REJECTED: "Rejeitado",
  PENDING: "Em análise",
  PENDING_DELETION: "Exclusão pendente",
  APPEAL_REQUESTED: "Revisão solicitada",
  IN_APPEAL: "Em revisão",
  LIMIT_EXCEEDED: "Limite excedido",
  IDIOMA_AUSENTE: "Idioma não encontrado",
  AUSENTE: "Não encontrado",
  NAO_VERIFICADO: "Não verificado",
  UNKNOWN: "Status desconhecido",
};

const QUALIDADE_META = {
  GREEN: "Boa",
  YELLOW: "Atenção",
  RED: "Baixa",
  UNKNOWN: "Sem avaliação",
};

function formatarPercentual(valor) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return "Sem dados";
  }

  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1
  }).format(valor)}%`;
}

function formatarDataHora(valor) {
  if (!valor) return "";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(data);
}

function MetricCard({ hint, label, value }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function StatusBadge({ children, tone = "muted" }) {
  return (
    <span className={`whatsapp-status-badge is-${tone}`}>
      {children}
    </span>
  );
}

function tomStatusMeta(template) {
  if (template.statusMeta === "APPROVED" && template.categoriaConforme) {
    return "success";
  }
  if (template.statusMeta === "NAO_VERIFICADO") return "muted";
  if (["PENDING", "APPEAL_REQUESTED", "IN_APPEAL"].includes(template.statusMeta)) {
    return "warning";
  }
  return "danger";
}

function tomQualidade(qualidade) {
  if (qualidade === "GREEN") return "success";
  if (qualidade === "YELLOW") return "warning";
  if (qualidade === "RED") return "danger";
  return "muted";
}

function TemplateRow({ template }) {
  const metricas = template.metricas || {};
  const statusLabel = STATUS_META[template.statusMeta] || template.statusMeta;
  const qualityLabel = QUALIDADE_META[template.qualidadeMeta] || template.qualidadeMeta;

  return (
    <tr>
      <td>
        <strong className="whatsapp-template-title">{template.rotulo}</strong>
        <code>{template.nome}</code>
        <small className="admin-row-note">
          {template.destinatario} · {template.idioma}
        </small>
      </td>
      <td>
        <StatusBadge tone={template.automacaoHabilitada ? "success" : "muted"}>
          {template.automacaoHabilitada ? "Habilitada" : "Desligada"}
        </StatusBadge>
      </td>
      <td>
        <StatusBadge tone={tomStatusMeta(template)}>{statusLabel}</StatusBadge>
        {template.categoriaMeta && (
          <small className="admin-row-note">
            {template.categoriaMeta}
            {template.categoriaConforme === false ? " · categoria divergente" : ""}
          </small>
        )}
      </td>
      <td>
        {template.qualidadeMeta ? (
          <StatusBadge tone={tomQualidade(template.qualidadeMeta)}>
            {qualityLabel}
          </StatusBadge>
        ) : (
          <span className="admin-data-empty">—</span>
        )}
      </td>
      <td>
        <strong>{metricas.aceitas ?? 0}</strong>
        <small className="admin-row-note">de {metricas.total ?? 0} geradas</small>
      </td>
      <td>
        <strong>{formatarPercentual(metricas.taxaEntrega)}</strong>
        <small className="admin-row-note">{metricas.entregues ?? 0} entregues</small>
      </td>
      <td>
        <strong>{formatarPercentual(metricas.taxaLeitura)}</strong>
        <small className="admin-row-note">{metricas.lidas ?? 0} lidas</small>
      </td>
      <td>
        <strong>{(metricas.falhasFila ?? 0) + (metricas.falhasEntrega ?? 0)}</strong>
        <small className="admin-row-note">
          {metricas.pendentes ?? 0} pendentes · {metricas.canceladas ?? 0} canceladas
        </small>
      </td>
    </tr>
  );
}

export function AdminWhatsAppPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [periodo, setPeriodo] = useState("30");
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setError("");
    setRefreshing(true);

    apiRequest(
      `/admin/whatsapp/templates?periodo=${encodeURIComponent(periodo)}`,
      { signal: controller.signal }
    )
      .then((result) => {
        if (active) setData(result);
      })
      .catch((requestError) => {
        if (active && requestError.name !== "AbortError") {
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [periodo, reloadKey]);

  if (!data && !error) {
    return (
      <main className="workspace-page admin-workspace-page admin-marketing-page admin-whatsapp-page">
        <LoadingState>Carregando saúde do WhatsApp...</LoadingState>
      </main>
    );
  }

  if (!data && error) {
    return (
      <main className="workspace-page admin-workspace-page admin-marketing-page admin-whatsapp-page">
        <ErrorState
          message={error}
          onRetry={() => setReloadKey((current) => current + 1)}
        />
      </main>
    );
  }

  const resumo = data?.resumo || {};
  const verificacao = data?.verificacaoMeta || {};
  const configuracao = data?.configuracao || {};
  const templates = data?.templates || [];
  const aprovados = resumo.templatesAprovadosMeta;

  return (
    <main
      aria-busy={refreshing}
      className="workspace-page admin-workspace-page admin-marketing-page admin-whatsapp-page"
    >
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">Administração do AF</p>
          <h1>WhatsApp e templates</h1>
          <p>
            Confira aprovação, qualidade e desempenho das mensagens automáticas sem sair do Agenda Fashion.
          </p>
        </div>

        <div className="admin-heading-actions whatsapp-heading-actions">
          <div className="segmented-control" aria-label="Período das métricas">
            {PERIODOS.map(([value, label]) => (
              <button
                aria-pressed={periodo === value}
                className={periodo === value ? "active" : ""}
                disabled={refreshing}
                key={value}
                onClick={() => setPeriodo(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className="button button-secondary"
            disabled={refreshing}
            onClick={() => setReloadKey((current) => current + 1)}
            type="button"
          >
            {refreshing ? "Atualizando..." : "Atualizar status"}
          </button>
        </div>
      </header>

      {error && (
        <p className="form-error" role="alert">
          {error} Os últimos dados carregados continuam visíveis.
        </p>
      )}

      <section className="metric-grid" aria-label="Indicadores do WhatsApp">
        <MetricCard
          hint={verificacao.disponivel ? "confirmados diretamente na Meta" : "aguardando consulta à Meta"}
          label="Templates ativos"
          value={aprovados === null || aprovados === undefined
            ? `— de ${resumo.templatesEsperados ?? 0}`
            : `${aprovados} de ${resumo.templatesEsperados ?? 0}`}
        />
        <MetricCard
          hint="rotinas liberadas no ambiente"
          label="Automações habilitadas"
          value={`${resumo.automacoesHabilitadas ?? 0} de ${resumo.templatesEsperados ?? 0}`}
        />
        <MetricCard
          hint={`${resumo.total ?? 0} mensagens geradas no período`}
          label="Aceitas pela Meta"
          value={resumo.aceitas ?? 0}
        />
        <MetricCard
          hint={`${resumo.entregues ?? 0} mensagens entregues`}
          label="Taxa de entrega"
          value={formatarPercentual(resumo.taxaEntrega)}
        />
        <MetricCard
          hint={`${resumo.lidas ?? 0} mensagens lidas`}
          label="Taxa de leitura"
          value={formatarPercentual(resumo.taxaLeitura)}
        />
      </section>

      <section
        className={`whatsapp-health-notice ${verificacao.disponivel ? "is-success" : "is-warning"}`}
        role={verificacao.disponivel ? "status" : "alert"}
      >
        <div>
          <strong>
            {verificacao.disponivel
              ? "Verificação da Meta concluída"
              : "Status da Meta ainda não confirmado"}
          </strong>
          <p>{verificacao.mensagem}</p>
          {verificacao.variaveisAusentes?.length > 0 && (
            <small>
              Falta configurar: {verificacao.variaveisAusentes.join(", ")}.
            </small>
          )}
        </div>
        {verificacao.consultadoEm && (
          <time dateTime={verificacao.consultadoEm}>
            {formatarDataHora(verificacao.consultadoEm)}
          </time>
        )}
      </section>

      {!configuracao.notificacoesHabilitadas && (
        <p className="whatsapp-automation-warning" role="status">
          O envio automático está desligado em <code>WHATSAPP_NOTIFICATIONS_ENABLED</code>. Os templates podem estar ativos na Meta sem que o AF faça disparos.
        </p>
      )}

      <section className="panel whatsapp-templates-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Operação</p>
            <h2>Saúde por template</h2>
            <p>
              Entrega considera mensagens aceitas pela Meta. Leitura considera somente mensagens já entregues.
            </p>
          </div>
        </div>

        <div className="table-wrap whatsapp-template-table">
          <table>
            <thead>
              <tr>
                <th>Template</th>
                <th>Automação</th>
                <th>Meta</th>
                <th>Qualidade</th>
                <th>Aceitas</th>
                <th>Entrega</th>
                <th>Leitura</th>
                <th>Fila</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <TemplateRow key={template.tipo} template={template} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <details className="panel whatsapp-metrics-help">
        <summary>Como interpretar estas métricas</summary>
        <div>
          <p><strong>Ativo:</strong> o modelo está aprovado na Meta, no idioma e na categoria esperados.</p>
          <p><strong>Automação habilitada:</strong> o AF está autorizado pelas variáveis do ambiente a usar essa rotina.</p>
          <p><strong>Aceita:</strong> a Meta recebeu a solicitação e devolveu um identificador. Isso ainda não garante entrega.</p>
          <p><strong>Falhas:</strong> somam erros da fila e recusas de entrega registradas pelo webhook.</p>
        </div>
      </details>
    </main>
  );
}
