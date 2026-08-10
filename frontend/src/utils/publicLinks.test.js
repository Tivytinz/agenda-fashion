import {
  buildPublicLink
} from "./publicLinks";
import {
  describe,
  expect,
  it
} from "vitest";

describe(
  "links públicos do Agenda Fashion",
  () => {
    it(
      "gera o link público do negócio",
      () => {
        expect(
          buildPublicLink({
            businessSlug:
              "studio-aurora",
            origin:
              "https://app.agendafashion.com.br"
          })
        ).toBe(
          "https://app.agendafashion.com.br/negocio/studio-aurora"
        );
      }
    );

    it(
      "usa o domínio público curto quando a origem não é informada",
      () => {
        expect(
          buildPublicLink({
            businessSlug:
              "studio-aurora"
          })
        ).toBe(
          "https://app.agendafashion.com.br/negocio/studio-aurora"
        );
      }
    );

    it(
      "remove caminhos e parâmetros acidentais da origem",
      () => {
        expect(
          buildPublicLink({
            businessSlug:
              "studio-aurora",
            origin:
              "https://app.agendafashion.com.br/preview/muito-longo?token=segredo"
          })
        ).toBe(
          "https://app.agendafashion.com.br/negocio/studio-aurora"
        );
      }
    );

    it(
      "gera o link público do serviço",
      () => {
        expect(
          buildPublicLink({
            businessSlug:
              "studio-aurora",
            serviceId: 12,
            origin:
              "https://app.agendafashion.com.br"
          })
        ).toBe(
          "https://app.agendafashion.com.br/negocio/studio-aurora?servico=12"
        );
      }
    );

    it(
      "não cria rota sem slug",
      () => {
        expect(
          buildPublicLink({
            businessSlug: "",
            origin:
              "https://app.agendafashion.com.br"
          })
        ).toBe("");
      }
    );
  }
);
