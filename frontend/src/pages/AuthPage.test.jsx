// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MemoryRouter,
  Route,
  Routes
} from "react-router-dom";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { safeReturnPath, WHATSAPP_PATTERN } from "./AuthPage";
import { trackFirstPartyEvent } from "../analytics/firstPartyAnalytics";
import { ApiError } from "../api/errors";
import { apiRequest } from "../api/client";

vi.mock("../analytics/firstPartyAnalytics", async (importOriginal) => ({
  ...(await importOriginal()),
  trackFirstPartyEvent: vi.fn()
}));

const login = vi.fn();
const register = vi.fn();
const loginWithGoogle = vi.fn();
const refreshSession = vi.fn();

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
let sessionLoading = false;
let authenticatedSession = null;

vi.mock("../auth/SessionContext", () => ({
  useSession: () => authenticatedSession || ({
    authenticated: false,
    loading: sessionLoading,
    temNegocio: false,
    ehAdministrador: false,
    login,
    register,
    loginWithGoogle
  })
}));

vi.mock("../components/GoogleLoginButton", () => ({
  GoogleLoginButton: ({ onCredential }) => <button onClick={() => onCredential("google-credential")}>Entrar com Google</button>
}));

const { AuthPage } = await import("./AuthPage");

beforeEach(() => {
  sessionLoading = false;
  authenticatedSession = null;
  login.mockReset();
  register.mockReset();
  loginWithGoogle.mockReset();
  trackFirstPartyEvent.mockClear();
  apiRequest.mockReset();
  refreshSession.mockReset();
  sessionStorage.clear();

  login.mockResolvedValue({
    authenticated: true,
    temNegocio: false,
    ehAdministrador: true
  });

  register.mockResolvedValue({
    authenticated: true,
    temNegocio: false,
    ehAdministrador: false,
    usuario: {
      id: 2,
      nome: "Ana"
    }
  });

  loginWithGoogle.mockResolvedValue({
    authenticated: true,
    temNegocio: false,
    ehAdministrador: false,
    contaCriada: true,
    usuario: {
      id: 3,
      nome: "Ana"
    }
  });
});

afterEach(cleanup);

describe("retorno após autenticação", () => {
  it("aguarda a sessão inicial antes de oferecer senha ou Google", () => {
    sessionLoading = true;
    render(<MemoryRouter><AuthPage /></MemoryRouter>);
    expect(screen.getByText("Carregando sua conta...")).not.toBeNull();
    expect(screen.queryByLabelText("E-mail")).toBeNull();
    expect(screen.queryByText("Entrar com Google")).toBeNull();
  });
  it("aceita somente caminhos internos", () => {
    expect(safeReturnPath("/minha-agenda?filtro=hoje")).toBe("/minha-agenda?filtro=hoje");
    expect(safeReturnPath("//site-malicioso.test")).toBe("");
    expect(safeReturnPath("https://site-malicioso.test")).toBe("");
    expect(safeReturnPath(null)).toBe("");
  });
});

describe("retorno à etapa 1 após conta criada", () => {
  it("edita todos os campos de cadastro na própria etapa, sem criar nova conta", async () => {
    authenticatedSession = {
      authenticated: true, loading: false, temNegocio: false,
      usuario: { id: 7, nome: "Ana", email: "ana@example.test", whatsapp: "62999999999" },
      refresh: refreshSession, login
    };
    render(<MemoryRouter initialEntries={["/cadastro?tipo=profissional&plano=autonoma"]}>
      <Routes>
        <Route path="/cadastro" element={<AuthPage mode="register" />} />
        <Route path="/criar-negocio" element={<h1>Etapa 2 do cadastro</h1>} />
      </Routes>
    </MemoryRouter>);
    expect(screen.getByLabelText("Etapa 1 de 4: Conta")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Sua conta" })).not.toBeNull();
    expect(screen.getByLabelText("E-mail").value).toBe("ana@example.test");
    expect(screen.getByLabelText("E-mail").readOnly).toBe(false);
    expect(screen.getByLabelText("Nome completo").value).toBe("Ana");
    expect(screen.getByLabelText("WhatsApp com DDD").value).toBe("(62) 99999-9999");
    expect(screen.queryByRole("link", { name: "Editar meus dados" })).toBeNull();
    expect(register).not.toHaveBeenCalled();
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Nome completo"));
    await user.type(screen.getByLabelText("Nome completo"), "Ana Silva");
    await user.clear(screen.getByLabelText("E-mail"));
    await user.type(screen.getByLabelText("E-mail"), "nova@example.test");
    await user.clear(screen.getByLabelText("WhatsApp com DDD"));
    await user.type(screen.getByLabelText("WhatsApp com DDD"), "11987654321");
    expect(screen.getByLabelText("Senha atual")).not.toBeNull();
    await user.type(screen.getByLabelText("Senha atual"), "senha-atual");
    apiRequest.mockResolvedValue({});
    refreshSession.mockResolvedValue({
      authenticated: true, usuario: { id: 7, nome: "Ana Silva", email: "nova@example.test", whatsapp: "11987654321" }
    });
    await user.click(screen.getByRole("button", { name: "Salvar e continuar" }));
    expect(await screen.findByRole("heading", { name: "Etapa 2 do cadastro" })).not.toBeNull();
    expect(apiRequest).toHaveBeenCalledWith("/conta/email", expect.objectContaining({
      method: "PUT", body: { email: "nova@example.test", senhaAtual: "senha-atual" }
    }));
    expect(apiRequest).toHaveBeenCalledWith("/conta", expect.objectContaining({
      method: "PUT", body: { nome: "Ana Silva", whatsapp: "11987654321" }
    }));
    expect(refreshSession).toHaveBeenCalledWith({ silent: true });
    expect(register).not.toHaveBeenCalled();
  });


  it("segue sem salvamento desnecessário quando nada foi modificado", async () => {
    authenticatedSession = {
      authenticated: true, loading: false, temNegocio: false,
      usuario: { id: 7, nome: "Ana", email: "ana@example.test", whatsapp: "62999999999" },
      refresh: refreshSession
    };
    render(<MemoryRouter initialEntries={["/cadastro?tipo=profissional"]}>
      <Routes>
        <Route path="/cadastro" element={<AuthPage mode="register" />} />
        <Route path="/criar-negocio" element={<h1>Etapa 2 do cadastro</h1>} />
      </Routes>
    </MemoryRouter>);
    await userEvent.setup().click(screen.getByRole("button", { name: "Continuar para o negócio" }));
    expect(await screen.findByRole("heading", { name: "Etapa 2 do cadastro" })).not.toBeNull();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("mantém os dados digitados na etapa 1 quando o backend rejeita a alteração", async () => {
    authenticatedSession = {
      authenticated: true, loading: false, temNegocio: false,
      usuario: { id: 7, nome: "Ana", email: "ana@example.test", whatsapp: "62999999999" },
      refresh: refreshSession
    };
    render(<MemoryRouter initialEntries={["/cadastro?tipo=profissional"]}>
      <Routes><Route path="/cadastro" element={<AuthPage mode="register" />} /></Routes>
    </MemoryRouter>);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("E-mail"));
    await user.type(screen.getByLabelText("E-mail"), "novo@example.test");
    await user.type(screen.getByLabelText("Senha atual"), "senha-errada");
    apiRequest.mockRejectedValueOnce(new Error("Senha atual incorreta."));
    await user.click(screen.getByRole("button", { name: "Salvar e continuar" }));
    expect(await screen.findByRole("alert")).not.toBeNull();
    expect(screen.getByLabelText("E-mail").value).toBe("novo@example.test");
    expect(screen.getByRole("heading", { name: "Sua conta" })).not.toBeNull();
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("permite trocar senha sem sair da primeira etapa", async () => {
    authenticatedSession = {
      authenticated: true, loading: false, temNegocio: false,
      usuario: { id: 7, nome: "Ana", email: "ana@example.test", whatsapp: "62999999999" },
      refresh: refreshSession, login
    };
    render(<MemoryRouter initialEntries={["/cadastro?tipo=profissional"]}>
      <Routes>
        <Route path="/cadastro" element={<AuthPage mode="register" />} />
        <Route path="/criar-negocio" element={<h1>Etapa 2 do cadastro</h1>} />
      </Routes>
    </MemoryRouter>);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "🔒 Alterar senha" }));
    await user.type(screen.getByLabelText("Senha atual"), "antiga-senha");
    await user.type(screen.getByLabelText("Nova senha"), "nova-senha-valida");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "nova-senha-valida");
    apiRequest.mockResolvedValue({});
    login.mockResolvedValue({
      authenticated: true, usuario: { id: 7 }
    });
    await user.click(screen.getByRole("button", { name: "Salvar e continuar" }));
    expect(await screen.findByRole("heading", { name: "Etapa 2 do cadastro" })).not.toBeNull();
    expect(apiRequest).toHaveBeenCalledWith("/conta/senha", expect.objectContaining({
      method: "PUT", body: { senhaAtual: "antiga-senha", novaSenha: "nova-senha-valida" }
    }));
    expect(login).toHaveBeenCalledWith({ email: "ana@example.test", senha: "nova-senha-valida" });
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("bloqueia o envio de e-mail inválido sem chamada ao servidor", async () => {
    authenticatedSession = {
      authenticated: true, loading: false, temNegocio: false,
      usuario: { id: 7, nome: "Ana", email: "ana@example.test", whatsapp: "62999999999" },
      refresh: refreshSession
    };
    render(<MemoryRouter initialEntries={["/cadastro?tipo=profissional"]}>
      <Routes><Route path="/cadastro" element={<AuthPage mode="register" />} /></Routes>
    </MemoryRouter>);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("E-mail"));
    await user.type(screen.getByLabelText("E-mail"), "invalido");
    expect(screen.getByRole("button", { name: "Salvar e continuar" }).disabled).toBe(true);
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("descarta o rascunho privado ao sair da etapa 1 concluída", async () => {
    authenticatedSession = {
      authenticated: true, loading: false, temNegocio: false,
      usuario: { id: 7, nome: "Ana", email: "ana@example.test", whatsapp: "62999999999" }
    };
    sessionStorage.setItem("af_business_creation_draft_v1", "rascunho-somente-teste");
    render(<MemoryRouter initialEntries={["/cadastro?tipo=profissional"]}>
      <Routes>
        <Route path="/cadastro" element={<AuthPage mode="register" />} />
        <Route path="/" element={<h1>Início</h1>} />
      </Routes>
    </MemoryRouter>);
    await userEvent.setup().click(screen.getByRole("link", { name: "Sair" }));
    expect(screen.getByRole("heading", { name: "Início" })).not.toBeNull();
    expect(sessionStorage.getItem("af_business_creation_draft_v1")).toBeNull();
  });

  it("não reabre cadastro quando a conta já tem negócio", async () => {
    authenticatedSession = {
      authenticated: true, loading: false, temNegocio: true,
      usuario: { id: 7, nome: "Ana" }, negocio: { papel: "dono" }
    };
    render(<MemoryRouter initialEntries={["/cadastro?tipo=profissional"]}>
      <Routes>
        <Route path="/cadastro" element={<AuthPage mode="register" />} />
        <Route path="/painel" element={<h1>Painel</h1>} />
      </Routes>
    </MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Painel" })).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "Sua conta" })).toBeNull();
  });
});

describe("validação de WhatsApp", () => {
  const regex = new RegExp(`^(?:${WHATSAPP_PATTERN})$`);

  it("aceita números brasileiros com 10 ou 11 dígitos", () => {
    expect(regex.test("62999332133")).toBe(true);
    expect(regex.test("6233322133")).toBe(true);
    expect(regex.test("(62) 99933-2133")).toBe(true);
  });

  it("rejeita quantidades inválidas de dígitos", () => {
    expect(regex.test("629933213")).toBe(false);
    expect(regex.test("55629993322133")).toBe(false);
  });
});

describe("destino por intenção da autenticação", () => {
  it("mantém cadastro profissional no onboarding de negócio", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cadastro?tipo=profissional"]}>
        <Routes>
          <Route
            path="/cadastro"
            element={<AuthPage mode="register" />}
          />
          <Route
            path="/criar-negocio"
            element={<h1>Criar negócio</h1>}
          />
        </Routes>
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText("Nome completo"), "Ana Profissional");
    await user.type(screen.getByLabelText("E-mail"), "ana.profissional@teste.com");
    await user.type(screen.getByLabelText("WhatsApp com DDD"), "62999998888");
    await user.type(screen.getByLabelText("Senha"), "senha123");
    await user.type(screen.getByLabelText("Confirme a senha"), "senha123");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(
      await screen.findByRole("heading", { name: "Criar negócio" })
    ).not.toBeNull();
  });
});

describe("cadastro profissional enxuto", () => {
  it("mede novamente após edição, mas não duplica erros ao apenas refocar o campo", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/cadastro?tipo=profissional"]}>
      <AuthPage mode="register" />
    </MemoryRouter>);
    const email = screen.getByLabelText("E-mail");
    const errors = () => trackFirstPartyEvent.mock.calls.filter(([event, payload]) =>
      event === "professional_signup_validation_error" && payload.properties.field === "email"
    );
    await user.type(email, "invalido");
    await user.tab();
    await user.click(email);
    await user.tab();
    expect(errors()).toHaveLength(1);
    await user.click(email);
    await user.type(email, "x");
    await user.tab();
    expect(errors()).toHaveLength(2);
    expect(JSON.stringify(trackFirstPartyEvent.mock.calls)).not.toContain("invalidox");
  });

  it("classifica falha HTTP do e-mail sem misturar com erro de campo", async () => {
    register.mockRejectedValueOnce(new ApiError("Mensagem privada do servidor", 503));
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/cadastro?tipo=profissional"]}>
      <AuthPage mode="register" />
    </MemoryRouter>);
    await user.type(screen.getByLabelText("Nome completo"), "Ana Profissional");
    await user.type(screen.getByLabelText("E-mail"), "ana@exemplo.com");
    await user.type(screen.getByLabelText("WhatsApp com DDD"), "62999998888");
    await user.type(screen.getByLabelText("Senha"), "senha1234");
    await user.type(screen.getByLabelText("Confirme a senha"), "senha1234");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    await waitFor(() => expect(trackFirstPartyEvent).toHaveBeenCalledWith(
      "professional_signup_request_error",
      { properties: { method: "email", reason: "server_error" } }
    ));
    expect(trackFirstPartyEvent.mock.calls.filter(([event]) =>
      event === "professional_signup_validation_error"
    )).toHaveLength(0);
    expect(JSON.stringify(trackFirstPartyEvent.mock.calls)).not.toContain("Mensagem privada do servidor");
  });

  it("classifica falha de autenticação Google sem vazar a credencial", async () => {
    loginWithGoogle.mockRejectedValueOnce(new ApiError("Credencial privada", 401));
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/cadastro?tipo=profissional"]}>
      <AuthPage mode="register" />
    </MemoryRouter>);
    await user.click(screen.getByRole("button", { name: "Entrar com Google" }));
    await waitFor(() => expect(trackFirstPartyEvent).toHaveBeenCalledWith(
      "professional_signup_request_error",
      { properties: { method: "google", reason: "auth_rejected" } }
    ));
    expect(trackFirstPartyEvent).toHaveBeenCalledWith(
      "professional_signup_started", { properties: { method: "google", trigger: "google_credential" } }
    );
    expect(trackFirstPartyEvent).toHaveBeenCalledWith(
      "professional_signup_submitted", { properties: { method: "google" } }
    );
    expect(JSON.stringify(trackFirstPartyEvent.mock.calls)).not.toContain("Credencial privada");
    expect(JSON.stringify(trackFirstPartyEvent.mock.calls)).not.toContain("google-credential");
  });


  it("instrumenta início, erro e tentativa profissionais uma vez e sem enviar valores dos campos", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/cadastro?tipo=profissional"]}>
        <AuthPage mode="register" />
      </MemoryRouter>
    );
    const email = screen.getByLabelText("E-mail");
    await user.type(screen.getByLabelText("Nome completo"), "Ana Profissional");
    await user.type(email, "invalido");
    await user.tab();

    expect(trackFirstPartyEvent).toHaveBeenCalledWith(
      "professional_signup_started", { properties: { method: "email", trigger: "form_input" } }
    );
    expect(trackFirstPartyEvent.mock.calls.filter(([event]) =>
      event === "professional_signup_started")).toHaveLength(1);
    expect(trackFirstPartyEvent).toHaveBeenCalledWith(
      "professional_signup_validation_error",
      { properties: { field: "email", reason: "invalid_format" } }
    );

    await user.clear(email);
    await user.type(email, "ana@exemplo.com");
    await user.type(screen.getByLabelText("WhatsApp com DDD"), "62999998888");
    await user.type(screen.getByLabelText("Senha"), "senha1234");
    await user.type(screen.getByLabelText("Confirme a senha"), "senha1234");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(trackFirstPartyEvent).toHaveBeenCalledWith(
      "professional_signup_submitted", { properties: { method: "email" } }
    );
    const payloads = JSON.stringify(trackFirstPartyEvent.mock.calls);
    expect(payloads).not.toContain("ana@exemplo.com");
    expect(payloads).not.toContain("62999998888");
    expect(payloads).not.toContain("senha1234");
  });

  it("não classifica alterações no cadastro de cliente como aquisição profissional", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/cadastro"]}>
        <AuthPage mode="register" />
      </MemoryRouter>
    );
    await user.type(screen.getByLabelText("Nome completo"), "Cliente Teste");
    await user.type(screen.getByLabelText("E-mail"), "cliente@exemplo.com");
    expect(trackFirstPartyEvent).not.toHaveBeenCalled();
  });

  it("deixa consentimentos de WhatsApp para o momento contextual no painel", () => {
    render(
      <MemoryRouter initialEntries={["/cadastro?tipo=profissional"]}>
        <AuthPage mode="register" />
      </MemoryRouter>
    );

    expect(screen.queryByText(/Você atende. O AF cuida do agendamento/i)).toBeNull();
    expect(screen.queryByText(/Avisos do WhatsApp são opcionais/i)).toBeNull();
    expect(screen.queryByText(/avisos operacionais do Agenda Fashion/i)).toBeNull();
    expect(screen.queryByText(/orientações de marketing do Agenda Fashion/i)).toBeNull();
    expect(screen.queryByText(/confirmações, lembretes e atualizações dos meus agendamentos/i)).toBeNull();
  });

  it("mantém os emojis decorativos fora do nome acessível dos campos", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/cadastro?tipo=profissional"]}>
        <AuthPage mode="register" />
      </MemoryRouter>
    );
    for (const name of ["Nome completo", "E-mail", "WhatsApp com DDD", "Senha", "Confirme a senha"]) {
      expect(screen.getByLabelText(name)).not.toBeNull();
    }
    expect(Array.from(container.querySelectorAll(".auth-field-emoji"), node => node.textContent))
      .toEqual(["👤", "✉️", "📱", "🔒", "🔒"]);
    expect(container.querySelectorAll('.auth-field-emoji[aria-hidden="true"]')).toHaveLength(5);
  });

  it("alternância 🙈/🐵 revela cada senha independentemente sem submeter", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/cadastro?tipo=profissional"]}>
        <AuthPage mode="register" />
      </MemoryRouter>
    );
    const password = screen.getByLabelText("Senha");
    const confirm = screen.getByLabelText("Confirme a senha");
    await user.type(password, "senha1234");
    expect(password.type).toBe("password");
    expect(confirm.type).toBe("password");
    expect(screen.getByRole("button", { name: "Mostrar senha" }).textContent).toBe("🙈");
    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(password.type).toBe("text");
    expect(password.value).toBe("senha1234");
    expect(confirm.type).toBe("password");
    expect(screen.getByRole("button", { name: "Ocultar senha" }).textContent).toBe("🐵");
    await user.click(screen.getByRole("button", { name: "Mostrar confirmação da senha" }));
    expect(confirm.type).toBe("text");
    await user.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(password.type).toBe("password");
    expect(screen.getByRole("button", { name: "Mostrar senha" }).textContent).toBe("🙈");
    expect(register).not.toHaveBeenCalled();
  });

  it("só habilita Criar conta quando todos os campos são válidos e as senhas coincidem", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/cadastro?tipo=profissional"]}>
        <AuthPage mode="register" />
      </MemoryRouter>
    );
    const create = screen.getByRole("button", { name: "Criar conta" });
    expect(create.disabled).toBe(true);
    await user.type(screen.getByLabelText("Nome completo"), "Ana Profissional");
    await user.type(screen.getByLabelText("E-mail"), "ana@exemplo.com");
    await user.type(screen.getByLabelText("WhatsApp com DDD"), "(62) 99999-8888");
    await user.type(screen.getByLabelText("Senha"), "senha1234");
    await user.type(screen.getByLabelText("Confirme a senha"), "senha5678");
    expect(create.disabled).toBe(true);
    expect(screen.getByText("As senhas precisam ser iguais.")).not.toBeNull();
    await user.clear(screen.getByLabelText("Confirme a senha"));
    await user.type(screen.getByLabelText("Confirme a senha"), "senha1234");
    expect(create.disabled).toBe(false);
    await user.clear(screen.getByLabelText("E-mail"));
    expect(create.disabled).toBe(true);
    await user.type(screen.getByLabelText("E-mail"), "ana@exemplo.com");
    expect(create.disabled).toBe(false);
  });

  it("CA-AUT-01: envia intenção profissional ao backend sem criar outro tipo de conta", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cadastro?tipo=profissional"]}>
        <AuthPage mode="register" />
      </MemoryRouter>
    );

    await user.type(
      screen.getByLabelText("Nome completo"),
      "Ana Profissional"
    );
    await user.type(
      screen.getByLabelText("E-mail"),
      "ana.profissional@teste.com"
    );
    await user.type(
      screen.getByLabelText("WhatsApp com DDD"),
      "62999998888"
    );
    await user.type(
      screen.getByLabelText("Senha"),
      "senha123"
    );
    await user.type(
      screen.getByLabelText("Confirme a senha"),
      "senha123"
    );
    await user.click(
      screen.getByRole("button", {
        name: "Criar conta"
      })
    );

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith(
        expect.objectContaining({
          email:
            "ana.profissional@teste.com",
          perfil_profissional: true
        })
      );
    });
  });

  it("mantém a preferência de mensagens no cadastro de cliente", () => {
    render(
      <MemoryRouter initialEntries={["/cadastro"]}>
        <AuthPage mode="register" />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/confirmações, lembretes e atualizações dos meus agendamentos/i)
    ).not.toBeNull();
  });
});

describe("compatibilidade de senha no login", () => {
  it("permite autenticar uma conta legada com senha de 6 caracteres", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    const password = screen.getByLabelText("Senha");
    expect(password.getAttribute("minlength")).toBeNull();

    await user.type(screen.getByLabelText("E-mail"), "admin@agendafashion.com.br");
    await user.type(password, "123456");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: "admin@agendafashion.com.br",
        senha: "123456"
      });
    });
  });

  it("mantém o mínimo de 8 caracteres para novas contas", () => {
    render(
      <MemoryRouter>
        <AuthPage mode="register" />
      </MemoryRouter>
    );

    expect(screen.getByLabelText("Senha").getAttribute("minlength")).toBe("8");
    expect(screen.getByLabelText("Confirme a senha").getAttribute("minlength")).toBe("8");
  });
});
it.each([
  [{ authenticated: true, temNegocio: false }, "/criar-negocio", "Criar negócio"],
  [{ authenticated: true, temNegocio: true, negocio: { papel: "dono" } }, "/painel", "Painel"],
  [{ authenticated: true, temNegocio: false, temReservasProfissionaisRestritas: true }, "/reservas-existentes", "Reservas existentes"]
])("preserva a intenção profissional no login por e-mail: %s", async (result, path, heading) => {
  login.mockResolvedValue(result);
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={["/entrar?tipo=profissional"]}>
    <Routes><Route path="/entrar" element={<AuthPage />} />
      <Route path={path} element={<h1>{heading}</h1>} /></Routes>
  </MemoryRouter>);
  await user.type(screen.getByLabelText("E-mail"), "ana@teste.com");
  await user.type(screen.getByLabelText("Senha"), "senha123");
  await user.click(screen.getByRole("button", { name: "Entrar", exact: true }));
  expect(await screen.findByRole("heading", { name: heading })).not.toBeNull();
});

it("preserva intenção profissional no login Google sem exigir outra conta", async () => {
  loginWithGoogle.mockResolvedValue({ authenticated: true, temNegocio: false, contaCriada: false });
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={["/entrar?tipo=profissional"]}>
    <Routes><Route path="/entrar" element={<AuthPage />} />
      <Route path="/criar-negocio" element={<h1>Criar negócio</h1>} /></Routes>
  </MemoryRouter>);
  await user.click(screen.getByRole("button", { name: "Entrar com Google", exact: true }));
  expect(await screen.findByRole("heading", { name: "Criar negócio" })).not.toBeNull();
  expect(register).not.toHaveBeenCalled();
});
