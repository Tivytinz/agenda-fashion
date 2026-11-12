// @vitest-environment jsdom

import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import {
  clearStoredSessionMetadata,
  clearSession,
  saveSession,
  ANALYTICS_IDENTITY_BOUNDARY_EVENT,
  AUTH_REVISION_STORAGE_KEY
} from "./session";

afterEach(() => {
  localStorage.clear();
});

describe("persistência mínima da sessão", () => {
  it("emite fronteira sem dados pessoais no logout e só na reautenticação já ativa", () => {
    const observed = [];
    const handler = event => observed.push(event);
    window.addEventListener(ANALYTICS_IDENTITY_BOUNDARY_EVENT, handler);
    try {
      saveSession({ usuario: { id: 1 } });
      expect(observed).toHaveLength(0);
      saveSession({ usuario: { id: 2 } });
      expect(observed).toHaveLength(1);
      clearSession();
      expect(observed).toHaveLength(2);
      expect(observed[0].detail).toBeUndefined();
    } finally {
      window.removeEventListener(ANALYTICS_IDENTITY_BOUNDARY_EVENT, handler);
    }
  });

  it("publica a revisão da sessão somente após escrever o marcador local", () => {
    const nativeSetItem = vi.spyOn(Storage.prototype, "setItem");
    try {
      saveSession({ usuario: { id: 1 } });
      const keys = nativeSetItem.mock.calls.map(([key]) => key);
      const markerIndex = keys.indexOf("session_active");
      const revisionIndex = keys.indexOf(AUTH_REVISION_STORAGE_KEY);
      expect(markerIndex).toBeGreaterThanOrEqual(0);
      expect(revisionIndex).toBeGreaterThan(markerIndex);
      expect(localStorage.getItem("session_active")).toBe("1");
      // Reautenticar também deve publicar a revisão com a sessão já persistida.
      nativeSetItem.mockClear();
      saveSession({ usuario: { id: 2 } });
      const updatedKeys = nativeSetItem.mock.calls.map(([key]) => key);
      expect(updatedKeys.indexOf("session_active")).toBeLessThan(
        updatedKeys.indexOf(AUTH_REVISION_STORAGE_KEY)
      );
    } finally {
      nativeSetItem.mockRestore();
    }
  });

  it("guarda apenas o marcador de sessão e remove metadados pessoais legados", () => {
    localStorage.setItem(
      "usuario",
      JSON.stringify({
        id: 1,
        nome: "Ana",
        email: "ana@example.com",
        whatsapp: "62999999999"
      })
    );
    localStorage.setItem(
      "negocio",
      JSON.stringify({
        id: 8,
        nome: "Studio Ana"
      })
    );
    localStorage.setItem(
      "token",
      "jwt-legado"
    );

    saveSession({
      usuario: {
        id: 1,
        nome: "Ana",
        email: "ana@example.com",
        whatsapp: "62999999999"
      }
    });

    expect(
      localStorage.getItem(
        "session_active"
      )
    ).toBe("1");
    expect(
      localStorage.getItem(
        "usuario"
      )
    ).toBeNull();
    expect(
      localStorage.getItem(
        "negocio"
      )
    ).toBeNull();
    expect(
      localStorage.getItem(
        "token"
      )
    ).toBeNull();
  });

  it("limpa chaves de perfil legadas mesmo sem criar uma nova sessão", () => {
    localStorage.setItem(
      "usuario",
      JSON.stringify({
        nome: "Ana"
      })
    );
    localStorage.setItem(
      "negocio",
      JSON.stringify({
        nome: "Studio Ana"
      })
    );

    clearStoredSessionMetadata();

    expect(
      localStorage.getItem(
        "usuario"
      )
    ).toBeNull();
    expect(
      localStorage.getItem(
        "negocio"
      )
    ).toBeNull();
  });
});
