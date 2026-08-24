// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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
    Object.defineProperty(document, "referrer", {
      configurable: true,
      value: "",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
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
      last_utm_source: "facebook",
      last_utm_campaign: "goiania_cilios",
      last_landing_page: "/negocio/studio",
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
      last_utm_source: "facebook",
      last_utm_campaign: "goiania_cilios",
      status: "sucesso",
    });
  });

  test("captura sinais Google modernos mesmo sem GCLID", () => {
    window.history.replaceState(
      {},
      "",
      "/cadastro?tipo=profissional&gbraid=braid-google-123&wbraid=wbraid-google-456"
    );

    const contexto = getMarketingContext("profissional");

    expect(contexto).toMatchObject({
      gbraid: "braid-google-123",
      wbraid: "wbraid-google-456",
      last_gbraid: "braid-google-123",
      last_wbraid: "wbraid-google-456",
      landing_page: "/cadastro",
    });
  });

  test("guarda apenas o domínio externo de referência, sem URL ou busca", () => {
    Object.defineProperty(document, "referrer", {
      configurable: true,
      value: "https://www.google.com/search?q=manicure+perto+de+mim&client=test",
    });
    window.history.replaceState({}, "", "/negocio/studio");

    track("agendamento_concluido", {
      page: "finalizar_agendamento",
      mission: "confirmar_agendamento",
      businessId: 12,
      properties: {
        agendamento_id: 987654,
        status: "sucesso",
      },
    });

    const payload = JSON.parse(fetch.mock.calls[0][1].body);

    expect(payload.propriedades.referrer_host).toBe("www.google.com");
    expect(JSON.stringify(payload.propriedades)).not.toContain("/search");
    expect(JSON.stringify(payload.propriedades)).not.toContain("manicure+perto+de+mim");
  });

  test("não cria referência externa para navegação interna ou acesso direto", () => {
    Object.defineProperty(document, "referrer", {
      configurable: true,
      value: `${window.location.origin}/explorar`,
    });
    window.history.replaceState({}, "", "/negocio/studio");

    track("tela_visualizada", {
      page: "perfil_negocio",
      mission: "entrar_no_negocio",
      businessId: 12,
    });

    const payload = JSON.parse(fetch.mock.calls[0][1].body);
    expect(payload.propriedades).not.toHaveProperty("referrer_host");
  });

  test("mantém first touch e atualiza last touch em uma nova campanha", () => {
    window.history.replaceState(
      {},
      "",
      "/cadastro?utm_source=meta&utm_medium=cpc&utm_campaign=primeira&utm_content=video_01"
    );

    getMarketingContext("profissional");

    sessionStorage.clear();
    window.history.replaceState(
      {},
      "",
      "/planos?utm_source=google&utm_medium=cpc&utm_campaign=retargeting&gclid=click456"
    );

    const contexto = getMarketingContext("profissional");

    expect(contexto).toMatchObject({
      utm_source: "meta",
      utm_medium: "cpc",
      utm_campaign: "primeira",
      utm_content: "video_01",
      landing_page: "/cadastro",
      last_utm_source: "google",
      last_utm_medium: "cpc",
      last_utm_campaign: "retargeting",
      last_gclid: "click456",
      last_landing_page: "/planos",
    });
  });

  test("sobrevive a uma nova sessão do navegador dentro da janela de 30 dias", () => {
    window.history.replaceState(
      {},
      "",
      "/cadastro?utm_source=pinterest&utm_medium=cpc&utm_campaign=manicure_agosto"
    );

    getMarketingContext("profissional");
    sessionStorage.clear();
    window.history.replaceState({}, "", "/criar-negocio");

    expect(getMarketingContext("profissional")).toMatchObject({
      utm_source: "pinterest",
      utm_medium: "cpc",
      utm_campaign: "manicure_agosto",
      landing_page: "/cadastro",
    });
  });

  test("expira a atribuição depois de 30 dias sem novo toque", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));

    window.history.replaceState(
      {},
      "",
      "/cadastro?utm_source=meta&utm_medium=cpc&utm_campaign=agosto"
    );

    getMarketingContext("profissional");

    vi.setSystemTime(new Date("2026-09-01T12:00:01.000Z"));
    sessionStorage.clear();
    window.history.replaceState({}, "", "/criar-negocio");

    const contexto = getMarketingContext("profissional");

    expect(contexto).not.toHaveProperty("utm_source");
    expect(contexto).not.toHaveProperty("utm_campaign");
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
      last_utm_source: "meta",
      last_utm_campaign: "profissionais_goiania",
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
      },
      removeItem: () => {
        throw new DOMException("Storage bloqueado", "SecurityError");
      }
    };

    vi.stubGlobal("sessionStorage", unavailableStorage);
    vi.stubGlobal("localStorage", unavailableStorage);

    expect(() => track("tela_visualizada", {
      page: "inicio",
      mission: "descobrir_servico"
    })).not.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
