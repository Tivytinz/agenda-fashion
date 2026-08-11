// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from "vitest";
import { getMarketingContext, track } from "./track";

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

  test("expõe contexto seguro para vincular aquisição ao cadastro profissional", () => {
    window.history.replaceState(
      {},
      "",
      "/cadastro?tipo=profissional&utm_source=meta&utm_medium=cpc&utm_campaign=profissionais_goiania&utm_content=video_01&fbclid=click123"
    );

    const contexto = getMarketingContext(
      "profissional"
    );

    expect(contexto).toMatchObject({
      intencao: "profissional",
      sessao_id: "12345678123412341234123456789012",
      utm_source: "meta",
      utm_medium: "cpc",
      utm_campaign: "profissionais_goiania",
      utm_content: "video_01",
      fbclid: "click123",
      landing_page: "/cadastro",
    });

    window.history.replaceState({}, "", "/criar-negocio");

    expect(
      getMarketingContext(
        "profissional"
      )
    ).toMatchObject({
      utm_source: "meta",
      utm_medium: "cpc",
      utm_campaign: "profissionais_goiania",
      landing_page: "/cadastro",
    });
  });

  test("continua funcionando sem randomUUID no navegador", () => {
    vi.stubGlobal("crypto", {});
    sessionStorage.clear();

    expect(() => track("tela_visualizada", {
      page: "inicio",
      mission: "descobrir_servico"
    })).not.toThrow();

    const payload = JSON.parse(fetch.mock.calls[0][1].body);
    expect(payload.sessao_id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  test("analytics não derruba a interface quando o storage é bloqueado", () => {
    const unavailableStorage = {
      getItem: () => {
        throw new DOMException("Storage bloqueado", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("Storage bloqueado", "SecurityError");
      }
    };

    vi.stubGlobal("sessionStorage", unavailableStorage);

    expect(() => track("tela_visualizada", {
      page: "inicio",
      mission: "descobrir_servico"
    })).not.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
