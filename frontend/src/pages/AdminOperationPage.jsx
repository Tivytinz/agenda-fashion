import {
  useEffect,
  useState
} from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import {
  EmptyState,
  ErrorState,
  LoadingState
} from "../components/ScreenState";
import "../styles/admin-refinements.css";

const TABS = [
  ["usuarios", "Usuários"],
  ["negocios", "Negócios"],
  ["agendamentos", "Agendamentos"],
  ["marketplace", "Marketplace"]
];

const USER_STATUS = [
  ["", "Todos os estados"],
  ["ativo", "Ativo"],
  ["desativado", "Desativado"],
  ["encerrado", "Encerrado"]
];

const BUSINESS_STATUS = [
  ["", "Todos os estados"],
  ["publicado", "Publicado"],
  ["despublicado", "Despublicado"],
  ["rascunho", "Rascunho"],
  ["inativo", "Inativo"],
  ["arquivado", "Arquivado"]
];

const APPOINTMENT_STATUS = [
  ["", "Todos os status"],
  ["agendado", "Agendado"],
  ["confirmado", "Confirmado"],
  ["realizado", "Realizado"],
  ["falta", "Não compareceu"],
  ["cancelado", "Cancelado"]
];

const TAB_VALUES = new Set(TABS.map(([value]) => value));
const STATUS_OPTIONS = {
  usuarios: USER_STATUS,
  negocios: BUSINESS_STATUS,
  agendamentos: APPOINTMENT_STATUS
};

function statusValues(tab) {
  return new Set((STATUS_OPTIONS[tab] || []).map(([value]) => value));
}

function formatDate(value) {
  if (!value) return "Data não informada";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function formatStatus(value) {
  const labels = {
    falta: "Não compareceu",
    despublicado: "Despublicado",
    rascunho: "Rascunho",
    arquivado: "Arquivado",
    encerrado: "Encerrado",
    desativado: "Desativado",
    realizado: "Realizado"
  };
  const normalized = String(value || "").trim().toLowerCase();
  if (labels[normalized]) return labels[normalized];
  const label = normalized.replace(/_/g, " ");
  return label
    ? label.charAt(0).toLocaleUpperCase("pt-BR") + label.slice(1)
    : "Não informado";
}

function statusTone(value) {
  const status = String(value || "").toLowerCase();
  if (["realizado", "publicado", "ativo"].includes(status)) return "success";
  if (["cancelado", "falta", "encerrado", "arquivado"].includes(status)) return "danger";
  if (["rascunho", "despublicado"].includes(status)) return "warning";
  if (["confirmado", "agendado"].includes(status)) return "info";
  return "muted";
}

function UserCard({ user }) {
  const roles = [
    user.papel_admin ? `Admin: ${user.papel_admin}` : null,
    ...(user.papeis_negocio || [])
  ].filter(Boolean);

  return (
    <article className="admin-operation-card">
      <div className="admin-operation-card-head">
        <div>
          <strong>{user.nome}</strong>
          <small>{user.email || "E-mail não informado"}</small>
        </div>
        <span className={`admin-command-status is-${statusTone(user.estado_operacional)}`}>
          {formatStatus(user.estado_operacional)}
        </span>
      </div>
      <dl>
        <div><dt>Papéis</dt><dd>{roles.length ? roles.join(" · ") : "Cliente/usuário"}</dd></div>
        <div><dt>Negócios ativos</dt><dd>{user.total_negocios_ativos ?? 0}</dd></div>
        <div><dt>Último login</dt><dd>{formatDateTime(user.ultimo_login_em) || "Sem registro"}</dd></div>
      </dl>
      <p className="muted">
        Perfil profissional: {user.perfil_profissional_ativado_em ? "ativado" : "não ativado"}
        {" · "}
        E-mail: {user.email_verificado_em ? "verificado" : "não verificado"}
      </p>
    </article>
  );
}

function BusinessCard({ business }) {
  const location = [business.bairro, business.cidade].filter(Boolean).join(" · ");

  return (
    <article className="admin-operation-card">
      <div className="admin-operation-card-head">
        <div>
          <strong>{business.nome}</strong>
          <small>{location || "Localização não informada"}</small>
        </div>
        <span className={`admin-command-status is-${statusTone(business.estado_operacional)}`}>
          {formatStatus(business.estado_operacional)}
        </span>
      </div>
      <dl>
        <div><dt>Proprietária</dt><dd>{business.dono_nome || "Não identificada"}</dd></div>
        <div><dt>Plano</dt><dd>{business.plano_nome || business.plano_slug || "Não informado"}</dd></div>
        <div><dt>Serviços</dt><dd>{business.total_servicos ?? 0}</dd></div>
        <div><dt>Profissionais</dt><dd>{business.total_profissionais ?? 0}</dd></div>
        <div><dt>Agendamentos</dt><dd>{business.total_agendamentos ?? 0}</dd></div>
      </dl>
      {business.arquivado_em && (
        <p className="muted">
          Arquivado em {formatDateTime(business.arquivado_em) || business.arquivado_em}
          {business.motivo_arquivamento ? ` · ${formatStatus(business.motivo_arquivamento)}` : ""}
        </p>
      )}
      {business.slug && business.estado_operacional !== "arquivado" && (
        <a
          className="text-button"
          href={`/negocio/${encodeURIComponent(business.slug)}`}
          rel="noreferrer"
          target="_blank"
        >
          Ver perfil público →
        </a>
      )}
    </article>
  );
}

function AppointmentCard({ appointment }) {
  const stateAt = appointment.status_atendimento_em
    ? formatDateTime(appointment.status_atendimento_em)
    : null;

  return (
    <article className="admin-operation-card">
      <div className="admin-operation-card-head">
        <div>
          <strong>{appointment.negocio}</strong>
          <small>{formatDate(appointment.data)} · {appointment.horario || "horário não informado"}</small>
        </div>
        <span className={`admin-command-status is-${statusTone(appointment.status)}`}>
          {formatStatus(appointment.status)}
        </span>
      </div>
      <dl>
        <div><dt>Cliente</dt><dd>{appointment.cliente_nome}</dd></div>
        <div><dt>Serviço</dt><dd>{appointment.servico}</dd></div>
        <div><dt>Profissional</dt><dd>{appointment.profissional}</dd></div>
        <div><dt>Duração</dt><dd>{appointment.duracao_minutos ? `${appointment.duracao_minutos} min` : "Não informada"}</dd></div>
      </dl>
      {(stateAt || appointment.motivo_cancelamento) && (
        <p className="muted">
          {stateAt ? `Estado atualizado em ${stateAt}` : ""}
          {appointment.status_atendimento_por_nome
            ? ` por ${appointment.status_atendimento_por_nome}`
            : ""}
          {appointment.motivo_cancelamento
            ? `${stateAt ? " · " : ""}Motivo: ${appointment.motivo_cancelamento}`
            : ""}
        </p>
      )}
    </article>
  );
}

function RankingList({ children, items, title }) {
  return (
    <section className="panel admin-marketplace-panel">
      <div className="panel-heading"><h2>{title}</h2></div>
      {items.length === 0 ? (
        <p className="muted">Sem dados suficientes para este ranking.</p>
      ) : (
        <div className="admin-ranking-list">{children}</div>
      )}
    </section>
  );
}

function Pagination({ pagination, refreshing, onPage }) {
  const totalPages = Number(pagination?.totalPaginas || 0);
  if (totalPages <= 1) return null;
  const current = Number(pagination?.pagina || 1);

  return (
    <nav className="admin-operation-pagination" aria-label="Paginação da operação">
      <button
        className="button button-secondary button-small"
        disabled={refreshing || current <= 1}
        onClick={() => onPage(current - 1)}
        type="button"
      >
        Anterior
      </button>
      <span>Página {current} de {totalPages}</span>
      <button
        className="button button-secondary button-small"
        disabled={refreshing || current >= totalPages}
        onClick={() => onPage(current + 1)}
        type="button"
      >
        Próxima
      </button>
    </nav>
  );
}

function sameContext(context, { page, search, status, tab }) {
  if (!context) return false;
  return context.tab === tab &&
    context.page === page &&
    context.search === search &&
    context.status === status;
}

function searchPlaceholder(tab) {
  if (tab === "usuarios") return "Nome, e-mail ou papel administrativo";
  if (tab === "negocios") return "Negócio, proprietária, plano, cidade ou setor";
  return "Cliente, negócio, serviço ou profissional";
}

function emptyTitle(tab) {
  if (tab === "usuarios") return "Nenhum usuário encontrado";
  if (tab === "negocios") return "Nenhum negócio encontrado";
  return "Nenhum agendamento encontrado";
}

export function AdminOperationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("aba");
  const tab = TAB_VALUES.has(requestedTab) ? requestedTab : "negocios";
  const search = String(searchParams.get("busca") || "").trim();
  const rawStatus = tab === "marketplace"
    ? ""
    : String(searchParams.get("status") || "");
  const status = statusValues(tab).has(rawStatus) ? rawStatus : "";
  const page = Math.max(
    1,
    Number.parseInt(searchParams.get("pagina") || "1", 10) || 1
  );
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setRefreshing(true);
    setError("");

    let path = "/admin/marketing";
    if (tab !== "marketplace") {
      const params = new URLSearchParams({
        pagina: String(page),
        limite: "25"
      });
      if (search) params.set("busca", search);
      if (status) params.set("status", status);
      path = `/admin/${tab}?${params.toString()}`;
    }

    const context = { tab, search, status, page };

    apiRequest(path, { signal: controller.signal })
      .then((result) => {
        if (!active) return;
        setData((current) => ({
          ...(current || {}),
          [tab]: {
            ...result,
            __context: context
          }
        }));
      })
      .catch((requestError) => {
        if (active && requestError.name !== "AbortError") {
          setError(requestError.message || "Não foi possível carregar a operação da plataforma.");
        }
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [page, reloadKey, search, status, tab]);

  function updateParams({
    nextTab = tab,
    nextSearch = search,
    nextStatus = status,
    nextPage = page
  }) {
    const next = new URLSearchParams(searchParams);
    if (nextTab === "negocios") next.delete("aba");
    else next.set("aba", nextTab);

    if (nextSearch) next.set("busca", nextSearch);
    else next.delete("busca");

    if (nextTab !== "marketplace" && nextStatus) {
      next.set("status", nextStatus);
    } else {
      next.delete("status");
    }

    if (nextPage > 1) next.set("pagina", String(nextPage));
    else next.delete("pagina");

    setSearchParams(next);
  }

  function selectTab(value) {
    setSearchInput("");
    updateParams({
      nextTab: value,
      nextSearch: "",
      nextStatus: "",
      nextPage: 1
    });
  }

  function submitSearch(event) {
    event.preventDefault();
    updateParams({
      nextSearch: searchInput.trim(),
      nextPage: 1
    });
  }

  function clearSearch() {
    setSearchInput("");
    updateParams({ nextSearch: "", nextPage: 1 });
  }

  if (!data && !error) {
    return (
      <main className="workspace-page admin-workspace-page admin-command-page admin-operation-page">
        <LoadingState>Carregando operação da plataforma...</LoadingState>
      </main>
    );
  }

  if (!data && error) {
    return (
      <main className="workspace-page admin-workspace-page admin-command-page admin-operation-page">
        <ErrorState
          message={error}
          onRetry={() => setReloadKey((current) => current + 1)}
        />
      </main>
    );
  }

  const userData = data?.usuarios || {};
  const businessData = data?.negocios || {};
  const appointmentData = data?.agendamentos || {};
  const users = userData.usuarios || [];
  const businesses = businessData.negocios || [];
  const appointments = appointmentData.agendamentos || [];
  const marketplace = data?.marketplace || {};
  const booked = marketplace.negociosMaisAgendados || [];
  const viewed = marketplace.negociosMaisVistos || [];
  const cities = marketplace.cidades || [];
  const pagination = tab === "usuarios"
    ? userData.paginacao || {}
    : tab === "negocios"
      ? businessData.paginacao || {}
      : appointmentData.paginacao || {};
  const currentTabData = data?.[tab];
  const currentTabLoaded = Boolean(currentTabData);
  const requestedContext = { tab, search, status, page };
  const contextPending = currentTabLoaded &&
    !sameContext(currentTabData.__context, requestedContext);
  const filterOptions = STATUS_OPTIONS[tab] || [];

  return (
    <main
      aria-busy={refreshing}
      className="workspace-page admin-workspace-page admin-command-page admin-operation-page"
    >
      <header className="workspace-heading admin-command-heading">
        <div>
          <p className="eyebrow">Operação</p>
          <h1>Operação da plataforma</h1>
          <p>
            Consulte usuários, negócios, agendamentos e seus estados operacionais com paginação no servidor.
          </p>
        </div>
        <button
          className="button button-secondary button-small"
          disabled={refreshing}
          onClick={() => setReloadKey((current) => current + 1)}
          type="button"
        >
          {refreshing ? "Atualizando..." : "Atualizar"}
        </button>
      </header>

      {refreshing && data && (
        <p className="data-refresh-status" role="status">
          {contextPending
            ? "Mostrando os últimos resultados deste módulo enquanto o novo recorte é atualizado…"
            : "Atualizando esta visão..."}
        </p>
      )}
      {error && data && (
        <p className="form-error" role="alert">
          {error}{contextPending
            ? " Os resultados abaixo ainda correspondem ao recorte anterior."
            : " Os últimos dados válidos continuam visíveis."}
        </p>
      )}

      <div className="admin-operation-toolbar">
        <nav className="admin-command-tabs" aria-label="Áreas da operação">
          {TABS.map(([value, label]) => (
            <button
              aria-pressed={tab === value}
              className={tab === value ? "active" : ""}
              key={value}
              onClick={() => selectTab(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>

        {tab !== "marketplace" && (
          <form className="admin-operation-search" onSubmit={submitSearch} role="search">
            <label htmlFor="admin-operation-search">Buscar na base</label>
            <div className="admin-operation-search-row">
              <input
                id="admin-operation-search"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={searchPlaceholder(tab)}
                type="search"
                value={searchInput}
              />
              {filterOptions.length > 0 && (
                <select
                  aria-label={tab === "agendamentos"
                    ? "Status do agendamento"
                    : tab === "usuarios"
                      ? "Estado do usuário"
                      : "Estado do negócio"}
                  onChange={(event) => {
                    updateParams({
                      nextStatus: event.target.value,
                      nextPage: 1
                    });
                  }}
                  value={status}
                >
                  {filterOptions.map(([value, label]) => (
                    <option key={value || "todos"} value={value}>{label}</option>
                  ))}
                </select>
              )}
              {(searchInput || search) && (
                <button className="button button-secondary button-small" onClick={clearSearch} type="button">Limpar</button>
              )}
              <button className="button button-secondary button-small" disabled={refreshing} type="submit">Buscar</button>
            </div>
          </form>
        )}
      </div>

      {tab === "usuarios" && (
        <section aria-label="Usuários da plataforma">
          {!currentTabLoaded && refreshing ? (
            <LoadingState>Carregando usuários...</LoadingState>
          ) : !currentTabLoaded && error ? (
            <ErrorState
              message={error}
              onRetry={() => setReloadKey((current) => current + 1)}
            />
          ) : (
            <>
              <p className="admin-operation-count">{userData.paginacao?.total ?? users.length} usuários encontrados na base.</p>
              {users.length === 0 ? (
                <EmptyState title={emptyTitle(tab)}>
                  Ajuste a busca ou o estado para ampliar os resultados.
                </EmptyState>
              ) : (
                <div className="admin-operation-grid">
                  {users.map((item) => (
                    <UserCard key={item.id} user={item} />
                  ))}
                </div>
              )}
              <Pagination
                pagination={pagination}
                refreshing={refreshing}
                onPage={(nextPage) => updateParams({ nextPage })}
              />
            </>
          )}
        </section>
      )}

      {tab === "negocios" && (
        <section aria-label="Negócios cadastrados">
          {!currentTabLoaded && refreshing ? (
            <LoadingState>Carregando negócios...</LoadingState>
          ) : !currentTabLoaded && error ? (
            <ErrorState
              message={error}
              onRetry={() => setReloadKey((current) => current + 1)}
            />
          ) : (
            <>
              <p className="admin-operation-count">{businessData.paginacao?.total ?? businesses.length} negócios encontrados na base.</p>
              {businesses.length === 0 ? (
                <EmptyState title={emptyTitle(tab)}>
                  Ajuste a busca ou o estado para ampliar os resultados.
                </EmptyState>
              ) : (
                <div className="admin-operation-grid">
                  {businesses.map((business) => (
                    <BusinessCard business={business} key={business.id} />
                  ))}
                </div>
              )}
              <Pagination
                pagination={pagination}
                refreshing={refreshing}
                onPage={(nextPage) => updateParams({ nextPage })}
              />
            </>
          )}
        </section>
      )}

      {tab === "agendamentos" && (
        <section aria-label="Agendamentos da plataforma">
          {!currentTabLoaded && refreshing ? (
            <LoadingState>Carregando agendamentos...</LoadingState>
          ) : !currentTabLoaded && error ? (
            <ErrorState
              message={error}
              onRetry={() => setReloadKey((current) => current + 1)}
            />
          ) : (
            <>
              <p className="admin-operation-count">{appointmentData.paginacao?.total ?? appointments.length} agendamentos encontrados na base.</p>
              {appointments.length === 0 ? (
                <EmptyState title={emptyTitle(tab)}>
                  Ajuste a busca ou o status para ampliar os resultados.
                </EmptyState>
              ) : (
                <div className="admin-operation-grid">
                  {appointments.map((appointment) => (
                    <AppointmentCard appointment={appointment} key={appointment.id} />
                  ))}
                </div>
              )}
              <Pagination
                pagination={pagination}
                refreshing={refreshing}
                onPage={(nextPage) => updateParams({ nextPage })}
              />
            </>
          )}
        </section>
      )}

      {tab === "marketplace" && (
        !currentTabLoaded && refreshing ? (
          <LoadingState>Carregando sinais do marketplace...</LoadingState>
        ) : !currentTabLoaded && error ? (
          <ErrorState
            message={error}
            onRetry={() => setReloadKey((current) => current + 1)}
          />
        ) : (
          <div className="admin-marketplace-grid">
            <RankingList items={booked} title="Negócios mais agendados">
              {booked.slice(0, 8).map((business, index) => (
                <article key={business.id || `${business.nome}-${index}`}>
                  <span>{index + 1}</span>
                  <div><strong>{business.nome}</strong><small>{business.cidade || "Cidade não informada"}</small></div>
                  <b>{business.total ?? 0} agendamentos</b>
                </article>
              ))}
            </RankingList>

            <RankingList items={viewed} title="Negócios mais vistos">
              {viewed.slice(0, 8).map((business, index) => (
                <article key={business.id || `${business.nome}-${index}`}>
                  <span>{index + 1}</span>
                  <div><strong>{business.nome}</strong><small>{business.cidade || "Cidade não informada"}</small></div>
                  <b>{business.visitas ?? 0} visitas</b>
                </article>
              ))}
            </RankingList>

            <RankingList items={cities} title="Cidades com atividade">
              {cities.slice(0, 10).map((city, index) => (
                <article key={`${city.cidade}-${index}`}>
                  <span>{index + 1}</span>
                  <div><strong>{city.cidade}</strong><small>atividade registrada no AF</small></div>
                  <b>{city.total ?? 0}</b>
                </article>
              ))}
            </RankingList>
          </div>
        )
      )}
    </main>
  );
}
