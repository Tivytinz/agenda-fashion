import { lazy } from "react";
import { useLocation } from "react-router-dom";
import { useSession } from "../auth/SessionContext";
import {
  getOwnerContext,
  getProfessionalContext
} from "../auth/session";

const OwnerShell = lazy(() =>
  Promise.all([
    import("../styles/owner-shell.css"),
    import("./OwnerShell")
  ]).then(([, module]) => ({ default: module.OwnerShell }))
);

const ProfessionalShell = lazy(() =>
  Promise.all([
    import("../styles/professional-shell.css"),
    import("./ProfessionalShell")
  ]).then(([, module]) => ({ default: module.ProfessionalShell }))
);

export const OWNER_LINKS = [
  ["/painel", "Visão geral", "home"],
  ["/painel/agenda", "Agenda", "calendar"],
  ["/painel/servicos", "Serviços", "services"],
  ["/painel/horarios", "Horários", "clock"],
  ["/painel/profissionais", "Equipe", "team"],
  ["/painel/negocio", "Meu negócio", "business"],
  ["/painel/assinatura", "Plano e assinatura", "plan"],
  ["/conta", "Minha conta", "account"]
];

export const PROFESSIONAL_LINKS = [
  ["/profissional/agenda", "Minha agenda", "calendar"],
  ["/profissional/horarios", "Meus horários", "clock"],
  ["/convites", "Convites", "team"],
  ["/conta", "Minha conta", "account"]
];

export { MobileWorkspaceNavigation } from "./WorkspaceNavigation";

export function WorkspaceLayout({ children }) {
  const session = useSession();
  const location = useLocation();
  const ownerContext = getOwnerContext(session);
  const professionalContext = getProfessionalContext(session);
  const professionalRoute =
    location.pathname === "/profissional" ||
    location.pathname.startsWith("/profissional/");
  const ownerRoute =
    location.pathname === "/painel" ||
    location.pathname.startsWith("/painel/");

  if (professionalRoute && professionalContext) {
    return (
      <ProfessionalShell links={PROFESSIONAL_LINKS}>
        {children}
      </ProfessionalShell>
    );
  }

  if (ownerRoute && ownerContext) {
    return (
      <OwnerShell links={OWNER_LINKS}>
        {children}
      </OwnerShell>
    );
  }

  if (session.negocio?.papel === "profissional" && professionalContext) {
    return (
      <ProfessionalShell links={PROFESSIONAL_LINKS}>
        {children}
      </ProfessionalShell>
    );
  }

  return (
    <OwnerShell links={OWNER_LINKS}>
      {children}
    </OwnerShell>
  );
}
