import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/ScreenState";
import { MediaThumb } from "../components/profile/MediaThumb";
import { formatLocation } from "../utils/format";

export function FavoritesPage() {
  const removeDialogRef = useRef(null);
  const [items, setItems] = useState(null);
  const [pendingRemove, setPendingRemove] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    apiRequest("/favoritos")
      .then((result) => setItems(Array.isArray(result) ? result : result.favoritos || []))
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(load, [load]);

  function askRemove(item) {
    setRemoveError("");
    setPendingRemove(item);
    removeDialogRef.current?.showModal();
  }

  async function remove() {
    if (!pendingRemove) return;
    const id = pendingRemove.id || pendingRemove.negocio_id;
    setRemoving(true);
    setRemoveError("");
    try {
      await apiRequest(`/favoritos/${id}`, { method: "DELETE" });
      setItems((current) => current.filter((item) => Number(item.id || item.negocio_id) !== Number(id)));
      removeDialogRef.current?.close();
      setPendingRemove(null);
    } catch (requestError) {
      setRemoveError(requestError.message);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <main className="container page-content appointments-page">
      <header className="appointments-header">
        <div><p className="eyebrow">Salvos por você</p><h1>Favoritos</h1><p>Volte rapidamente aos negócios que você mais gostou.</p></div>
        <Link className="button button-secondary" to="/">Voltar ao início</Link>
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
                <div className="service-cover">
                  <MediaThumb alt={`Foto de ${item.nome}`} className="management-service-media" emoji={String(item.nome || "A").slice(0, 1)} src={item.foto_url} />
                </div>
                <div className="management-card-body">
                  <h2>{item.nome}</h2><p className="muted">{formatLocation(item)}</p>
                  <div className="card-actions">
                    <Link className="button button-small" to={`/negocio/${item.slug}`}>Ver perfil</Link>
                    <button className="text-button danger-text" onClick={() => askRemove(item)} type="button">Remover</button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
      <dialog
        aria-labelledby="remove-favorite-title"
        className="cancel-dialog"
        onCancel={(event) => {
          if (removing) event.preventDefault();
          else setPendingRemove(null);
        }}
        ref={removeDialogRef}
      >
        <div className="cancel-dialog-content">
          <div aria-hidden="true" className="cancel-dialog-icon">!</div>
          <h2 id="remove-favorite-title">Remover dos favoritos?</h2>
          <p>“{pendingRemove?.nome}” sairá da sua lista de perfis salvos.</p>
          {removeError && <p className="form-error" role="alert">{removeError}</p>}
          <div className="cancel-dialog-actions">
            <button className="button button-secondary" disabled={removing} onClick={() => { setRemoveError(""); removeDialogRef.current?.close(); setPendingRemove(null); }} type="button">Manter favorito</button>
            <button className="button button-danger" disabled={removing} onClick={remove} type="button">{removing ? "Removendo..." : "Sim, remover"}</button>
          </div>
        </div>
      </dialog>
    </main>
  );
}
