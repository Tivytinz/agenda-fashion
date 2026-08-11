// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  freshAssetUrl,
  isStaleAssetError,
  markRuntimeReady,
  recoverFromStaleAssets
} from "./runtimeRecovery";

function storage() {
  const values = new Map();

  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

describe("runtimeRecovery", () => {
  it("reconhece erros de arquivos removidos por um deploy", () => {
    expect(isStaleAssetError(new TypeError(
      "Failed to fetch dynamically imported module: /assets/Dashboard-old.js"
    ))).toBe(true);
    expect(isStaleAssetError(new Error("Falha de validação")))
      .toBe(false);
  });

  it("faz uma única recarga com cache busting", () => {
    const location = {
      href: "https://app.agendafashion.com.br/painel?periodo=7#top",
      replace: vi.fn()
    };
    const session = storage();
    const error = new TypeError(
      "Importing a module script failed"
    );

    expect(recoverFromStaleAssets(error, {
      location,
      storage: session,
      now: 1000
    })).toBe(true);
    expect(location.replace).toHaveBeenCalledWith(
      "https://app.agendafashion.com.br/painel?periodo=7&_af_reload=1000#top"
    );

    expect(recoverFromStaleAssets(error, {
      location,
      storage: session,
      now: 2000
    })).toBe(false);
    expect(location.replace).toHaveBeenCalledTimes(1);
  });

  it("remove somente o parâmetro interno após carregar a rota", () => {
    const history = {
      state: { preserved: true },
      replaceState: vi.fn()
    };

    markRuntimeReady({
      history,
      location: {
        href: "https://app.agendafashion.com.br/painel?periodo=7&_af_reload=1000#top"
      },
      storage: storage()
    });

    expect(history.replaceState).toHaveBeenCalledWith(
      { preserved: true },
      "",
      "/painel?periodo=7#top"
    );
    expect(freshAssetUrl("https://app.agendafashion.com.br/", 20))
      .toBe("https://app.agendafashion.com.br/?_af_reload=20");
  });

  it("evita loop mesmo quando o navegador bloqueia sessionStorage", () => {
    const location = {
      href: "https://app.agendafashion.com.br/painel?_af_reload=1000",
      replace: vi.fn()
    };

    expect(recoverFromStaleAssets(
      new Error("ChunkLoadError"),
      {
        location,
        storage: null,
        now: 1500
      }
    )).toBe(false);
    expect(location.replace).not.toHaveBeenCalled();
  });
});
