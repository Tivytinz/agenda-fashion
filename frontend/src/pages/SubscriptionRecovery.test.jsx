// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { SubscriptionPage } from "./SubscriptionPage";
vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
const payload = (status = "ACTIVE") => ({
  plano: { id: 2, slug: "autonoma", nome: "Autônoma", valor: 10 },
  assinatura: { id: 20, status, ativo: true, forma_pagamento: "pix", data_proxima_cobranca: "2026-12-23" },
  estado_assinatura: { codigo: status === "ACTIVE" ? "ATIVA" : "CANCELAMENTO_AGENDADO" },
  uso: {}, pagamentos: [],
});
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function mount(strict = false) {
  const page = <MemoryRouter><SubscriptionPage /></MemoryRouter>;
  return render(strict ? <StrictMode>{page}</StrictMode> : page);
}
async function cancel() {
  fireEvent.click(await screen.findByRole("button", { name: "Cancelar renovação" }));
  fireEvent.click(screen.getByRole("button", { name: "Sim, cancelar" }));
}
beforeEach(() => {
  apiRequest.mockReset();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(cleanup);

describe("recuperação da assinatura", () => {
  it.each(["cancelar", "reativar"])("preserva %s confirmado com GET falho e recupera só a leitura", async (kind) => {
    const initial = kind === "cancelar" ? "ACTIVE" : "CANCELED";
    const final = kind === "cancelar" ? "CANCELED" : "ACTIVE";
    apiRequest.mockResolvedValueOnce(payload(initial))
      .mockResolvedValueOnce({ mensagem: "Alteração confirmada.", assinatura: payload(final).assinatura })
      .mockRejectedValueOnce(new Error("GET indisponível"))
      .mockResolvedValueOnce(payload(final));
    mount();
    if (kind === "cancelar") await cancel();
    else fireEvent.click(await screen.findByRole("button", { name: "Reativar renovação" }));
    await screen.findByText(/Alteração salva/);
    const currentAction = kind === "cancelar" ? "Reativar renovação" : "Cancelar renovação";
    const oldAction = kind === "cancelar" ? "Cancelar renovação" : "Reativar renovação";
    expect(screen.queryByRole("button", { name: oldAction })).toBeNull();
    expect(screen.getByRole("button", { name: currentAction }).disabled).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
    if (kind === "cancelar") expect(screen.getByText("Acesso até")).not.toBeNull();
    else expect(screen.queryByText("Renovação cancelada")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Atualizar assinatura" }));
    await waitFor(() => expect(screen.getByRole("button", { name: currentAction }).disabled).toBe(false));
    expect(apiRequest.mock.calls.filter(([, o]) => o?.method)).toHaveLength(1);
  });

  it("serializa clique duplicado e a operação inversa até concluir a reconciliação", async () => {
    const write = deferred(), read = deferred();
    apiRequest.mockResolvedValueOnce(payload("CANCELED")).mockReturnValueOnce(write.promise).mockReturnValueOnce(read.promise);
    mount();
    const button = await screen.findByRole("button", { name: "Reativar renovação" });
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    expect(apiRequest.mock.calls.filter(([, o]) => o?.method)).toHaveLength(1);
    await act(async () => write.resolve({ mensagem: "Reativada.", assinatura: payload().assinatura }));
    const opposite = screen.getByRole("button", { name: "Cancelar renovação" });
    expect(opposite.disabled).toBe(true);
    fireEvent.click(opposite);
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => read.resolve(payload()));
    expect(opposite.disabled).toBe(false);
  });

  it.each(["sucesso", "erro"])("descarta %s da leitura substituída mesmo com transporte que ignora abort", async (outcome) => {
    const old = deferred();
    apiRequest.mockReturnValueOnce(old.promise).mockResolvedValueOnce(payload("CANCELED"));
    mount(true);
    await screen.findByText("Renovação cancelada");
    expect(apiRequest.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => outcome === "sucesso" ? old.resolve(payload()) : old.reject(new Error("Erro obsoleto")));
    expect(screen.queryByRole("button", { name: "Cancelar renovação" })).toBeNull();
    expect(screen.queryByText("Erro obsoleto")).toBeNull();
  });

  it("resultado de cancelamento incerto fecha a confirmação e exige GET antes de repetir", async () => {
    apiRequest.mockResolvedValueOnce(payload()).mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(payload("CANCELED"));
    mount(); await cancel();
    await screen.findByText(/Não foi possível confirmar/);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar renovação" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Atualizar assinatura" }));
    await screen.findByText("Renovação cancelada");
    expect(apiRequest.mock.calls.filter(([, o]) => o?.method)).toHaveLength(1);
  });

  it("conflito de reativação exige consulta antes de liberar outra tentativa", async () => {
    apiRequest.mockResolvedValueOnce(payload("CANCELED"))
      .mockRejectedValueOnce(Object.assign(new Error("Reativação em processamento."), { status: 409 }))
      .mockResolvedValueOnce(payload());
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Reativar renovação" }));
    await screen.findByText(/Reativação em processamento/);
    expect(screen.getByRole("button", { name: "Reativar renovação" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Atualizar assinatura" }));
    await screen.findByRole("button", { name: "Cancelar renovação" });
    expect(apiRequest.mock.calls.filter(([, o]) => o?.method)).toHaveLength(1);
  });

  it("cancelamento obsoleto fecha confirmação e recupera só GET antes de outra ação", async () => {
    apiRequest.mockResolvedValueOnce(payload())
      .mockRejectedValueOnce(Object.assign(new Error("A assinatura mudou durante o cancelamento."), {
        status: 409, data: { codigo: "ASSINATURA_ALTERADA" },
      }))
      .mockResolvedValueOnce(payload());
    mount(); await cancel();
    await screen.findByText(/Atualize a assinatura antes de tentar novamente/);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar renovação" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar renovação" }));
    expect(apiRequest.mock.calls.filter(([, o]) => o?.method)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Atualizar assinatura" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancelar renovação" }).disabled).toBe(false));
    expect(apiRequest.mock.calls.filter(([, o]) => o?.method)).toHaveLength(1);
    expect(apiRequest.mock.calls.filter(([, o]) => !o?.method)).toHaveLength(2);
  });

  it("não inicia GET nem altera a próxima tela quando a escrita termina depois da saída", async () => {
    const write = deferred();
    apiRequest.mockResolvedValueOnce(payload("CANCELED")).mockReturnValueOnce(write.promise);
    const { unmount } = mount();
    fireEvent.click(await screen.findByRole("button", { name: "Reativar renovação" }));
    unmount();
    await act(async () => write.resolve({ assinatura: payload().assinatura }));
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });
});

it("mantém reativação em processamento visível e permite consultar novamente sem outro POST", async () => {
  apiRequest.mockResolvedValueOnce(payload("REACTIVATING")).mockResolvedValueOnce(payload());
  mount();
  expect(await screen.findByText("Reativando renovação")).not.toBeNull();
  expect(screen.queryByRole("button", { name: "Reativar renovação" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Cancelar renovação" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Atualizar assinatura" }));
  await screen.findByRole("button", { name: "Cancelar renovação" });
  expect(apiRequest.mock.calls.filter(([, o]) => o?.method)).toHaveLength(0);
});

it("mantém a consulta de renovação pendente depois de vencer e retornar ao grátis", async () => {
  const pending = { ...payload(), plano: { id: 1, slug: "inicial", nome: "Grátis", valor: 0 },
    assinatura: null, renovacao_pendente: true, estado_assinatura: { codigo: "INATIVA" } };
  apiRequest.mockResolvedValueOnce(pending).mockResolvedValueOnce({ ...pending, renovacao_pendente: false });
  mount();
  expect(await screen.findByText(/Estamos conferindo sua renovação/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Reativar renovação" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Cancelar renovação" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Atualizar assinatura" }));
  await waitFor(() => expect(screen.queryByText(/Estamos conferindo sua renovação/)).toBeNull());
  expect(apiRequest.mock.calls.filter(([, options]) => options?.method)).toHaveLength(0);
});
