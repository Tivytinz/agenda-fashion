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
      "cria o marcador local sem depender de JWT no corpo da resposta",
      () => {
        saveSession({
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
      "remove JWT legado ao salvar uma nova sessão por cookie",
      () => {
        localStorage.setItem(
          "token",
          "jwt-antigo"
        );

        saveSession({
          usuario: {
            id: 2,
            nome: "Bia",
          },
        });

        expect(
          localStorage.getItem(
            "token"
          )
        ).toBeNull();

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
