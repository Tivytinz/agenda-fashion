import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { normalizePlanSlug } from "../auth/session";

const SetupFlowContext = createContext(null);

function focusedRoute(location) {
  const params = new URLSearchParams(location.search);
  const path = location.pathname;
  if (path === "/criar-negocio") return true;
  if (["/cadastro", "/entrar"].includes(path)) {
    return params.get("tipo") === "profissional" || Boolean(normalizePlanSlug(params.get("plano")));
  }
  if (path === "/painel/servicos/novo") return params.get("onboarding") === "servico";
  if (path === "/painel/horarios" && !(Number(params.get("profissional")) > 0)) {
    return params.get("onboarding") === "divulgacao" || location.state?.onboarding === true;
  }
  return false;
}

export function SetupFlowProvider({ children }) {
  const location = useLocation();
  const [frames, setFrames] = useState(0);
  const register = useCallback(() => {
    setFrames((count) => count + 1);
    return () => setFrames((count) => count - 1);
  }, []);
  const focused = frames > 0 || focusedRoute(location);
  const value = useMemo(() => ({ focused, register }), [focused, register]);
  return <SetupFlowContext.Provider value={value}>{children}</SetupFlowContext.Provider>;
}

export function useSetupFocus() {
  return useContext(SetupFlowContext)?.focused === true;
}

export function useSetupFrame(enabled) {
  const register = useContext(SetupFlowContext)?.register;
  useLayoutEffect(() => {
    if (enabled && register) return register();
    return undefined;
  }, [enabled, register]);
}
