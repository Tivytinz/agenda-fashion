// @vitest-environment jsdom

import {
  afterEach,
  describe,
  expect,
  it
} from "vitest";
import {
  clearSession,
  hasSession,
  saveSession
} from "./session";

afterEach(() => {
  clearSession();
  localStorage.clear();
});

describe(
  "armazenamento seguro da sessão",
  () => {
    it(
      "não persiste o JWT recebido pelo navegador",
      () => {
        saveSession({
          token: "jwt-sensivel",
          usuario: {
            id: 1,
            nome: "Ana",
          },
        });

        expect(
          localStorage.getItem(
            "token"
          )
        ).toBeNull();

        expect(
          localStorage.getItem(
            "session_active"
          )
        ).toBe("1");

        expect(
          hasSession()
        ).toBe(true);
      }
    );

    it(
      "continua reconhecendo token legado durante a migração",
      () => {
        localStorage.setItem(
          "token",
          "token-legado"
        );

        expect(
          hasSession()
        ).toBe(true);
      }
    );
  }
);
