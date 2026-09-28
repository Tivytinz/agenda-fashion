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

  const refresh = useCallback(async ({ silent = false } = {}) => {
    const requestId = ++refreshRequestRef.current;
    const sessionGeneration = sessionGenerationRef.current;
    const canApply = () => (
      sessionGeneration === sessionGenerationRef.current
      && requestId > lastAppliedRefreshRef.current
    );
    const canApplyDestructiveResult = () => (
      canApply()
      && requestId === refreshRequestRef.current
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

    try {
      const migration =
        await migrateLegacySession();

      if (!canApply()) {
        return null;
      }

      if (migration.invalid) {
        if (!canApplyDestructiveResult()) {
          return null;
        }

        sessionGenerationRef.current += 1;
        lastAppliedRefreshRef.current = requestId;
        setState(SIGNED_OUT_STATE);
        return null;
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
        if (!canApplyDestructiveResult()) {
          return null;
        }

        sessionGenerationRef.current += 1;
        lastAppliedRefreshRef.current = requestId;
        clearSession();
        setState(SIGNED_OUT_STATE);
      } else if (!silent) {
        setState((current) => ({ ...current, loading: false }));
      }
      throw error;
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  useEffect(() => {
    function handleSessionCleared() {
      sessionGenerationRef.current += 1;
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
  }, []);

  const login = useCallback(async (payload) => {
    const result = await apiRequest("/login", {
      method: "POST",
      body: payload
    });
    sessionGenerationRef.current += 1;
    saveSession(result);
    return refresh();
  }, [refresh]);

  const register = useCallback(async (payload) => {
    const result = await apiRequest("/cadastro", {
      method: "POST",
      body: payload
    });
    sessionGenerationRef.current += 1;
    saveSession(result);
    const current = await refresh();

    return {
      ...current,
      contaCriada: Boolean(result.contaCriada)
    };
  }, [refresh]);

  const loginWithGoogle = useCallback(async (
    credential,
    marketing,
    meta,
    aceitaNotificacoesWhatsapp,
    perfilProfissional
  ) => {
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
    sessionGenerationRef.current += 1;
    saveSession(result);
    const current = await refresh();

    return {
      ...current,
      contaCriada: Boolean(result.contaCriada)
    };
  }, [refresh]);

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

    sessionGenerationRef.current += 1;

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
  }, []);

  const logout = useCallback(async () => {
    sessionGenerationRef.current += 1;
    clearSession();
    setState(SIGNED_OUT_STATE);

    try {
      await apiRequest("/logout", {
        method: "POST"
      });
    } catch {
      // A saída local precisa funcionar mesmo durante uma falha de rede.
    }
  }, []);

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
