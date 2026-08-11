// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage
} from "./browserStorage";

describe("browserStorage", () => {
  it("usa memória quando o navegador bloqueia o storage", () => {
    const unavailableStorage = {
      getItem: vi.fn(() => {
        throw new DOMException("Storage bloqueado", "SecurityError");
      }),
      setItem: vi.fn(() => {
        throw new DOMException("Storage bloqueado", "SecurityError");
      }),
      removeItem: vi.fn(() => {
        throw new DOMException("Storage bloqueado", "SecurityError");
      })
    };

    vi.stubGlobal("sessionStorage", unavailableStorage);

    expect(writeBrowserStorage("session", "af_test_blocked", "valor"))
      .toBe(false);
    expect(readBrowserStorage("session", "af_test_blocked"))
      .toBe("valor");

    removeBrowserStorage("session", "af_test_blocked");
    expect(readBrowserStorage("session", "af_test_blocked"))
      .toBeNull();

    vi.unstubAllGlobals();
  });

  it("usa memória quando a gravação falha e a leitura nativa retorna vazio", () => {
    const readOnlyStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new DOMException("Quota indisponível", "QuotaExceededError");
      }),
      removeItem: vi.fn()
    };

    vi.stubGlobal("localStorage", readOnlyStorage);

    expect(writeBrowserStorage("local", "af_test_read_only", "sessao"))
      .toBe(false);
    expect(readBrowserStorage("local", "af_test_read_only"))
      .toBe("sessao");

    removeBrowserStorage("local", "af_test_read_only");
    expect(readBrowserStorage("local", "af_test_read_only"))
      .toBeNull();

    vi.unstubAllGlobals();
  });
});
