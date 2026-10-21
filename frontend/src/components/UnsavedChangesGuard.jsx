import { useContext, useEffect, useRef } from "react";
import { UNSAFE_DataRouterContext, useBlocker } from "react-router-dom";

function InternalNavigationGuard({ when, onDiscard, onLeave }) {
  const { router } = useContext(UNSAFE_DataRouterContext);
  const dialogRef = useRef(null);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => (
    when && (
      currentLocation.pathname !== nextLocation.pathname
      || currentLocation.search !== nextLocation.search
    )
  ));

  useEffect(() => {
    if (!onLeave) return undefined;
    let previousLocation = router.state.location;

    // A rota muda antes de Suspense desmontar o editor antigo.
    return router.subscribe(({ location }) => {
      const changed = previousLocation.pathname !== location.pathname
        || previousLocation.search !== location.search;
      previousLocation = location;
      if (changed) onLeave();
    });
  }, [onLeave, router]);

  useEffect(() => {
    if (blocker.state === "blocked") {
      if (!when) blocker.proceed();
      else if (!dialogRef.current?.open) dialogRef.current?.showModal();
    } else if (dialogRef.current?.open) dialogRef.current.close();
  }, [blocker, when]);

  return (
    <dialog
      aria-labelledby="unsaved-changes-title"
      className="cancel-dialog"
      onCancel={(event) => {
        event.preventDefault();
        blocker.reset?.();
      }}
      ref={dialogRef}
    >
      <div className="cancel-dialog-content">
        <h2 id="unsaved-changes-title">Sair sem salvar?</h2>
        <p>Suas alterações ainda não foram salvas. Continue editando para mantê-las.</p>
        <div className="cancel-dialog-actions">
          <button autoFocus className="button" onClick={() => blocker.reset?.()} type="button">
            Continuar editando
          </button>
          <button className="button button-secondary" onClick={() => {
            if (blocker.state !== "blocked") return;
            onDiscard?.();
            dialogRef.current?.close();
            blocker.proceed?.();
          }} type="button">
            Sair sem salvar
          </button>
        </div>
      </div>
    </dialog>
  );
}

export function UnsavedChangesGuard({ when, onDiscard, onLeave }) {
  const dataRouter = useContext(UNSAFE_DataRouterContext);

  useEffect(() => {
    if (!when) return undefined;
    const preventExit = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventExit);
    return () => window.removeEventListener("beforeunload", preventExit);
  }, [when]);

  return dataRouter ? <InternalNavigationGuard when={when} onDiscard={onDiscard} onLeave={onLeave} /> : null;
}
