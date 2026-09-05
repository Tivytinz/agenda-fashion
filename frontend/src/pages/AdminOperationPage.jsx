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
import { settleRequestMap } from "../utils/asyncData";

const TABS = [
  ["negocios", "Negócios"],
  ["agendamentos", "Agendamentos"],
  ["marketplace", "Marketplace"]
];

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

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
        <span className="admin-command-status">{formatStatus(appointment.status)}</span>
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

export function AdminOperationPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState("negocios");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setRefreshing(true);
    setError("");

    settleRequestMap({
      businesses: apiRequest("/admin/negocios", { signal: controller.signal }),
      appointments: apiRequest("/admin/agendamentos", { signal: controller.signal }),
      marketplace: apiRequest("/admin/marketing", { signal: controller.signal })
    })
      .then(({ values, errors }) => {
        if (!active) return;

        const nonAbortErrors = errors.filter(
          ({ error: requestError }) => requestError?.name !== "AbortError"
        );
        const hasData = Boolean(
          values.businesses || values.appointments || values.marketplace
        );

        if (!hasData) {
          setError(
            nonAbortErrors[0]?.error?.message ||
              "Não foi possível carregar a operação da plataforma."
          );
          return;
        }

        setData({
          businesses: values.businesses?.negocios || [],
          appointments: values.appointments?.agendamentos || [],
          marketplace: values.marketplace || {}
        });

        if (nonAbortErrors.length > 0) {
          setError(
            "Parte da operação está temporariamente indisponível. Os dados carregados continuam visíveis."
          );
        }
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadKey]);

  const query = normalize(search);
  const businesses = useMemo(() => {
    const items = data?.businesses || [];
    if (!query) return items;
    return items.filter((business) => normalize([
      business.nome,
      business.cidade,
      business.bairro,
      business.setor
    ].join(" ")).includes(query));
  }, [data?.businesses, query]);

  const appointments = useMemo(() => {
    const items = data?.appointments || [];
    if (!query) return items;
    return items.filter((appointment) => normalize([
      appointment.cliente_nome,
      appointment.negocio,
      appointment.servico,
      appointment.profissional,
      appointment.status
    ].join(" ")).includes(query));
  }, [data?.appointments, query]);

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

  const marketplace = data?.marketplace || {};
  const booked = marketplace.negociosMaisAgendados || [];
  const viewed = marketplace.negociosMaisVistos || [];
  const cities = marketplace.cidades || [];

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
            Acompanhe negócios, agendamentos e sinais do marketplace sem misturar operação com aquisição.
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

      {error && data && <p className="form-error" role="alert">{error}</p>}

      <div className="admin-operation-toolbar">
        <nav className="admin-command-tabs" aria-label="Áreas da operação">
          {TABS.map(([value, label]) => (
            <button
              aria-pressed={tab === value}
              className={tab === value ? "active" : ""}
              key={value}
              onClick={() => {
                setTab(value);
                setSearch("");
              }}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>

        {tab !== "marketplace" && (
          <label className="admin-operation-search">
            <span>Buscar</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tab === "negocios"
                ? "Negócio, cidade, bairro ou setor"
                : "Cliente, negócio, serviço ou profissional"}
              type="search"
              value={search}
            />
          </label>
        )}
      </div>

      {tab === "negocios" && (
        <section aria-label="Negócios cadastrados">
          <p className="admin-operation-count">{businesses.length} negócios nesta visão.</p>
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
        </section>
      )}

      {tab === "agendamentos" && (
        <section aria-label="Agendamentos da plataforma">
          <p className="admin-operation-count">{appointments.length} agendamentos nesta visão.</p>
          {appointments.length === 0 ? (
            <EmptyState title="Nenhum agendamento encontrado">
              Ajuste a busca para ampliar os resultados.
            </EmptyState>
          ) : (
            <div className="admin-operation-grid">
              {appointments.map((appointment) => (
                <AppointmentCard appointment={appointment} key={appointment.id} />
              ))}
            </div>
          )}
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
