import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/ScreenState";
import { formatDate } from "../utils/format";

const LABELS = { agendado: "Agendado", confirmado: "Confirmado", realizado: "Realizado", falta: "Falta", cancelado: "Cancelado" };

export function RestrictedProfessionalReservationsPage() {
  const [pagina, setPagina] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const mutationRef = useRef(null);

  useEffect(() => () => mutationRef.current?.abort(), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setPending(null);
    apiRequest(`/reservas-profissionais-existentes?pagina=${pagina}`, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setData(null);
          setError(err.message || "Não foi possível carregar as reservas.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [pagina, revision]);

  async function confirm() {
    if (!pending || mutationRef.current) return;
    const controller = new AbortController();
    mutationRef.current = controller;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await apiRequest(`/agendamentos/${pending.id}/atendimento`, {
        method: "PATCH", body: { status: pending.status }, signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setData((current) => ({ ...current, agendamentos: current.agendamentos.map((item) => (
        item.id === pending.id
          ? { ...item, status: result.agendamento.status, pode_marcar_realizado: false, pode_marcar_falta: false }
          : item
      )) }));
      setPending(null);
      setMessage(result.mensagem);
    } catch (err) {
      if (!controller.signal.aborted) setError(err.message || "Não foi possível registrar o resultado.");
    } finally {
      if (!controller.signal.aborted) {
        mutationRef.current = null;
        setSaving(false);
      }
    }
  }

  return (
    <main className="container page-content restricted-reservations">
      <header>
        <p className="eyebrow">Área profissional</p>
        <h1>Reservas existentes</h1>
        <p>Acompanhe suas reservas de vínculos inativos e registre realizado ou falta.</p>
        <p className="muted">Novas reservas ficam bloqueadas. Para cancelar, reagendar ou reativar, fale com a dona do negócio.</p>
        <div className="restricted-actions">
          <Link className="button button-secondary" to="/conta">Minha conta</Link>
          <button className="button button-secondary" disabled={loading || saving} onClick={() => setRevision((value) => value + 1)} type="button">Atualizar reservas</button>
        </div>
      </header>
      {message && <p className="form-success" role="status">{message}</p>}
      {error && <ErrorState message={error} onRetry={saving ? undefined : () => setRevision((value) => value + 1)} />}
      {loading ? <LoadingState>Carregando reservas...</LoadingState> : data && (
        <>
          {data.agendamentos.length === 0 ? (
            <EmptyState title="Nenhuma reserva disponível">Você não possui reservas em vínculos inativos disponíveis para consulta.</EmptyState>
          ) : (
            <section aria-label="Reservas de vínculos inativos" className="restricted-list">
              {data.agendamentos.map((item) => (
                <article className="panel" key={item.id}>
                  <p className="eyebrow">{item.negocio}</p>
                  <h2>{item.servico}</h2>
                  <p>{item.cliente} · {formatDate(item.data, true)} às {item.horario}</p>
                  <p><strong>{LABELS[item.status] || item.status}</strong></p>
                  {pending?.id === item.id ? (
                    <div aria-label="Confirmar resultado" className="restricted-confirmation">
                      <p>{pending.status === "realizado" ? "Confirmar que o atendimento foi realizado?" : "Confirmar que a cliente não compareceu?"} Este registro encerra o atendimento.</p>
                      <div className="restricted-actions">
                        <button className="button" disabled={saving} onClick={confirm} type="button">{saving ? "Salvando..." : `Confirmar ${pending.status}`}</button>
                        <button className="button button-secondary" disabled={saving} onClick={() => setPending(null)} type="button">Voltar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="restricted-actions">
                      {item.pode_marcar_realizado && <button className="button" disabled={saving} onClick={() => setPending({ id: item.id, status: "realizado" })} type="button">Marcar realizado</button>}
                      {item.pode_marcar_falta && <button className="button button-secondary" disabled={saving} onClick={() => setPending({ id: item.id, status: "falta" })} type="button">Registrar falta</button>}
                    </div>
                  )}
                </article>
              ))}
            </section>
          )}
          <nav aria-label="Páginas de reservas" className="restricted-actions">
            <button className="button button-secondary" disabled={pagina === 1 || saving} onClick={() => setPagina((value) => value - 1)} type="button">Anterior</button>
            <span>Página {pagina}</span>
            <button className="button button-secondary" disabled={!data.tem_proxima || saving} onClick={() => setPagina((value) => value + 1)} type="button">Próxima</button>
          </nav>
        </>
      )}
    </main>
  );
}
