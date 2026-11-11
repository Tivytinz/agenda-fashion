import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { SessionProvider, useSession } from "../../src/auth/SessionContext";

function Probe() {
  const session = useSession();
  return <>
    <span data-testid="session">{session.authenticated ? session.usuario?.nome : "Desconectada"}</span>
    <button onClick={() => session.login({ email: "bruna@example.com", senha: "teste" }).catch(() => {})}>Autenticar</button>
    <button onClick={session.logout}>Sair</button>
  </>;
}
createRoot(document.getElementById("root")).render(<MemoryRouter><SessionProvider><Probe /></SessionProvider></MemoryRouter>);
