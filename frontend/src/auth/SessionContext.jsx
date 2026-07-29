import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { apiRequest } from "../api/client";
import { clearSession, getStoredUser, hasSession, saveSession } from "./session";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [state, setState] = useState({
    loading: hasSession(),
    authenticated: hasSession(),
    usuario: getStoredUser(),
    negocio: null,
    temNegocio: false
  });

  const refresh = useCallback(async () => {
    if (!hasSession()) {
      setState({
        loading: false,
        authenticated: false,
        usuario: null,
        negocio: null,
        temNegocio: false
      });
      return null;
    }

    setState((current) => ({ ...current, loading: true }));

    try {
      const result = await apiRequest("/minha-sessao");
      localStorage.setItem("usuario", JSON.stringify(result.usuario));

      if (result.negocio) {
        localStorage.setItem("negocio", JSON.stringify(result.negocio));
      } else {
        localStorage.removeItem("negocio");
      }

      const next = {
        loading: false,
        authenticated: true,
        usuario: result.usuario,
        negocio: result.negocio,
        temNegocio: Boolean(result.temNegocio)
      };
      setState(next);
      return next;
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        clearSession();
        setState({
          loading: false,
          authenticated: false,
          usuario: null,
          negocio: null,
          temNegocio: false
        });
      } else {
        setState((current) => ({ ...current, loading: false }));
      }
      throw error;
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const login = useCallback(async (payload) => {
    const result = await apiRequest("/login", {
      method: "POST",
      body: payload
    });
    saveSession(result);
    await refresh();
    return result;
  }, [refresh]);

  const register = useCallback(async (payload) => {
    const result = await apiRequest("/cadastro", {
      method: "POST",
      body: payload
    });
    saveSession(result);
    await refresh();
    return result;
  }, [refresh]);

  const loginWithGoogle = useCallback(async (credential) => {
    const result = await apiRequest("/auth/google", {
      method: "POST",
      body: { credential }
    });
    saveSession(result);
    await refresh();
    return result;
  }, [refresh]);

  const logout = useCallback(() => {
    clearSession();
    setState({
      loading: false,
      authenticated: false,
      usuario: null,
      negocio: null,
      temNegocio: false
    });
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
