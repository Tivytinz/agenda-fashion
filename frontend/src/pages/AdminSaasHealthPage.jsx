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
  ["todos", "Todos incompletos"],
  ["sem_negocio", "Sem negócio"],
  ["perfil", "Dados do perfil"],
  ["servico", "Sem serviço"],
  ["agenda", "Sem agenda"],
  ["publicacao", "Não publicados"]
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
  const number = whatsappNumber(profile.whatsapp);
  if (!number) return "";
  const firstName = String(profile.nome || "").trim().split(/\s+/)[0] || "tudo bem";
  const message = [
    `Olá, ${firstName}! Tudo bem?`,
    "Sou da equipe do Agenda Fashion e notei que seu perfil ainda tem algumas etapas pendentes.",
    "Posso te ajudar a concluir a configuração?"
  ].join(" ");

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

function emailHref(profile) {
  if (!profile.email) return "";
  const subject = "Ajuda para concluir seu perfil no Agenda Fashion";
  const body = [
    `Olá, ${profile.nome || "tudo bem"}!`,
    "",
    "Notamos que seu perfil no Agenda Fashion ainda tem algumas etapas pendentes.",
    "Podemos ajudar você a concluir a configuração?",
    "",
    "Equipe Agenda Fashion"
  ].join("\n");

  return `mailto:${profile.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function SummaryCard({ hint, label, value }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value ?? 0}</strong>
      <small>{hint}</small>
    </article>
  );
}

function ContactActions({ profile }) {
  const whatsapp = whatsappHref(profile);
  const email = emailHref(profile);

  if (!whatsapp && !email) {
    return <span className="admin-data-empty">Sem contato válido</span>;
  }

  return (
    <div className="saas-health-actions">
      {whatsapp && (
        <a
          className="button button-primary"
          href={whatsapp}
          rel="noreferrer"
          target="_blank"
        >
          WhatsApp
        </a>
      )}
      {email && (
        <a className="button button-secondary" href={email}>
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

  return (
    <tr>
      <td>
        <strong className="saas-health-name">{profile.nome}</strong>
        <small className="admin-row-note">Cadastro em {formatDate(profile.cadastroEm)}</small>
        <small className="admin-row-note">Última atividade: {formatDate(profile.ultimaAtividadeEm)}</small>
      </td>
      <td>
        <span>{profile.whatsapp || "WhatsApp não informado"}</span>
        <small className="admin-row-note">{profile.email || "E-mail não informado"}</small>
      </td>
      <td>
        <strong>{profile.negocio?.nome || "Negócio não criado"}</strong>
        {location && <small className="admin-row-note">{location}</small>}
      </td>
      <td>
        <div className="saas-health-progress-meta">
          <strong>{profile.progresso?.percentual ?? 0}%</strong>
          <span>{profile.progresso?.etapasConcluidas ?? 0} de 5 etapas</span>
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
          {(profile.pendencias || []).map((item) => (
            <span className="saas-health-pending-chip" key={item.codigo}>
              {item.rotulo}
            </span>
          ))}
        </div>
      </td>
      <td><ContactActions profile={profile} /></td>
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
            Identifique profissionais com cadastro incompleto e entre em contato para ajudar na ativação.
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
          hint={`de ${summary.totalProfissionais ?? 0} profissionais`}
          label="Perfis incompletos"
          value={summary.totalIncompletos}
        />
        <SummaryCard hint="ainda sem área profissional" label="Sem negócio" value={summary.semNegocio} />
        <SummaryCard hint="dados obrigatórios pendentes" label="Perfil básico" value={summary.perfilIncompleto} />
        <SummaryCard hint="negócios sem serviço ativo" label="Sem serviço" value={summary.semServico} />
        <SummaryCard hint="horários ainda não configurados" label="Sem agenda" value={summary.semAgenda} />
        <SummaryCard hint="perfil fora do catálogo público" label="Não publicados" value={summary.naoPublicados} />
      </section>

      <section className="panel saas-health-panel">
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
              <button className="button button-secondary" type="submit">Buscar</button>
            </div>
          </form>
        </div>

        <div className="saas-health-filters" aria-label="Filtrar por pendência">
          {FILTERS.map(([value, label]) => (
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

        {profiles.length === 0 ? (
          <EmptyState title="Nenhum perfil encontrado">
            Não há perfis incompletos para os filtros selecionados.
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
                  <th>Pendências</th>
                  <th>Ações</th>
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
