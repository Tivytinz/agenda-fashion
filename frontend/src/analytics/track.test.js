import { beforeEach, describe, expect, test, vi } from "vitest";
import { track } from "./track";

function storage() {
  const values = new Map();

  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
}

describe("track attribution", () => {
  beforeEach(() => {
    vi.stubGlobal("sessionStorage", storage());
    vi.stubGlobal("localStorage", storage());
    vi.stubGlobal("crypto", {
      randomUUID: () => "12345678-1234-1234-1234-123456789012",
    });
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true })));
  });

  test("persiste a campanha da entrada e reaplica nos eventos seguintes", () => {
    window.history.replaceState(
      {},
      "",
      "/negocio/studio?utm_source=facebook&utm_medium=cpc&utm_campaign=goiania_cilios&fbclid=abc123"
    );

    track("tela_visualizada", {
      page: "perfil_negocio",
      mission: "entrar_no_negocio",
      businessId: 12,
    });

    const primeiraChamada = JSON.parse(fetch.mock.calls[0][1].body);

    expect(primeiraChamada.propriedades).toMatchObject({
      utm_source: "facebook",
      utm_medium: "cpc",
      utm_campaign: "goiania_cilios",
      fbclid: "abc123",
      landing_page: "/negocio/studio",
    });

    window.history.replaceState({}, "", "/confirmar");

    track("agendamento_concluido", {
      page: "finalizar_agendamento",
      mission: "confirmar_agendamento",
      businessId: 12,
      properties: {
        status: "sucesso",
      },
    });

    const segundaChamada = JSON.parse(fetch.mock.calls[1][1].body);

    expect(segundaChamada.propriedades).toMatchObject({
      utm_source: "facebook",
      utm_medium: "cpc",
      utm_campaign: "goiania_cilios",
      fbclid: "abc123",
      landing_page: "/negocio/studio",
      status: "sucesso",
    });
  });
});
