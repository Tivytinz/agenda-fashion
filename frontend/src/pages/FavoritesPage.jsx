import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/ScreenState";
import { formatLocation } from "../utils/format";

export function FavoritesPage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    apiRequest("/favoritos")
      .then((result) => setItems(Array.isArray(result) ? result : result.favoritos || []))
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(load, [load]);

  async function remove(id) {
    try {
      await apiRequest(`/favoritos/${id}`, { method: "DELETE" });
      setItems((current) => current.filter((item) => Number(item.id || item.negocio_id) !== Number(id)));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <main className="container page-content appointments-page">
      <header className="appointments-header">
        <div><p className="eyebrow">Salvos por você</p><h1>Favoritos</h1><p>Volte rapidamente aos negócios que você mais gostou.</p></div>
        <Link className="button button-secondary" to="/">Explorar</Link>
      </header>
      {error && items && <p className="form-error" role="alert">{error}</p>}
      {!items && !error && <LoadingState>Carregando favoritos...</LoadingState>}
      {!items && error && <ErrorState message={error} onRetry={load} />}
      {items?.length === 0 && <EmptyState action={<Link className="button" to="/">Descobrir negócios</Link>} title="Nenhum favorito ainda">Salve os perfis que você quer encontrar de novo.</EmptyState>}
      {items?.length > 0 && (
        <section className="management-grid">
          {items.map((item) => {
            const id = item.id || item.negocio_id;
            return (
              <article className="management-card" key={id}>
                <div className="service-cover">{item.foto_url ? <img alt="" src={item.foto_url} /> : <span>{String(item.nome || "A").slice(0, 1)}</span>}</div>
                <div className="management-card-body">
                  <h2>{item.nome}</h2><p className="muted">{formatLocation(item)}</p>
                  <div className="card-actions">
                    <Link className="button button-small" to={`/negocio/${item.slug}`}>Ver perfil</Link>
                    <button className="text-button danger-text" onClick={() => remove(id)} type="button">Remover</button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
