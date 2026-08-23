import {
  useEffect,
  useMemo,
  useState
} from "react";
import { apiRequest } from "../api/client";
import {
  EmptyState,
  ErrorState,
  LoadingState
} from "../components/ScreenState";

const FILTERS = [
  { value: "todos", label: "Todos que precisam de atenção" },
  { value: "sem_negocio", label: "Sem negócio" },
  { value: "perfil", label: "Dados essenciais" },
  { value: "servico", label: "Sem serviço" },
  { value: "agenda", label: "Sem agenda" },
  { value: "publicacao", label: "Não publicados" },
  { value: "descricao", label: "Sem descrição (opcional)" }
];

function formatDate(value) {
  if (!value) return "Sem atividade";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem atividade";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function whatsappNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  return "";
}

function whatsappHref(profile) {
  if (profile.whatsappAutorizado !== true) return "";
  if (profile.proximaAcao?.tipo === "sistema") return "";
  const number = whatsappNumber(profile.whatsapp);
  if (!number) return "";
  const firstName = String(profile.nome || "").trim().split(/\s+/)[0] || "tudo bem";
  const message = [
    `Olá, ${firstName}! Tudo bem?`,
    "Sou da equipe do Agenda Fashion.",
    pendingMessage(profile),
    "Posso te ajudar a concluir a configuração?"
  ].join(" ");

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

function emailHref(profile) {
  if (!profile.email) return "";
  if (profile.proximaAcao?.tipo === "sistema") return "";
  const subject = "Ajuda para concluir seu perfil no Agenda Fashion";
  const body = [
    `Olá, ${profile.nome || "tudo bem"}!`,
    "",
    pendingMessage(profile),
    "Podemos ajudar você a concluir a configuração?",
    "",
    "Equipe Agenda Fashion"
  ].join("\n");

  return `mailto:${profile.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function pendingMessage(profile) {
  const next = profile.proximaAcao ||
    (Array.isArray(profile.pendencias)
      ? profile.pendencias.find((item) => item.tipo !== "sistema")
      : null);
  const label = String(next?.rotulo || "")
    .replace(/\s*\((opcional|recomendado)\)$/i, "")
    .trim();

  if (!label) {
    return "Quero ajudar a deixar seu perfil pronto para receber clientes.";
  }

  return `Seu perfil já está avançando. A próxima etapa é: ${label}.`;
}

function formatWhatsapp(value) {
  const digits = String(value || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return value || "WhatsApp não informado";
}

function SummaryCard({ active, filter, hint, label, onSelect, value }) {
  return (
    <button
      aria-pressed={active}
      className={`metric-card saas-health-metric-card${active ? " active" : ""}`}
      onClick={() => onSelect(filter)}
      type="button"
    >
      <span>{label}</span>
      <strong>{value ?? 0}</strong>
      <small>{hint}</small>
    </button>
  );
}

function ContactActions({ profile }) {
  const whatsapp = whatsappHref(profile);
  const email = emailHref(profile);
  const hasWhatsapp = Boolean(whatsappNumber(profile.whatsapp));

  if (profile.proximaAcao?.tipo === "sistema") {
    return (
      <span className="saas-health-contact-status is-system">
        Correção interna — não contatar
      </span>
    );
  }

  if (
    !whatsapp &&
    !email &&
    !(hasWhatsapp && profile.whatsappAutorizado !== true)
  ) {
    return <span className="admin-data-empty">Sem contato válido</span>;
  }

  return (
    <div className="saas-health-actions">
      {hasWhatsapp && profile.whatsappAutorizado !== true && (
        <span className="saas-health-contact-status">
          WhatsApp não autorizado
        </span>
      )}
      {whatsapp && (
        <a
          className="button button-primary button-small"
          href={whatsapp}
          rel="noreferrer"
          target="_blank"
        >
          WhatsApp
        </a>
      )}
      {email && (
        <a className="button button-secondary button-small" href={email}>
          E-mail
        </a>
      )}
      {profile.negocio?.publicado && profile.negocio?.slug && (
        <a
          className="text-button"
          href={`/negocio/${encodeURIComponent(profile.negocio.slug)}`}
          rel="noreferrer"
          target="_blank"
        >
          Ver perfil
        </a>
      )}
    </div>
  );
}

function ProfileRow({ profile }) {
  const location = [profile.negocio?.cidade, profile.negocio?.estado]
    .filter(Boolean)
    .join(" / ");
  const pending = Array.isArray(profile.pendencias)
    ? profile.pendencias
    : [];
  const next = profile.proximaAcao || pending[0] || null;
  const remaining = pending.filter(
    (item) => item.codigo !== next?.codigo
  );
  const remainingStages = profile.progresso?.etapasRestantes ??
    Math.max(0, 5 - Number(profile.progresso?.etapasConcluidas || 0));

  return (
    <tr>
      <td>
        <strong className="saas-health-name">{profile.nome}</strong>
        <small className="admin-row-note">Cadastro em {formatDate(profile.cadastroEm)}</small>
        <small className="admin-row-note">Última atividade: {formatDate(profile.ultimaAtividadeEm)}</small>
      </td>
      <td>
        <span className="saas-health-contact-value">{formatWhatsapp(profile.whatsapp)}</span>
        <small className="admin-row-note">{profile.email || "E-mail não informado"}</small>
        <ContactActions profile={profile} />
      </td>
      <td>
        <strong>{profile.negocio?.nome || "Negócio não criado"}</strong>
        {location && <small className="admin-row-note">{location}</small>}
      </td>
      <td>
        <div className="saas-health-progress-meta">
          <strong>
            {remainingStages === 0
              ? "Etapas concluídas"
              : remainingStages === 1
                ? "Falta 1"
                : `Faltam ${remainingStages}`}
          </strong>
          <span>{profile.progresso?.etapasConcluidas ?? 0} de 5 concluídas</span>
        </div>
        <div
          aria-label={`${profile.progresso?.percentual ?? 0}% do perfil concluído`}
          className="saas-health-progress"
          role="progressbar"
          aria-valuemax="100"
          aria-valuemin="0"
          aria-valuenow={profile.progresso?.percentual ?? 0}
        >
          <span style={{ width: `${profile.progresso?.percentual ?? 0}%` }} />
        </div>
      </td>
      <td>
        <div className="saas-health-pending-list">
          {next && (
            <div className={`saas-health-next-action${next.tipo ? ` is-${next.tipo}` : ""}`}>
              <small>
                {next.tipo === "recomendacao"
                  ? "Melhoria recomendada"
                  : next.tipo === "sistema"
                    ? "Ação interna"
                    : "Próxima ação"}
              </small>
              <strong>{next.rotulo}</strong>
            </div>
          )}
          {remaining.length > 0 && (
            <details className="saas-health-more-pending">
              <summary>
                Ver mais {remaining.length} {remaining.length === 1 ? "item" : "itens"}
              </summary>
              <div>
                {remaining.map((item) => (
                  <span
                    className={`saas-health-pending-chip${item.tipo === "recomendacao" ? " recommendation" : item.tipo === "sistema" ? " system" : ""}`}
                    key={item.codigo}
                  >
                    {item.rotulo}
                  </span>
                ))}
              </div>
            </details>
          )}
        </div>
      </td>
    </tr>
  );
}

export function AdminSaasHealthPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState("todos");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const requestPath = useMemo(() => {
    const params = new URLSearchParams({
      pendencia: filter,
      pagina: String(page),
      limite: "25"
    });
    if (search) params.set("busca", search);
    return `/admin/saude/perfis-incompletos?${params.toString()}`;
  }, [filter, page, search]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setError("");
    setRefreshing(true);

    apiRequest(requestPath, { signal: controller.signal })
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
  }, [reloadKey, requestPath]);

  function submitSearch(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function selectFilter(value) {
    setFilter(value);
    setPage(1);
  }

  function clearSearch() {
    setSearchInput("");
    setSearch("");
    setPage(1);
  }

  if (!data && !error) {
    return (
      <main className="workspace-page admin-workspace-page admin-marketing-page admin-saas-health-page">
        <LoadingState>Carregando saúde do SaaS...</LoadingState>
      </main>
    );
  }

  if (!data && error) {
    return (
      <main className="workspace-page admin-workspace-page admin-marketing-page admin-saas-health-page">
        <ErrorState
          message={error}
          onRetry={() => setReloadKey((current) => current + 1)}
        />
      </main>
    );
  }

  const summary = data?.resumo || {};
  const profiles = data?.perfis || [];
  const pagination = data?.paginacao || {};

  return (
    <main
      aria-busy={refreshing}
      className="workspace-page admin-workspace-page admin-marketing-page admin-saas-health-page"
    >
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">Administração do AF</p>
          <h1>Saúde do SaaS</h1>
          <p>
            Identifique etapas pendentes, priorize ativações rápidas e ajude cada profissional pelo contato direto.
          </p>
        </div>
      </header>

      {refreshing && <p className="data-refresh-status" role="status">Atualizando perfis...</p>}
      {error && (
        <p className="form-error" role="alert">
          {error} Os últimos dados carregados continuam visíveis.
        </p>
      )}

      <section className="metric-grid" aria-label="Indicadores de saúde dos perfis">
        <SummaryCard
          active={filter === "todos"}
          filter="todos"
          hint={`de ${summary.totalProfissionais ?? 0} profissionais`}
          label="Precisam de atenção"
          onSelect={selectFilter}
          value={summary.totalIncompletos}
        />
        <SummaryCard active={filter === "sem_negocio"} filter="sem_negocio" hint="ainda sem área profissional" label="Sem negócio" onSelect={selectFilter} value={summary.semNegocio} />
        <SummaryCard active={filter === "perfil"} filter="perfil" hint="dados obrigatórios pendentes" label="Dados essenciais" onSelect={selectFilter} value={summary.perfilIncompleto} />
        <SummaryCard active={filter === "servico"} filter="servico" hint="negócios sem serviço ativo" label="Sem serviço" onSelect={selectFilter} value={summary.semServico} />
        <SummaryCard active={filter === "agenda"} filter="agenda" hint="horários ainda não configurados" label="Sem agenda" onSelect={selectFilter} value={summary.semAgenda} />
        <SummaryCard active={filter === "publicacao"} filter="publicacao" hint="perfil fora do catálogo público" label="Não publicados" onSelect={selectFilter} value={summary.naoPublicados} />
      </section>

      <section className="panel saas-health-panel" id="saas-health-results">
        <div className="saas-health-toolbar">
          <div>
            <p className="eyebrow">Acompanhamento</p>
            <h2>Perfis que precisam de ajuda</h2>
          </div>

          <form className="saas-health-search" onSubmit={submitSearch} role="search">
            <label htmlFor="saas-health-search">Buscar profissional</label>
            <div>
              <input
                id="saas-health-search"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Nome, e-mail, WhatsApp ou negócio"
                type="search"
                value={searchInput}
              />
              {(searchInput || search) && (
                <button className="button button-secondary" onClick={clearSearch} type="button">
                  Limpar
                </button>
              )}
              <button className="button button-secondary" type="submit">Buscar</button>
            </div>
          </form>
        </div>

        <div className="saas-health-filters" aria-label="Filtrar por pendência">
          {FILTERS.map(({ value, label }) => (
            <button
              aria-pressed={filter === value}
              className={filter === value ? "active" : ""}
              key={value}
              onClick={() => selectFilter(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        <p className="saas-health-results-count" aria-live="polite">
          {pagination.total ?? 0} {pagination.total === 1 ? "perfil encontrado" : "perfis encontrados"}.
          {filter === "descricao"
            ? " Este filtro mostra uma melhoria opcional e não altera o progresso de ativação."
            : " As ativações mais próximas de concluir aparecem primeiro. Descrição é uma melhoria opcional e não entra nesta contagem."}
        </p>

        {profiles.length === 0 ? (
          <EmptyState title="Nenhum perfil encontrado">
            Não há perfis que precisem de atenção para os filtros selecionados.
          </EmptyState>
        ) : (
          <div className="table-wrap saas-health-table">
            <table>
              <thead>
                <tr>
                  <th>Profissional</th>
                  <th>Contato</th>
                  <th>Negócio</th>
                  <th>Progresso</th>
                  <th>Próxima ação</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <ProfileRow key={profile.usuarioId} profile={profile} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPaginas > 1 && (
          <nav className="saas-health-pagination" aria-label="Paginação dos perfis incompletos">
            <button
              className="button button-secondary"
              disabled={page <= 1 || refreshing}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              Anterior
            </button>
            <span>Página {pagination.pagina} de {pagination.totalPaginas}</span>
            <button
              className="button button-secondary"
              disabled={page >= pagination.totalPaginas || refreshing}
              onClick={() => setPage((current) => current + 1)}
              type="button"
            >
              Próxima
            </button>
          </nav>
        )}
      </section>
    </main>
  );
}
