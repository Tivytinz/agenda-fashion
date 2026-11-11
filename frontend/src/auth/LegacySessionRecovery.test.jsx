// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { SessionProvider } from "./SessionContext";
import { AuthPage } from "../pages/AuthPage";

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it.each(["headers", "body"])("permite repetir o bootstrap após timeout em %s sem perder a sessão legada", async phase => {
  vi.useFakeTimers(); localStorage.setItem("token", "legado");
  let finishOld;
  const pending = new Promise(resolve => { finishOld = resolve; });
  const fetchMock = vi.fn().mockImplementationOnce(() => phase === "headers"
    ? pending : Promise.resolve({ ok: false, status: 503, json: () => pending }));
  vi.stubGlobal("fetch", fetchMock);
  render(<MemoryRouter initialEntries={["/entrar"]}><SessionProvider><Routes>
    <Route path="/entrar" element={<AuthPage />} />
    <Route path="/" element={<h1>Conta recuperada</h1>} />
  </Routes></SessionProvider></MemoryRouter>);
  await act(async () => { await vi.advanceTimersByTimeAsync(20001); });
  expect(screen.getByRole("alert").textContent).toContain("demorou demais");
  expect(screen.queryByText("Carregando sua conta...")).toBeNull();
  expect(localStorage.getItem("token")).toBe("legado");
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);

  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ usuario: { id: 1, nome: "Ana" }, vinculos: [] }) });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" })); });
  expect(screen.getByRole("heading", { name: "Conta recuperada" })).not.toBeNull();
  expect(localStorage.getItem("token")).toBeNull();
  expect(localStorage.getItem("session_active")).toBe("1");
  const requestsAfterRecovery = fetchMock.mock.calls.length;
  await act(async () => { finishOld(phase === "headers" ? { ok: false, status: 401 } : {}); });
  expect(fetchMock).toHaveBeenCalledTimes(requestsAfterRecovery);
  expect(screen.getByRole("heading", { name: "Conta recuperada" })).not.toBeNull();
});
