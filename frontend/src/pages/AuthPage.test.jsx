// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { safeReturnPath, WHATSAPP_PATTERN } from "./AuthPage";

const login = vi.fn();

vi.mock("../auth/SessionContext", () => ({
  useSession: () => ({
    authenticated: false,
    loading: false,
    temNegocio: false,
    ehAdministrador: false,
    login,
    register: vi.fn(),
    loginWithGoogle: vi.fn()
  })
}));

vi.mock("../components/GoogleLoginButton", () => ({
  GoogleLoginButton: () => null
}));

const { AuthPage } = await import("./AuthPage");

beforeEach(() => {
  login.mockReset();
  login.mockResolvedValue({
    authenticated: true,
    temNegocio: false,
    ehAdministrador: true
  });
});

afterEach(cleanup);

describe("retorno após autenticação", () => {
  it("aceita somente caminhos internos", () => {
    expect(safeReturnPath("/minha-agenda?filtro=hoje")).toBe("/minha-agenda?filtro=hoje");
    expect(safeReturnPath("//site-malicioso.test")).toBe("");
    expect(safeReturnPath("https://site-malicioso.test")).toBe("");
    expect(safeReturnPath(null)).toBe("");
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

describe("cadastro profissional enxuto", () => {
  it("deixa consentimentos de WhatsApp para o momento contextual no painel", () => {
    render(
      <MemoryRouter initialEntries={["/cadastro?tipo=profissional"]}>
        <AuthPage mode="register" />
      </MemoryRouter>
    );

    expect(screen.getByText(/Depois da conta, você cria o negócio/i)).not.toBeNull();
    expect(screen.getByText(/Avisos do WhatsApp são opcionais/i)).not.toBeNull();
    expect(screen.queryByText(/avisos operacionais do Agenda Fashion/i)).toBeNull();
    expect(screen.queryByText(/orientações de marketing do Agenda Fashion/i)).toBeNull();
    expect(screen.queryByText(/confirmações, lembretes e atualizações dos meus agendamentos/i)).toBeNull();
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