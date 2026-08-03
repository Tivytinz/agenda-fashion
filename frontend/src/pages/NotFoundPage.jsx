import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="container not-found-page">
      <p className="eyebrow">Página não encontrada</p>
      <h1>Esse endereço não existe</h1>
      <p>
        O link pode estar incompleto ou a página pode ter sido movida.
      </p>
      <Link className="button" to="/">
        Encontrar serviços
      </Link>
    </main>
  );
}
