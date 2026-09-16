import {
  PROFILE_ORIGIN,
  buildProfilePath,
  mergeProfileSearchParams,
  normalizeProfileOrigin,
  resolveDiscoveryProfileOrigin,
  resolveProfileOrigin
} from "./profileOrigin";
import {
  describe,
  expect,
  it
} from "vitest";

describe("origem do perfil público", () => {
  it("normaliza apenas origens conhecidas", () => {
    expect(normalizeProfileOrigin(" FAVORITOS ")).toBe("favoritos");
    expect(normalizeProfileOrigin("desconhecida")).toBe("nao_informada");
  });

  it("prioriza a origem explícita da navegação interna", () => {
    expect(resolveProfileOrigin(
      "origem=meus_agendamentos&af_source=agenda_fashion&af_medium=share"
    )).toBe(PROFILE_ORIGIN.APPOINTMENTS);
  });

  it.each(["share", "copy", "qr", "whatsapp"])(
    "reconhece %s do AF como compartilhamento",
    (medium) => {
      expect(resolveProfileOrigin(
        `af_source=agenda_fashion&af_medium=${medium}`
      )).toBe(PROFILE_ORIGIN.SHARE);
    }
  );

  it("não inventa compartilhamento sem evidência do AF", () => {
    expect(resolveProfileOrigin(
      "af_source=externo&af_medium=share"
    )).toBe("nao_informada");
    expect(resolveProfileOrigin(
      "af_source=agenda_fashion&af_medium=outro"
    )).toBe("nao_informada");
  });

  it("distingue descoberta inicial de busca sem atribuir outras rotas", () => {
    expect(resolveDiscoveryProfileOrigin("/", ""))
      .toBe(PROFILE_ORIGIN.HOME);
    expect(resolveDiscoveryProfileOrigin("/", "?busca=manicure"))
      .toBe(PROFILE_ORIGIN.SEARCH);
    expect(resolveDiscoveryProfileOrigin(
      "/servicos/unha/em/goiania-go",
      ""
    )).toBe(PROFILE_ORIGIN.SEARCH);
    expect(resolveDiscoveryProfileOrigin("/favoritos", ""))
      .toBe("nao_informada");
  });

  it("monta rota de perfil com serviço e origem sem confiar em texto livre", () => {
    expect(buildProfilePath({
      slug: "studio aurora",
      serviceId: 12,
      origin: PROFILE_ORIGIN.SEARCH
    })).toBe(
      "/negocio/studio%20aurora?servico=12&origem=busca"
    );

    expect(buildProfilePath({
      slug: "studio-aurora",
      origin: "inventada"
    })).toBe("/negocio/studio-aurora");
  });

  it("preserva rastreio ao mudar serviço e profissional", () => {
    const current = new URLSearchParams(
      "servico=11&profissional=21&origem=compartilhamento&af_source=agenda_fashion&af_medium=share"
    );

    const next = mergeProfileSearchParams(current, {
      servico: 12,
      profissional: null
    });

    expect(next.get("servico")).toBe("12");
    expect(next.has("profissional")).toBe(false);
    expect(next.get("origem")).toBe("compartilhamento");
    expect(next.get("af_source")).toBe("agenda_fashion");
    expect(next.get("af_medium")).toBe("share");
  });
});
