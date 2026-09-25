// @vitest-environment jsdom

import {
  afterEach,
  describe,
  expect,
  it
} from "vitest";
import {
  clearStoredSessionMetadata,
  saveSession
} from "./session";

afterEach(() => {
  localStorage.clear();
});

describe("persistência mínima da sessão", () => {
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
