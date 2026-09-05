import {
  useEffect,
  useState
} from "react";
import { apiRequest } from "../api/client";
import {
  EmptyState,
  ErrorState,
  LoadingState
} from "../components/ScreenState";
import "../styles/admin-refinements.css";

const TABS = [
  ["negocios", "Negócios"],
  ["agendamentos", "Agendamentos"],
  ["marketplace", "Marketplace"]
];

const APPOINTMENT_STATUS = [
  ["", "Todos os status"],
  ["agendado", "Agendado"],
  ["confirmado", "Confirmado"],
  ["pendente", "Pendente"],
  ["concluido", "Concluído"],
  ["cancelado", "Cancelado"]
];

function formatDate(value) {
  if (!value) return "Data não informada";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatStatus(value) {
  const label = String(value || "agendado").replace(/_/g, " ").trim();
  return label.charAt(0).toLocaleUpperCase("pt-BR") + label.slice(1);
}

function statusTone(value) {
  const status = String(value || "agendado").toLowerCase();
  if (["concluido", "concluído", "finalizado"].includes(status)) return "success";
  if (["cancelado", "cancelada", "nao_compareceu", "não_compareceu"].includes(status)) return "danger";
  if (["pendente", "aguardando"].includes(status)) return "warning";
  if (["confirmado", "confirmada", "agendado"].includes(status)) return "info";
  return "muted";
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
        <span className={`admin-command-status ${business.ativo ? "is-success" : "is-muted"}`}>
          {business.ativo ? "Ativo" : "Inativo"}
        </span>
      </div>
      <dl>
        <div><dt>Serviços</dt><dd>{business.total_servicos ?? 0}</dd></div>
        <div><dt>Profissionais</dt><dd>{business.total_profissionais ?? 0}</dd></div>
        <div><dt>Agendamentos</dt><dd>{business.total_agendamentos ?? 0}</dd></div>
      </dl>
      {business.slug && (
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
      </dl>
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

export function AdminOperationPage() {
  const [tab, setTab] = useState("negocios");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

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
      if (tab === "agendamentos" && status) params.set("status", status);
      path = `/admin/${tab}?${params.toString()}`;
    }

    apiRequest(path, { signal: controller.signal })
      .then((result) => {
        if (!active) return;
        setData((current) => ({
          ...(current || {}),
          [tab]: result
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

  function selectTab(value) {
    setTab(value);
    setSearchInput("");
    setSearch("");
    setStatus("");
    setPage(1);
  }

  function submitSearch(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function clearSearch() {
    setSearchInput("");
    setSearch("");
    setPage(1);
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

  const businessData = data?.negocios || {};
  const appointmentData = data?.agendamentos || {};
  const businesses = businessData.negocios || [];
  const appointments = appointmentData.agendamentos || [];
  const marketplace = data?.marketplace || {};
  const booked = marketplace.negociosMaisAgendados || [];
  const viewed = marketplace.negociosMaisVistos || [];
  const cities = marketplace.cidades || [];
  const pagination = tab === "negocios"
    ? businessData.paginacao || {}
    : appointmentData.paginacao || {};

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
            Pesquise a base administrativa inteira com paginação no servidor, sem misturar operação com aquisição.
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

      {refreshing && data && <p className="data-refresh-status" role="status">Atualizando esta visão...</p>}
      {error && data && <p className="form-error" role="alert">{error} Os últimos dados válidos continuam visíveis.</p>}

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
                placeholder={tab === "negocios"
                  ? "Negócio, cidade, bairro ou setor"
                  : "Cliente, negócio, serviço ou profissional"}
                type="search"
                value={searchInput}
              />
              {tab === "agendamentos" && (
                <select
                  aria-label="Status do agendamento"
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                  value={status}
                >
                  {APPOINTMENT_STATUS.map(([value, label]) => (
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

      {tab === "negocios" && (
        <section aria-label="Negócios cadastrados">
          <p className="admin-operation-count">{businessData.paginacao?.total ?? businesses.length} negócios encontrados na base.</p>
          {businesses.length === 0 ? (
            <EmptyState title="Nenhum negócio encontrado">
              Ajuste a busca para ampliar os resultados.
            </EmptyState>
          ) : (
            <div className="admin-operation-grid">
              {businesses.map((business) => (
                <BusinessCard business={business} key={business.id} />
              ))}
            </div>
          )}
          <Pagination pagination={pagination} refreshing={refreshing} onPage={setPage} />
        </section>
      )}

      {tab === "agendamentos" && (
        <section aria-label="Agendamentos da plataforma">
          <p className="admin-operation-count">{appointmentData.paginacao?.total ?? appointments.length} agendamentos encontrados na base.</p>
          {appointments.length === 0 ? (
            <EmptyState title="Nenhum agendamento encontrado">
              Ajuste a busca ou o status para ampliar os resultados.
            </EmptyState>
          ) : (
            <div className="admin-operation-grid">
              {appointments.map((appointment) => (
                <AppointmentCard appointment={appointment} key={appointment.id} />
              ))}
            </div>
          )}
          <Pagination pagination={pagination} refreshing={refreshing} onPage={setPage} />
        </section>
      )}

      {tab === "marketplace" && (
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
      )}
    </main>
  );
}
