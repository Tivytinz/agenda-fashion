// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { PasswordResetPage } from "./PasswordResetPage";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));

beforeEach(() => apiRequest.mockReset());
afterEach(cleanup);

describe("recuperação de senha", () => {
  it("solicita o link sem revelar se a conta existe", async () => {
    const user = userEvent.setup();
    apiRequest.mockResolvedValue({
      mensagem: "Se o e-mail estiver cadastrado, você receberá um link.",
    });

    render(
      <MemoryRouter initialEntries={["/esqueci-senha"]}>
        <PasswordResetPage />
      </MemoryRouter>
    );

    await user.type(screen.getByRole("textbox", { name: "E-mail da conta" }), "ANA@EXAMPLE.COM");
    await user.click(screen.getByRole("button", { name: "Enviar link de recuperação" }));

    expect(apiRequest).toHaveBeenCalledWith("/auth/esqueci-senha", {
      method: "POST",
      body: { email: "ana@example.com" },
    });
    expect(await screen.findByRole("status")).not.toBeNull();
  });

  it("não envia quando as senhas são diferentes", async () => {
    const user = userEvent.setup();
    const token = "A".repeat(43);

    render(
      <MemoryRouter initialEntries={[`/redefinir-senha?token=${token}`]}>
        <PasswordResetPage mode="reset" />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText("Nova senha"), "senha-segura");
    await user.type(screen.getByLabelText("Confirme a nova senha"), "senha-diferente");
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(screen.getByRole("alert").textContent).toMatch(/precisam ser iguais/i);
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("conclui a redefinição e oferece retorno ao login", async () => {
    const user = userEvent.setup();
    const token = "B".repeat(43);
    apiRequest.mockResolvedValue({
      mensagem: "Senha alterada com sucesso. Entre com sua nova senha.",
    });

    render(
      <MemoryRouter initialEntries={[`/redefinir-senha?token=${token}`]}>
        <PasswordResetPage mode="reset" />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText("Nova senha"), "senha-segura");
    await user.type(screen.getByLabelText("Confirme a nova senha"), "senha-segura");
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(apiRequest).toHaveBeenCalledWith("/auth/redefinir-senha", {
      method: "POST",
      body: { token, senha: "senha-segura" },
    });
    expect(await screen.findByRole("link", { name: "Entrar com a nova senha" }))
      .not.toBeNull();
  });
});
