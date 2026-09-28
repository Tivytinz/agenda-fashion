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
  saveSession,
  SESSION_CLEARED_EVENT
} from "./session";

const SessionContext = createContext(null);
const SIGNED_OUT_STATE = {
  loading: false,
  authenticated: false,
  usuario: null,
  negocioPrincipal: null,
  vinculos: [],
  temNegocio: false,
  administrador: null,
  ehAdministrador: false
};

export function SessionProvider({ children }) {
  const location = useLocation();
  const sessionGenerationRef = useRef(0);
  const refreshRequestRef = useRef(0);
  const lastAppliedRefreshRef = useRef(0);
  const legacyMigrationAbortRef = useRef(null);
  const [state, setState] = useState(() => {
    const sessionPresent =
      hasSession();

    clearStoredSessionMetadata();

    return {
      loading: sessionPresent,
      authenticated: sessionPresent,
      usuario: null,
      negocioPrincipal: null,
      vinculos: [],
      temNegocio: false,
      administrador: null,
      ehAdministrador: false
    };
  });

  const abortLegacyMigration = useCallback(() => {
    legacyMigrationAbortRef.current?.abort();
    legacyMigrationAbortRef.current = null;
  }, []);

  const beginSessionTransition = useCallback(() => {
    sessionGenerationRef.current += 1;
    abortLegacyMigration();
  }, [abortLegacyMigration]);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    const requestId = ++refreshRequestRef.current;
    const sessionGeneration = sessionGenerationRef.current;
    abortLegacyMigration();
    const canApply = () => (
      sessionGeneration === sessionGenerationRef.current
      && requestId === refreshRequestRef.current
      && requestId > lastAppliedRefreshRef.current
    );

    if (!hasSession()) {
      sessionGenerationRef.current += 1;
      lastAppliedRefreshRef.current = requestId;
      setState(SIGNED_OUT_STATE);
      return null;
    }

    if (!silent) {
      setState((current) => ({ ...current, loading: true }));
    }

    const migrationController = new AbortController();
    legacyMigrationAbortRef.current = migrationController;

    try {
      let migration;
      try {
        migration = await migrateLegacySession({
          signal: migrationController.signal
        });
      } finally {
        if (legacyMigrationAbortRef.current === migrationController) {
          legacyMigrationAbortRef.current = null;
        }
      }

      if (!canApply()) {
        return null;
      }

      if (migration.invalid) {
        sessionGenerationRef.current += 1;
        lastAppliedRefreshRef.current = requestId;
        clearSession();
        setState(SIGNED_OUT_STATE);
        return null;
      }

      if (migration.migrated || migration.alreadyCookie) {
        completeLegacySessionMigration();
      }

      const result = await apiRequest("/minha-sessao", {
        // O contexto conhece a geração/requestId deste refresh. Deixe que ele
        // decida se um 401 ainda pertence à sessão atual antes de limpá-la.
        clearSessionOnUnauthorized: false
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
        authenticated: true,
        usuario: result.usuario,
        negocioPrincipal: result.negocio || vinculos[0] || null,
        vinculos,
        temNegocio: vinculos.length > 0 || Boolean(result.temNegocio),
        administrador: result.administrador || null,
        ehAdministrador: Boolean(result.ehAdministrador)
      };
      lastAppliedRefreshRef.current = requestId;
      setState(next);

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
        setState(SIGNED_OUT_STATE);
      } else {
        // Se este refresh silencioso tornou um refresh bloqueante anterior
        // obsoleto, a falha transitória também precisa liberar o loading.
        setState((current) => ({ ...current, loading: false }));
      }
      throw error;
    }
  }, [abortLegacyMigration]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  useEffect(() => () => {
    abortLegacyMigration();
  }, [abortLegacyMigration]);

  useEffect(() => {
    function handleSessionCleared() {
      beginSessionTransition();
      setState(SIGNED_OUT_STATE);
    }

    function handleStorage(event) {
      if (["token", "session_active", "usuario", "negocio"].includes(event.key) && !hasSession()) {
        handleSessionCleared();
      }
    }

    window.addEventListener(SESSION_CLEARED_EVENT, handleSessionCleared);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(SESSION_CLEARED_EVENT, handleSessionCleared);
      window.removeEventListener("storage", handleStorage);
    };
  }, [beginSessionTransition]);

  const login = useCallback(async (payload) => {
    beginSessionTransition();
    const result = await apiRequest("/login", {
      method: "POST",
      body: payload
    });
    saveSession(result);
    return refresh();
  }, [beginSessionTransition, refresh]);

  const register = useCallback(async (payload) => {
    beginSessionTransition();
    const result = await apiRequest("/cadastro", {
      method: "POST",
      body: payload
    });
    saveSession(result);
    const current = await refresh();

    return {
      ...current,
      contaCriada: Boolean(result.contaCriada)
    };
  }, [beginSessionTransition, refresh]);

  const loginWithGoogle = useCallback(async (
    credential,
    marketing,
    meta,
    aceitaNotificacoesWhatsapp,
    perfilProfissional
  ) => {
    beginSessionTransition();
    const result = await apiRequest("/auth/google", {
      method: "POST",
      body: {
        credential,
        ...(typeof aceitaNotificacoesWhatsapp === "boolean"
          ? { aceitaNotificacoesWhatsapp }
          : {}),
        ...(marketing ? { marketing } : {}),
        ...(meta ? { meta } : {}),
        ...(typeof perfilProfissional === "boolean"
          ? { perfil_profissional: perfilProfissional }
          : {})
      }
    });
    saveSession(result);
    const current = await refresh();

    return {
      ...current,
      contaCriada: Boolean(result.contaCriada)
    };
  }, [beginSessionTransition, refresh]);

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

  const logout = useCallback(async () => {
    beginSessionTransition();
    clearSession();
    setState(SIGNED_OUT_STATE);

    try {
      await apiRequest("/logout", {
        method: "POST"
      });
    } catch {
      // A saída local precisa funcionar mesmo durante uma falha de rede.
    }
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
    logout
  }), [
    routeSession,
    refresh,
    login,
    register,
    loginWithGoogle,
    adoptCreatedBusiness,
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
