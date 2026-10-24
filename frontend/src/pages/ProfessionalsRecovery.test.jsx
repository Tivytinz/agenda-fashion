// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { ProfessionalsPage } from "./ProfessionalsPage";
vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
vi.mock("../auth/SessionContext", () => ({ useSession: () => ({ usuario: { id: 1 } }) }));
const team = (ativo = false, motivo = "inativado_pela_dona") => ({ profissionais: [
  { id: 1, nome: "Dona", papel: "dono", ativo: true },
  { id: 9, nome: "Ana", papel: "profissional", ativo, motivo_inatividade: ativo ? null : motivo },
] });
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const mount = (strict = false) => render(strict
  ? <StrictMode><MemoryRouter><ProfessionalsPage /></MemoryRouter></StrictMode>
  : <MemoryRouter><ProfessionalsPage /></MemoryRouter>);
const card = (nome = "Ana") => screen.getByRole("heading", { name: nome, exact: true }).closest("article");
beforeEach(() => {
  apiRequest.mockReset();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(cleanup);

describe("consistência das alterações da equipe", () => {
  it.each(["sucesso", "erro"])("descarta %s da leitura inicial substituída mesmo se o transporte ignora abort", async (outcome) => {
    const old = deferred();
    apiRequest.mockReturnValueOnce(old.promise).mockResolvedValueOnce(team(true));
    mount(true);
    await screen.findByRole("heading", { name: "Ana" });
    expect(apiRequest.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => outcome === "sucesso" ? old.resolve(team()) : old.reject(new Error("Erro antigo")));
    expect(within(card()).queryByRole("button", { name: "Ativar profissional" })).toBeNull();
    expect(screen.queryByText("Erro antigo")).toBeNull();
  });

  it("preserva ativação confirmada com GET falho e recupera só a leitura", async () => {
    apiRequest.mockResolvedValueOnce(team()).mockResolvedValueOnce({
      mensagem: "Ativada.", profissional_id: 9, ativo: true,
    }).mockRejectedValueOnce(new Error("Leitura falhou")).mockResolvedValueOnce(team(true));
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Ativar profissional" }));
    await screen.findByText(/Alteração salva/);
    expect(within(card()).queryByRole("button", { name: "Ativar profissional" })).toBeNull();
    expect(within(card()).getByRole("button", { name: "Inativar profissional" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Atualizar equipe" }));
    await waitFor(() => expect(within(card()).getByRole("button", { name: "Inativar profissional" }).disabled).toBe(false));
    expect(apiRequest.mock.calls.filter(([, o]) => o?.method === "POST")).toHaveLength(1);
    expect(apiRequest.mock.calls.filter(([p]) => p === "/profissionais")).toHaveLength(3);
  });

  it("serializa as alterações até terminar a reconciliação e invalida a consulta auxiliar antiga", async () => {
    const plan = deferred(), write = deferred(), read = deferred();
    let reads = 0;
    apiRequest.mockImplementation((path, options) => {
      if (path === "/minha-assinatura") return plan.promise;
      if (options?.method === "POST") return write.promise;
      if (path === "/profissionais") return ++reads === 1 ? Promise.resolve(team(false, "aguardando_vaga_plano")) : read.promise;
      throw new Error(path);
    });
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Ativar profissional" }));
    expect(apiRequest.mock.calls.find(([p]) => p === "/minha-assinatura")[1].signal.aborted).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Ativando..." }));
    expect(apiRequest.mock.calls.filter(([, o]) => o?.method === "POST")).toHaveLength(1);
    await act(async () => write.resolve({ profissional_id: 9, ativo: true }));
    expect(within(card()).getByRole("button", { name: "Inativar profissional" }).disabled).toBe(true);
    await act(async () => plan.resolve({ upgrade_contextual: { disponivel: true } }));
    await act(async () => read.resolve(team(true)));
    expect(within(card()).getByRole("button", { name: "Inativar profissional" }).disabled).toBe(false);
    expect(screen.queryByText(/aguarda uma vaga/)).toBeNull();
  });

  it("não inicia reconciliação se a escrita termina após sair da tela", async () => {
    const write = deferred();
    apiRequest.mockResolvedValueOnce(team()).mockReturnValueOnce(write.promise);
    const { unmount } = mount();
    fireEvent.click(await screen.findByRole("button", { name: "Ativar profissional" }));
    unmount();
    await act(async () => write.resolve({ profissional_id: 9, ativo: true }));
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });
});

describe("inativação manual", () => {
  it("pede confirmação, protege a dona e preserva o estado confirmado se a atualização falha", async () => {
    apiRequest.mockResolvedValueOnce(team(true)).mockResolvedValueOnce({
      mensagem: "Profissional inativada.", profissional_id: 9, ativo: false,
      motivo_inatividade: "inativado_pela_dona",
    }).mockRejectedValueOnce(new Error("Leitura falhou")).mockResolvedValueOnce(team());
    mount();
    await screen.findByRole("heading", { name: "Ana" });
    expect(within(card("Dona")).queryByRole("button", { name: "Inativar profissional" })).toBeNull();
    fireEvent.click(within(card()).getByRole("button", { name: "Inativar profissional" }));
    expect(screen.getByRole("dialog", { name: "Inativar profissional?" }).textContent).toContain("Cancelamentos e reagendamentos ficam com você");
    expect(apiRequest).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Sim, inativar" }));
    await screen.findByText(/Alteração salva/);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Inativa por escolha da dona")).not.toBeNull();
    expect(screen.queryByRole("heading", { name: /aguarda uma vaga no plano/ })).toBeNull();
    expect(within(card()).queryByRole("button", { name: "Configurar serviços" })).toBeNull();
    expect(within(card()).getByRole("button", { name: "Ativar profissional" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Atualizar equipe" }));
    await waitFor(() => expect(within(card()).getByRole("button", { name: "Ativar profissional" }).disabled).toBe(false));
    expect(apiRequest.mock.calls.filter(([, o]) => o?.method === "POST")).toEqual([
      ["/profissionais/9/inativar", { method: "POST" }],
    ]);
  });

  it("resultado incerto fecha o diálogo e exige GET antes de repetir", async () => {
    apiRequest.mockResolvedValueOnce(team(true)).mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(team());
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Inativar profissional" }));
    fireEvent.click(screen.getByRole("button", { name: "Sim, inativar" }));
    await screen.findByText(/Não foi possível confirmar/);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(within(card()).getByRole("button", { name: "Inativar profissional" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Atualizar equipe" }));
    await screen.findByText("Inativa por escolha da dona");
    expect(apiRequest.mock.calls.filter(([, o]) => o?.method === "POST")).toHaveLength(1);
  });

  it("rejeição de validação mantém a confirmação e permite corrigir", async () => {
    apiRequest.mockResolvedValueOnce(team(true)).mockRejectedValueOnce(Object.assign(new Error("Sem permissão."), { status: 403 }));
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Inativar profissional" }));
    fireEvent.click(screen.getByRole("button", { name: "Sim, inativar" }));
    await screen.findByText("Sem permissão.");
    expect(screen.getByRole("dialog").contains(screen.getByRole("alert"))).toBe(true);
    expect(screen.getByRole("button", { name: "Sim, inativar" }).disabled).toBe(false);
    expect(screen.queryByRole("button", { name: "Atualizar equipe" })).toBeNull();
  });
});
