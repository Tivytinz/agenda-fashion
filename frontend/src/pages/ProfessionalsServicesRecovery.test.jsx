// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { ProfessionalsPage } from "./ProfessionalsPage";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
vi.mock("../auth/SessionContext", () => ({ useSession: () => ({ usuario: { id: 1 } }) }));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((success, failure) => { resolve = success; reject = failure; });
  return { promise, resolve, reject };
}
const services = (id, enabled = true) => ({
  profissional_id: id,
  servicos: [{ id: 11, nome: "Manicure", ativo: true, habilitado: enabled }]
});
function mockRequests(read, write = () => Promise.resolve({ mensagem: "Salvo" })) {
  apiRequest.mockImplementation((path, options = {}) => {
    if (path === "/profissionais") return Promise.resolve({ profissionais: [
      { id: 9, nome: "Ana", ativo: true }, { id: 10, nome: "Bia", ativo: true }
    ] });
    if (options.method === "PUT") return write(path, options);
    // Simulate a transport that ignores cancellation: identity guards must also hold.
    return read(path, options);
  });
}
async function open(name) {
  const card = (await screen.findByRole("heading", { name, exact: true })).closest("article");
  fireEvent.click(within(card).getByRole("button", { name: "Configurar serviços" }));
}
function close(method = "botão") {
  if (method === "Escape") {
    fireEvent(screen.getByRole("dialog", { name: /O que .* atende/ }), new Event("cancel", { bubbles: true, cancelable: true }));
  } else fireEvent.click(screen.getByRole("button", { name: "Fechar", exact: true }));
}
function mount() { return render(<MemoryRouter><ProfessionalsPage /></MemoryRouter>); }

beforeEach(() => {
  apiRequest.mockReset();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(cleanup);

describe("isolamento do editor de serviços da equipe", () => {
  it.each([
    ["sucesso", "botão"], ["erro", "botão"], ["sucesso", "Escape"], ["erro", "Escape"]
  ])("ignora %s de Ana após fechar por %s e abrir Bia", async (outcome, method) => {
    const ana = deferred();
    mockRequests(path => path.includes("/9/") ? ana.promise : Promise.resolve(services(10)));
    mount();
    await open("Ana");
    const oldRead = apiRequest.mock.calls.find(([p]) => p === "/profissionais/9/servicos")[1];
    close(method);
    expect(oldRead.signal.aborted).toBe(true);
    await open("Bia");
    const checkbox = await screen.findByRole("checkbox", { name: /Manicure/ });
    await act(async () => outcome === "sucesso" ? ana.resolve(services(9, false)) : ana.reject(new Error("Erro antigo")));
    expect(checkbox.checked).toBe(true);
    expect(screen.queryByText("Erro antigo")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Salvar serviços", exact: true }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/profissionais/10/servicos", {
      method: "PUT", body: { servico_ids: [11] }
    }));
  });

  it("a conclusão antiga não libera o salvamento enquanto a nova pessoa carrega", async () => {
    const ana = deferred();
    const bia = deferred();
    mockRequests(path => path.includes("/9/") ? ana.promise : bia.promise);
    mount();
    await open("Ana");
    close();
    await open("Bia");
    await act(async () => ana.resolve(services(9, false)));
    expect(screen.getByText("Carregando serviços...")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Salvar serviços" }).disabled).toBe(true);
    expect(screen.queryByRole("checkbox")).toBeNull();
    await act(async () => bia.resolve(services(10)));
    expect((await screen.findByRole("checkbox")).checked).toBe(true);
  });

  it("reabrir a mesma pessoa usa uma nova leitura e ignora a anterior", async () => {
    const oldRead = deferred();
    let count = 0;
    mockRequests(() => ++count === 1 ? oldRead.promise : Promise.resolve(services(9)));
    mount();
    await open("Ana");
    close();
    await open("Ana");
    const checkbox = await screen.findByRole("checkbox");
    await act(async () => oldRead.resolve(services(9, false)));
    expect(checkbox.checked).toBe(true);
  });

  it("permite nova tentativa após falha e libera a próxima edição após sucesso", async () => {
    let writes = 0;
    mockRequests(() => Promise.resolve(services(9)), () => ++writes === 1
      ? Promise.reject(new Error("Falha ao salvar")) : Promise.resolve({ mensagem: "Salvo" }));
    mount();
    await open("Ana");
    await screen.findByRole("checkbox");
    fireEvent.click(screen.getByRole("button", { name: "Salvar serviços" }));
    await screen.findByText("Falha ao salvar");
    const retry = screen.getByRole("button", { name: "Salvar serviços" });
    expect(retry.disabled).toBe(false);
    fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await open("Ana");
    await screen.findByRole("checkbox");
    expect(screen.getByRole("button", { name: "Salvar serviços" }).disabled).toBe(false);
    expect(writes).toBe(2);
  });

  it("cancela a leitura ao sair da página", async () => {
    const read = deferred();
    mockRequests(() => read.promise);
    const view = mount();
    await open("Ana");
    const options = apiRequest.mock.calls.find(([p]) => p === "/profissionais/9/servicos")[1];
    view.unmount();
    expect(options.signal.aborted).toBe(true);
    await act(async () => read.resolve(services(9)));
    expect(apiRequest.mock.calls.some(([, o]) => o?.method === "PUT")).toBe(false);
  });
});
