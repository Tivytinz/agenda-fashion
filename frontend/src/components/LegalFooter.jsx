import { Link, useLocation } from "react-router-dom";
import { useSession } from "../auth/SessionContext";
import {
  LEGAL_CONTACT_EMAIL
} from "../config/legal";

export function LegalFooter() {
  const { pathname } = useLocation();
  const session = useSession();
  const adminArea = pathname.startsWith("/admin/")
    || (pathname === "/conta" && session.ehAdministrador);

  return (
    <footer className={adminArea ? "legal-footer admin-legal-footer" : "legal-footer"}>
      <div className="container legal-footer-content">
        <p>
          © {new Date().getFullYear()} {adminArea ? "Agenda Fashion · Administração" : "Agenda Fashion"}
        </p>
        <nav aria-label="Informações legais e suporte">
          <Link to="/privacidade">
            Privacidade
          </Link>
          <Link to="/termos">
            Termos de uso
          </Link>
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
            Suporte
          </a>
        </nav>
      </div>
    </footer>
  );
}
