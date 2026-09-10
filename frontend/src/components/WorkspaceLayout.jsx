import { lazy } from "react";
import { useSession } from "../auth/SessionContext";

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
  ["/conta", "Minha conta", "account"]
];

export { MobileWorkspaceNavigation } from "./WorkspaceNavigation";

export function WorkspaceLayout({ children }) {
  const { negocio } = useSession();
  const owner = negocio?.papel === "dono";

  if (owner) {
    return (
      <OwnerShell links={OWNER_LINKS}>
        {children}
      </OwnerShell>
    );
  }

  return (
    <ProfessionalShell links={PROFESSIONAL_LINKS}>
      {children}
    </ProfessionalShell>
  );
}
