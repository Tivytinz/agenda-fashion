import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useLocation } from "react-router-dom";
import { createSessionTransitions, supersededSessionTransition } from "./sessionTransitions";
import {
  apiRequest,
  migrateLegacySession
} from "../api/client";
import {
  clearSession,
  clearStoredSessionMetadata,
  completeLegacySessionMigration,
  getBusinessContextForPath,
  hasSession,
  invalidateSessionRequests,
  saveSession,
  notifyAnalyticsIdentityBoundary,
  notifyAnalyticsViewReady,
  AUTH_REVISION_STORAGE_KEY,
  AUTH_LOGOUT_READY_STORAGE_KEY,
  SESSION_CLEARED_EVENT
} from "./session";

const SessionContext = createContext(null);
const SIGNED_OUT_STATE = {
  loading: false,
  syncError: "",
  authenticated: false,
  usuario: null,
  negocioPrincipal: null,
  vinculos: [],
  temNegocio: false,
  temReservasProfissionaisRestritas: false,
  administrador: null,
  ehAdministrador: false
};

export function SessionProvider({ children }) {
  const location = useLocation();
  const sessionGenerationRef = useRef(0);
  const refreshRequestRef = useRef(0);
  const lastAppliedRefreshRef = useRef(0);
  const sessionSyncAbortRef = useRef(null);
  const pendingLogoutRef = useRef(null);
  const verifiedIdentityRef = useRef(null);
  const transitionsRef = useRef(null);
  if (!transitionsRef.current) transitionsRef.current = createSessionTransitions();
  const [state, setState] = useState(() => {
    const sessionPresent =
      hasSession();

    clearStoredSessionMetadata();

    return {
      loading: sessionPresent,
      syncError: "",
      authenticated: sessionPresent,
      usuario: null,
      negocioPrincipal: null,
      vinculos: [],
      temNegocio: false,
      temReservasProfissionaisRestritas: false,
      administrador: null,
      ehAdministrador: false
    };
  });

  const abortSessionSync = useCallback(() => {
    sessionSyncAbortRef.current?.abort();
    sessionSyncAbortRef.current = null;
  }, []);

  const beginSessionTransition = useCallback(() => {
    sessionGenerationRef.current += 1;
    invalidateSessionRequests();
    abortSessionSync();
  }, [abortSessionSync]);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    const requestId = ++refreshRequestRef.current;
    const sessionGeneration = sessionGenerationRef.current;
    abortSessionSync();
    const canApply = () => (
      sessionGeneration === sessionGenerationRef.current
      && requestId === refreshRequestRef.current
      && requestId > lastAppliedRefreshRef.current
    );

    if (!hasSession()) {
      verifiedIdentityRef.current = null;
      sessionGenerationRef.current += 1;
      lastAppliedRefreshRef.current = requestId;
      setState(SIGNED_OUT_STATE);
      return null;
    }

    if (!silent) {
      setState((current) => ({ ...current, loading: true, syncError: "" }));
    }

    const syncController = new AbortController();
    sessionSyncAbortRef.current = syncController;

    try {
      const migration = await migrateLegacySession({
        signal: syncController.signal
      });

      if (!canApply()) {
        return null;
      }

      if (migration.invalid) {
        sessionGenerationRef.current += 1;
        lastAppliedRefreshRef.current = requestId;
        clearSession();
        verifiedIdentityRef.current = null;
        setState(SIGNED_OUT_STATE);
        // O backend rejeitou o legado e não encontrou cookie válido.
        // Avisar outras abas e retomar a navegação pública nesta rota.
        notifyAnalyticsViewReady({ broadcastLogout: true });
        return null;
      }

      if (migration.migrated || migration.alreadyCookie) {
        completeLegacySessionMigration();
      }

      const result = await apiRequest("/minha-sessao", {
        // A sincronização inteira é cancelável: além do estado React, uma
        // resposta 401 obsoleta do backend poderia limpar o cookie HttpOnly.
        clearSessionOnUnauthorized: false,
        signal: syncController.signal
      });

      if (!canApply()) {
        return null;
      }

      const vinculos = Array.isArray(result.vinculos)
        ? result.vinculos
        : result.negocio
          ? [result.negocio]
          : [];

      const next = {
        loading: false,
        syncError: "",
        authenticated: true,
        usuario: result.usuario,
        negocioPrincipal: result.negocio || vinculos[0] || null,
        vinculos,
        temNegocio: vinculos.length > 0 || Boolean(result.temNegocio),
        temReservasProfissionaisRestritas: Boolean(result.temReservasProfissionaisRestritas),
        administrador: result.administrador || null,
        ehAdministrador: Boolean(result.ehAdministrador)
      };
      if (verifiedIdentityRef.current !== null &&
          String(verifiedIdentityRef.current) !== String(result.usuario?.id)) {
        notifyAnalyticsIdentityBoundary();
      }
      verifiedIdentityRef.current = result.usuario?.id ?? null;
      lastAppliedRefreshRef.current = requestId;
      setState(next);
      // Somente a sessão HTTP confirmada pode retomar a coleta na mesma rota.
      notifyAnalyticsViewReady();

      return {
        ...next,
        negocio: next.negocioPrincipal
      };
    } catch (error) {
      if (!canApply()) {
        return null;
      }

      if (error.status === 401 || error.status === 403) {
        sessionGenerationRef.current += 1;
        lastAppliedRefreshRef.current = requestId;
        clearSession();
        verifiedIdentityRef.current = null;
        setState(SIGNED_OUT_STATE);
        // 401/403 canônico comprova a expiração; outras abas precisam
        // reabrir a medição anônima depois de invalidarem a identidade.
        notifyAnalyticsViewReady({ broadcastLogout: true });
      } else {
        // Se este refresh silencioso tornou um refresh bloqueante anterior
        // obsoleto, a falha transitória também precisa liberar o loading.
        setState((current) => current.usuario
          ? { ...current, loading: false }
          : { ...SIGNED_OUT_STATE, syncError: error.message || "Não foi possível carregar sua conta. Tente novamente." });
      }
      throw error;
    } finally {
      if (sessionSyncAbortRef.current === syncController) {
        sessionSyncAbortRef.current = null;
      }
    }
  }, [abortSessionSync]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  useEffect(() => () => {
    abortSessionSync();
  }, [abortSessionSync]);

  useEffect(() => {
    function handleSessionCleared() {
      beginSessionTransition();
      verifiedIdentityRef.current = null;
      setState(SIGNED_OUT_STATE);
    }

    function handleStorage(event) {
      if (event.key === AUTH_LOGOUT_READY_STORAGE_KEY) {
        // Logout confirmado na outra aba só libera view anônima se não houve novo login.
        if (!hasSession()) notifyAnalyticsViewReady();
        return;
      }

      if (event.key === AUTH_REVISION_STORAGE_KEY) {
        // Outra aba pode trocar de conta mantendo session_active='1'.
        // Suspender medição, ocultar o estado anterior e revalidar no servidor.
        notifyAnalyticsIdentityBoundary({ broadcast: false });
        transitionsRef.current.begin();
        beginSessionTransition();
        verifiedIdentityRef.current = null;
        if (!hasSession()) {
          setState(SIGNED_OUT_STATE);
        } else {
          setState({ ...SIGNED_OUT_STATE, loading: true });
          void refresh().catch(() => {});
        }
        return;
      }

      if (["token", "session_active", "usuario", "negocio"].includes(event.key) && !hasSession()) {
        notifyAnalyticsIdentityBoundary({ broadcast: false });
        handleSessionCleared();
      }
    }

    window.addEventListener(SESSION_CLEARED_EVENT, handleSessionCleared);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(SESSION_CLEARED_EVENT, handleSessionCleared);
      window.removeEventListener("storage", handleStorage);
    };
  }, [beginSessionTransition, refresh]);

  const authenticate = useCallback((path, body) => {
    const transitions = transitionsRef.current;
    const intent = transitions.begin();
    beginSessionTransition();
    return transitions.enqueue(async () => {
      if (!transitions.isCurrent(intent)) throw supersededSessionTransition();
      try {
        const result = await apiRequest(path, { method: "POST", body });
        if (!transitions.isCurrent(intent)) throw supersededSessionTransition();
        // Login de conta já existente não herda tentativas anônimas prévias.
        // A primeira inscrição real mantém a sessão para conciliação com o backend.
        if (!hasSession() && (path === "/login" || (
          path === "/auth/google" && result.contaCriada !== true
        ))) {
          notifyAnalyticsIdentityBoundary({ broadcast: false });
        }
        saveSession(result);
        verifiedIdentityRef.current = result.usuario?.id ?? null;
        const current = await refresh();
        if (!transitions.isCurrent(intent)) throw supersededSessionTransition();
        return { ...current, contaCriada: Boolean(result.contaCriada) };
      } catch (error) {
        if (!transitions.isCurrent(intent)) throw supersededSessionTransition();
        throw error;
      }
    });
  }, [beginSessionTransition, refresh]);

  const login = useCallback(payload => authenticate("/login", payload), [authenticate]);
  const register = useCallback(payload => authenticate("/cadastro", payload), [authenticate]);

  const loginWithGoogle = useCallback((
    credential,
    marketing,
    meta,
    aceitaNotificacoesWhatsapp,
    perfilProfissional
  ) => authenticate("/auth/google", {
    credential,
    ...(typeof aceitaNotificacoesWhatsapp === "boolean" ? { aceitaNotificacoesWhatsapp } : {}),
    ...(marketing ? { marketing } : {}),
    ...(meta ? { meta } : {}),
    ...(typeof perfilProfissional === "boolean" ? { perfil_profissional: perfilProfissional } : {})
  }), [authenticate]);

  const adoptCreatedBusiness = useCallback((business) => {
    const businessId = Number(business?.id);

    if (!Number.isInteger(businessId) || businessId <= 0) {
      throw new Error("O negócio criado não possui um identificador válido.");
    }

    if (!hasSession()) {
      return false;
    }

    const ownerBusiness = {
      ...business,
      id: businessId,
      papel: "dono"
    };

    beginSessionTransition();

    setState((current) => {
      if (!current.authenticated) {
        return current;
      }

      const remainingLinks = current.vinculos.filter(
        (link) => Number(link?.id) !== businessId
      );

      return {
        ...current,
        loading: false,
        negocioPrincipal: ownerBusiness,
        vinculos: [ownerBusiness, ...remainingLinks],
        temNegocio: true
      };
    });

    return true;
  }, [beginSessionTransition]);

  const adoptArchivedBusiness = useCallback((business) => {
    const businessId = Number(business?.id);
    if (!Number.isInteger(businessId) || businessId <= 0 || !hasSession()) return false;
    beginSessionTransition();
    setState((current) => {
      if (!current.authenticated) return current;
      const remainingLinks = current.vinculos.filter((link) => Number(link?.id) !== businessId);
      return {
        ...current,
        loading: false,
        vinculos: remainingLinks,
        negocioPrincipal: Number(current.negocioPrincipal?.id) === businessId
          ? remainingLinks[0] || null : current.negocioPrincipal,
        temNegocio: remainingLinks.length > 0,
      };
    });
    return true;
  }, [beginSessionTransition]);

  const logout = useCallback(() => {
    // Mesmo uma saída repetida cancela autenticações enfileiradas depois dela.
    const transitions = transitionsRef.current;
    transitions.begin();
    beginSessionTransition();
    clearSession();
    verifiedIdentityRef.current = null;
    setState(SIGNED_OUT_STATE);
    if (pendingLogoutRef.current) return pendingLogoutRef.current;

    const pending = transitions.enqueue(async () => {
      try {
        await apiRequest("/logout", { method: "POST" });
        // Logout HTTP confirmado; a identidade anterior já não autoriza.
        notifyAnalyticsViewReady({ broadcastLogout: true });
      } catch {
        // A saída local precisa funcionar mesmo durante uma falha de rede.
      } finally {
        if (pendingLogoutRef.current === pending) pendingLogoutRef.current = null;
      }
    });
    pendingLogoutRef.current = pending;
    return pending;
  }, [beginSessionTransition]);

  const routeSession = useMemo(() => ({
    ...state,
    negocio: getBusinessContextForPath(
      {
        ...state,
        negocio: state.negocioPrincipal
      },
      location.pathname
    )
  }), [state, location.pathname]);

  const value = useMemo(() => ({
    ...routeSession,
    refresh,
    login,
    register,
    loginWithGoogle,
    adoptCreatedBusiness,
    adoptArchivedBusiness,
    logout
  }), [
    routeSession,
    refresh,
    login,
    register,
    loginWithGoogle,
    adoptCreatedBusiness,
    adoptArchivedBusiness,
    logout
  ]);

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession deve ser usado dentro de SessionProvider.");
  }

  return context;
}

export function useOptionalSession() {
  return useContext(SessionContext);
}
