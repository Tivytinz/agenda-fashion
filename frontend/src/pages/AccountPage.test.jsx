// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { useSession } from "../auth/SessionContext";
import { AccountPage } from "./AccountPage";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
vi.mock("../auth/SessionContext", () => ({ useSession: vi.fn() }));

const refreshSession = vi.fn();
const logoutSession = vi.fn();

function baseUser(overrides = {}) {
  return {
    id: 7,
    nome: "Victor Souza",
    email: "victor@example.com",
    whatsapp: "62999998888",
    aceita_lembretes_whatsapp: false,
    aceita_notificacoes_whatsapp: false,
    ...overrides
  };
}

beforeEach(() => {
  apiRequest.mockReset();
  refreshSession.mockReset();
  logoutSession.mockReset();
  refreshSession.mockResolvedValue({});
  useSession.mockReturnValue({
    temNegocio: false,
    ehAdministrador: false,
    negocio: null,
    refresh: refreshSession,
    logout: logoutSession
  });
});

afterEach(cleanup);

describe("minha conta", () => {
  it("usa inicial maiúscula e exibe uma ação clara para sair", async () => {
    apiRequest.mockResolvedValueOnce({
      usuario: baseUser({ nome: "admin admin", email: "admin@example.com" })
    });

    const { container } = render(<MemoryRouter><AccountPage /></MemoryRouter>);

    await screen.findByRole("heading", { name: "Minha conta" });
    expect(container.querySelector(".account-avatar .af-media-fallback")?.textContent).toBe("A");

    fireEvent.click(screen.getByRole("button", { name: "Sair da conta" }));
    expect(logoutSession).toHaveBeenCalledTimes(1);
  });

  it("só habilita salvar perfil após alteração e envia WhatsApp sem máscara", async () => {
    apiRequest
      .mockResolvedValueOnce({ usuario: baseUser() })
      .mockResolvedValueOnce({
        mensagem: "Perfil atualizado.",
        usuario: baseUser({ whatsapp: "11987654321" })
      });

    render(<MemoryRouter><AccountPage /></MemoryRouter>);

    const whatsapp = await screen.findByLabelText("WhatsApp");
    const saveProfile = screen.getByRole("button", { name: "Salvar perfil" });
    expect(whatsapp.value).toBe("(62) 99999-8888");
    expect(whatsapp.getAttribute("placeholder")).toBe("(00) 12345-6789");
    expect(saveProfile.disabled).toBe(true);

    fireEvent.change(whatsapp, { target: { value: "11 98765-4321" } });
    expect(saveProfile.disabled).toBe(false);
    fireEvent.click(saveProfile);

    await waitFor(() => {
      expect(apiRequest).toHaveBeenLastCalledWith("/conta", {
        method: "PUT",
        body: {
          nome: "Victor Souza",
          whatsapp: "11987654321"
        }
      });
    });

    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar perfil" }).disabled).toBe(true));
  });

  it("deixa o e-mail claramente somente leitura", async () => {
    apiRequest.mockResolvedValueOnce({ usuario: baseUser() });

    render(<MemoryRouter><AccountPage /></MemoryRouter>);

    const email = await screen.findByDisplayValue("victor@example.com");
    expect(email.readOnly).toBe(true);
    expect(screen.getByText("E-mail da conta. Não pode ser alterado aqui.")).not.toBeNull();
  });

  it("não repete o link de voltar quando a navegação lateral já existe", async () => {
    useSession.mockReturnValue({
      temNegocio: true,
      ehAdministrador: true,
      negocio: { papel: "dono" },
      refresh: refreshSession,
      logout: vi.fn()
    });
    apiRequest.mockResolvedValueOnce({
      usuario: baseUser({ id: 9, nome: "Admin AF", email: "admin@example.com" })
    });

    const { container } = render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Minha conta" });
    expect(screen.queryByRole("link", { name: /Voltar à administração/ })).toBeNull();
    expect(
      container.querySelector("main")
        ?.classList.contains("workspace-page")
    ).toBe(true);
  });

  it("mantém o link de voltar para uma conta fora da área de trabalho", async () => {
    apiRequest.mockResolvedValueOnce({ usuario: baseUser() });

    render(<MemoryRouter><AccountPage /></MemoryRouter>);

    const backLink = await screen.findByRole("link", { name: /Voltar ao início/ });
    expect(backLink.getAttribute("href")).toBe("/");
  });

  it("valida a nova senha e permite mostrar ou ocultar os campos", async () => {
    apiRequest
      .mockResolvedValueOnce({ usuario: baseUser() })
      .mockResolvedValueOnce({ mensagem: "Senha atualizada." });

    render(<MemoryRouter><AccountPage /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Minha conta" });

    const currentPassword = screen.getByLabelText(/^Senha atual/);
    const newPassword = screen.getByLabelText(/^Nova senha/);
    const confirmation = screen.getByLabelText(/^Confirme a nova senha/);
    const submit = screen.getByRole("button", { name: "Alterar senha" });

    expect(submit.disabled).toBe(true);
    fireEvent.change(currentPassword, { target: { value: "senha-atual" } });
    fireEvent.change(newPassword, { target: { value: "12345678" } });
    fireEvent.change(confirmation, { target: { value: "87654321" } });
    expect(screen.getByText("As senhas não coincidem.")).not.toBeNull();
    expect(submit.disabled).toBe(true);

    fireEvent.change(confirmation, { target: { value: "12345678" } });
    expect(screen.getByText("As senhas coincidem.")).not.toBeNull();
    expect(submit.disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Mostrar nova senha" }));
    expect(newPassword.type).toBe("text");
    fireEvent.click(screen.getByRole("button", { name: "Ocultar nova senha" }));
    expect(newPassword.type).toBe("password");

    fireEvent.click(submit);
    await waitFor(() => {
      expect(apiRequest).toHaveBeenLastCalledWith("/conta/senha", {
        method: "PUT",
        body: { senhaAtual: "senha-atual", novaSenha: "12345678" }
      });
    });
  });

  it("permite ao dono alterar os lembretes do negócio sem texto de onboarding antigo", async () => {
    useSession.mockReturnValue({
      temNegocio: true,
      ehAdministrador: false,
      negocio: { papel: "dono" },
      refresh: refreshSession,
      logout: vi.fn()
    });

    apiRequest
      .mockResolvedValueOnce({ usuario: baseUser() })
      .mockResolvedValueOnce({
        mensagem: "Lembretes diários do WhatsApp ativados.",
        preferencia: {
          aceita_lembretes_whatsapp: true
        }
      });

    render(<MemoryRouter><AccountPage /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Lembretes do negócio no WhatsApp" })).not.toBeNull();
    expect(screen.queryByText(/cadastrar seu primeiro serviço/i)).toBeNull();

    const checkbox = screen.getByRole("checkbox", {
      name: /Receber lembretes do negócio no WhatsApp/i
    });
    const savePreference = screen.getByRole("button", { name: "Salvar preferência" });

    expect(savePreference.disabled).toBe(true);
    fireEvent.click(checkbox);
    expect(savePreference.disabled).toBe(false);
    fireEvent.click(savePreference);

    await waitFor(() => {
      expect(apiRequest).toHaveBeenLastCalledWith(
        "/conta/preferencias-whatsapp",
        {
          method: "PUT",
          body: {
            aceitaLembretes: true
          }
        }
      );
    });

    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar preferência" }).disabled).toBe(true));
  });

  it("permite alterar mensagens dos agendamentos apenas quando a preferência muda", async () => {
    apiRequest
      .mockResolvedValueOnce({
        usuario: baseUser({ aceita_notificacoes_whatsapp: true })
      })
      .mockResolvedValueOnce({
        mensagem: "Mensagens dos agendamentos pelo WhatsApp desativadas.",
        preferencia: {
          aceita_notificacoes_whatsapp: false
        }
      });

    render(<MemoryRouter><AccountPage /></MemoryRouter>);

    const checkbox = await screen.findByRole("checkbox", {
      name: /Receber mensagens dos meus agendamentos no WhatsApp/i
    });
    const saveAuthorization = screen.getByRole("button", { name: "Salvar autorização" });

    expect(checkbox.checked).toBe(true);
    expect(saveAuthorization.disabled).toBe(true);
    fireEvent.click(checkbox);
    expect(saveAuthorization.disabled).toBe(false);
    fireEvent.click(saveAuthorization);

    await waitFor(() => {
      expect(apiRequest).toHaveBeenLastCalledWith(
        "/conta/notificacoes-whatsapp",
        {
          method: "PUT",
          body: {
            aceitaNotificacoes: false
          }
        }
      );
    });

    expect(refreshSession).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar autorização" }).disabled).toBe(true));
  });
});
