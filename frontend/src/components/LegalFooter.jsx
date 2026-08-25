import { Link } from "react-router-dom";
import {
  LEGAL_CONTACT_EMAIL
} from "../config/legal";

export function LegalFooter() {
  return (
    <footer className="legal-footer">
      <div className="container legal-footer-content">
        <p>
          © {new Date().getFullYear()} Agenda Fashion
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
