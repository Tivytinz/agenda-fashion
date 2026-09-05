import {
  useEffect,
  useState
} from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import {
  ErrorState,
  LoadingState
} from "../components/ScreenState";
import {
  WHATSAPP_PERIODS,
  normalizeWhatsappPeriod,
  setPeriodSearchParam
} from "../utils/adminPeriods";
import "../styles/admin-refinements.css";

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
  NAO_VERIFICADO: "Status não consultado",
  UNKNOWN: "Status desconhecido",
};

const QUALIDADE_META = {
  GREEN: "Boa",
  YELLOW: "Atenção",
  RED: "Baixa",
  UNKNOWN: "Sem avaliação da Meta",
};

function periodLabel(value) {
  return WHATSAPP_PERIODS.find(([period]) => period === value)?.[1] || "30 dias";
}

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

function calcularTaxaAceite(metricas = {}) {
  const total = Number(metricas.total ?? 0);
  const aceitas = Number(metricas.aceitas ?? 0);

  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(aceitas)) {
    return null;
  }

  return Number(((aceitas / total) * 100).toFixed(1));
}

function quantidadeLabel(quantidade, singular, plural) {
  const valor = Number(quantidade ?? 0);
  return `${valor} ${valor === 1 ? singular : plural}`;
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

function TemplateRow({ template }) {
  const metricas = template.metricas || {};
  const total = Number(metricas.total ?? 0);
  const aceitas = Number(metricas.aceitas ?? 0);
  const pendentes = Number(metricas.pendentes ?? 0);
  const naoEnviadas = Number(metricas.canceladas ?? 0);
  const falhas = Number(metricas.falhasFila ?? 0) + Number(metricas.falhasEntrega ?? 0);
  const taxaAceite = calcularTaxaAceite(metricas);
  const statusLabel = STATUS_META[template.statusMeta] || template.statusMeta;
  const statusNaoConsultado = template.statusMeta === "NAO_VERIFICADO";
  const qualityLabel = template.qualidadeMeta
    ? (QUALIDADE_META[template.qualidadeMeta] || template.qualidadeMeta)
    : statusNaoConsultado
      ? "não consultada"
      : "sem avaliação da Meta";

  let operacaoPrincipal = "Sem falhas";
  let operacaoDetalhe = "0 pendentes · 0 não enviadas";

  if (falhas > 0) {
    operacaoPrincipal = quantidadeLabel(falhas, "falha", "falhas");
    operacaoDetalhe = `${quantidadeLabel(pendentes, "pendente", "pendentes")} · ${quantidadeLabel(naoEnviadas, "não enviada", "não enviadas")}`;
  } else if (naoEnviadas > 0) {
    operacaoPrincipal = quantidadeLabel(naoEnviadas, "não enviada", "não enviadas");
    operacaoDetalhe = `${quantidadeLabel(pendentes, "pendente", "pendentes")} · sem falhas`;
  } else if (pendentes > 0) {
    operacaoPrincipal = quantidadeLabel(pendentes, "pendente", "pendentes");
    operacaoDetalhe = "aguardando processamento · sem falhas";
  }

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
      <td className="whatsapp-meta-cell">
        <StatusBadge tone={tomStatusMeta(template)}>{statusLabel}</StatusBadge>
        <small className={`admin-row-note whatsapp-meta-quality ${template.qualidadeMeta ? "" : "is-empty"}`}>
          Qualidade: {qualityLabel}
        </small>
        {template.categoriaMeta && (
          <small className="admin-row-note">
            {template.categoriaMeta}
            {template.categoriaConforme === false ? " · categoria divergente" : ""}
          </small>
        )}
      </td>
      <td>
        <strong className="whatsapp-accepted-value">
          {aceitas} de {total}{taxaAceite === null ? "" : ` · ${formatarPercentual(taxaAceite)}`}
        </strong>
        <small className="admin-row-note">
          {total > 0 ? "aceitas pela Meta" : "sem mensagens geradas"}
        </small>
      </td>
      <td>
        <strong className={metricas.taxaEntrega === null || metricas.taxaEntrega === undefined ? "whatsapp-empty-metric" : ""}>
          {formatarPercentual(metricas.taxaEntrega)}
        </strong>
        <small className="admin-row-note">{metricas.entregues ?? 0} entregues</small>
      </td>
      <td>
        <strong className={metricas.taxaLeitura === null || metricas.taxaLeitura === undefined ? "whatsapp-empty-metric" : ""}>
          {formatarPercentual(metricas.taxaLeitura)}
        </strong>
        <small className="admin-row-note">{metricas.lidas ?? 0} lidas</small>
      </td>
      <td>
        <strong>{operacaoPrincipal}</strong>
        <small className="admin-row-note">{operacaoDetalhe}</small>
      </td>
    </tr>
  );
}

export function AdminWhatsAppPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const periodo = normalizeWhatsappPeriod(searchParams.get("periodo"));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
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
        if (active) setData({ ...result, __period: periodo });
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

  const loadedPeriod = data?.__period || periodo;
  const periodPending = loadedPeriod !== periodo;
  const loadedPeriodLabel = periodLabel(loadedPeriod);
  const requestedPeriodLabel = periodLabel(periodo);
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
          <p className="eyebrow">WhatsApp</p>
          <h1>WhatsApp e automações</h1>
          <p>
            Acompanhe templates, automações, aceite, entrega e leitura das mensagens do Agenda Fashion.
          </p>
        </div>

        <div className="admin-heading-actions whatsapp-heading-actions">
          <div className="segmented-control" aria-label="Período das métricas">
            {WHATSAPP_PERIODS.map(([value, label]) => (
              <button
                aria-pressed={periodo === value}
                className={periodo === value ? "active" : ""}
                disabled={refreshing}
                key={value}
                onClick={() => {
                  if (value === periodo) return;
                  setSearchParams(setPeriodSearchParam(searchParams, value));
                }}
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
            {refreshing
              ? "Atualizando..."
              : verificacao.codigo === "CONFIGURACAO_INCOMPLETA"
                ? "Verificar novamente"
                : "Atualizar agora"}
          </button>
        </div>
      </header>

      {refreshing && data && (
        <p className="data-refresh-status" role="status">
          {periodPending
            ? `Mostrando os últimos dados de ${loadedPeriodLabel} enquanto ${requestedPeriodLabel} é atualizado…`
            : "Atualizando métricas sem ocultar os últimos dados…"}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}{periodPending
            ? ` Os dados abaixo ainda correspondem a ${loadedPeriodLabel}.`
            : " Os últimos dados carregados continuam visíveis."}
        </p>
      )}

      <section className="metric-grid" aria-label="Indicadores do WhatsApp">
        <MetricCard
          hint={verificacao.disponivel
            ? "confirmados diretamente na Meta"
            : `${resumo.templatesEsperados ?? 0} templates aguardam consulta`}
          label="Aprovados na Meta"
          value={aprovados === null || aprovados === undefined
            ? "Não consultado"
            : `${aprovados} de ${resumo.templatesEsperados ?? 0}`}
        />
        <MetricCard
          hint="rotinas liberadas no ambiente"
          label="Automações habilitadas"
          value={`${resumo.automacoesHabilitadas ?? 0} de ${resumo.templatesEsperados ?? 0}`}
        />
        <MetricCard
          hint={`${resumo.total ?? 0} mensagens geradas no período · aceitas pela Meta`}
          label="Envios aceitos"
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
              : "Status da Meta ainda não consultado"}
          </strong>
          <p>{verificacao.mensagem}</p>
          {verificacao.variaveisAusentes?.length > 0 && (
            <small>
              Configuração necessária no ambiente: {verificacao.variaveisAusentes.join(", ")}. Depois, use “Verificar novamente”.
            </small>
          )}
        </div>
        {verificacao.consultadoEm && (
          <time dateTime={verificacao.consultadoEm}>
            Última consulta: {formatarDataHora(verificacao.consultadoEm)}
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
              Entrega considera mensagens aceitas pela Meta. Leitura considera somente mensagens já entregues. No celular, cada linha vira um cartão operacional.
            </p>
          </div>
        </div>

        <div className="table-wrap whatsapp-template-table admin-card-table-mobile">
          <table>
            <thead>
              <tr>
                <th>Template</th>
                <th>Automação</th>
                <th>Meta</th>
                <th>Aceitas</th>
                <th>Entrega</th>
                <th>Leitura</th>
                <th>Operação</th>
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
          <p><strong>Status não consultado:</strong> o AF ainda não conseguiu consultar aprovação e qualidade diretamente na Meta; isso não invalida as métricas locais de envio.</p>
          <p><strong>Automação habilitada:</strong> o AF está autorizado pelas variáveis do ambiente a usar essa rotina.</p>
          <p><strong>Aceita:</strong> a Meta recebeu a solicitação e devolveu um identificador. Isso ainda não garante entrega.</p>
          <p><strong>Falhas:</strong> somam erros da fila e recusas de entrega registradas pelo webhook.</p>
          <p><strong>Não enviada:</strong> a mensagem foi interrompida antes de chegar à Meta porque expirou ou deixou de ser válida.</p>
        </div>
      </details>
    </main>
  );
}
