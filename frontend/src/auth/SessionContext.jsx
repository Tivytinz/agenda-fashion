import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { useLocation } from "react-router-dom";
import { apiRequest } from "../api/client";
import {
  clearSession,
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
  const [state, setState] = useState({
    loading: hasSession(),
    authenticated: hasSession(),
    usuario: null,
    negocioPrincipal: null,
    vinculos: [],
    temNegocio: false,
    administrador: null,
    ehAdministrador: false
  });

  const refresh = useCallback(async () => {
    if (!hasSession()) {
      setState(SIGNED_OUT_STATE);
      return null;
    }

    setState((current) => ({ ...current, loading: true }));

    try {
      const result = await apiRequest("/minha-sessao");

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
      setState(next);

      return {
        ...next,
        negocio: next.negocioPrincipal
      };
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        clearSession();
        setState(SIGNED_OUT_STATE);
      } else {
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
    saveSession(result);
    return refresh();
  }, [refresh]);

  const register = useCallback(async (payload) => {
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
    saveSession(result);
    const current = await refresh();

    return {
      ...current,
      contaCriada: Boolean(result.contaCriada)
    };
  }, [refresh]);

  const logout = useCallback(async () => {
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
    logout
  }), [routeSession, refresh, login, register, loginWithGoogle, logout]);

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
