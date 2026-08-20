import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { apiRequest } from "../api/client";
import {
  clearSession,
  getStoredUser,
  hasSession,
  saveSession,
  SESSION_CLEARED_EVENT
} from "./session";
import {
  removeBrowserStorage,
  writeBrowserStorage
} from "../utils/browserStorage";

const SessionContext = createContext(null);
const SIGNED_OUT_STATE = {
  loading: false,
  authenticated: false,
  usuario: null,
  negocio: null,
  temNegocio: false,
  administrador: null,
  ehAdministrador: false
};

export function SessionProvider({ children }) {
  const [state, setState] = useState({
    loading: hasSession(),
    authenticated: hasSession(),
    usuario: getStoredUser(),
    negocio: null,
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
      writeBrowserStorage("local", "usuario", JSON.stringify(result.usuario));

      if (result.negocio) {
        writeBrowserStorage("local", "negocio", JSON.stringify(result.negocio));
      } else {
        removeBrowserStorage("local", "negocio");
      }

      const next = {
        loading: false,
        authenticated: true,
        usuario: result.usuario,
        negocio: result.negocio,
        temNegocio: Boolean(result.temNegocio),
        administrador: result.administrador || null,
        ehAdministrador: Boolean(result.ehAdministrador)
      };
      setState(next);
      return next;
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
    aceitaNotificacoesWhatsapp
  ) => {
    const result = await apiRequest("/auth/google", {
      method: "POST",
      body: {
        credential,
        ...(typeof aceitaNotificacoesWhatsapp === "boolean"
          ? { aceitaNotificacoesWhatsapp }
          : {}),
        ...(marketing ? { marketing } : {}),
        ...(meta ? { meta } : {})
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

  const value = useMemo(() => ({
    ...state,
    refresh,
    login,
    register,
    loginWithGoogle,
    logout
  }), [state, refresh, login, register, loginWithGoogle, logout]);

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
