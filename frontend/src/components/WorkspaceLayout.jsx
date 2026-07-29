import { NavLink, Outlet } from "react-router-dom";
import { useSession } from "../auth/SessionContext";

const OWNER_LINKS = [
  ["/painel", "Visão geral", "⌂"],
  ["/painel/agenda", "Agenda", "▦"],
  ["/painel/servicos", "Serviços", "✦"],
  ["/painel/profissionais", "Profissionais", "♙"],
  ["/painel/horarios", "Horários", "◷"],
  ["/painel/negocio", "Meu negócio", "◇"],
  ["/painel/assinatura", "Plano e assinatura", "◉"],
  ["/conta", "Minha conta", "○"]
];

const PROFESSIONAL_LINKS = [
  ["/profissional/agenda", "Minha agenda", "▦"],
  ["/profissional/horarios", "Meus horários", "◷"],
  ["/conta", "Minha conta", "○"]
];

export function WorkspaceLayout({ children }) {
  const { negocio } = useSession();
  const owner = negocio?.papel === "dono";
  const links = owner ? OWNER_LINKS : PROFESSIONAL_LINKS;

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar" aria-label="Área de trabalho">
        <div className="workspace-business">
          <span>{String(negocio?.nome || "A").slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{negocio?.nome || "Agenda Fashion"}</strong>
            <small>{owner ? "Administração" : "Área profissional"}</small>
          </div>
        </div>
        <nav>
          {links.map(([to, label, icon]) => (
            <NavLink
              className={({ isActive }) => isActive ? "workspace-link active" : "workspace-link"}
              end={to === "/painel" || to === "/profissional/agenda"}
              key={to}
              to={to}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <section className="workspace-content">
        {children || <Outlet />}
      </section>
    </div>
  );
}
