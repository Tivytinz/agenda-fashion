// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./client";
import { SESSION_CLEARED_EVENT } from "../auth/session";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("cliente da API", () => {
  it("limpa e comunica a expiração da sessão ao receber 401", async () => {
    localStorage.setItem("token", "expirado");
    localStorage.setItem("usuario", JSON.stringify({ id: 1 }));
    const listener = vi.fn();
    window.addEventListener(SESSION_CLEARED_EVENT, listener, { once: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ erro: "Sessão expirada." })
    }));

    await expect(apiRequest("/conta")).rejects.toMatchObject({ status: 401 });

    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("usuario")).toBeNull();
    expect(listener).toHaveBeenCalledOnce();
  });
});
