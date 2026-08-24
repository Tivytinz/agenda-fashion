import {
  PUBLIC_LINK_MEDIA,
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
      "adiciona origem própria somente quando o AF gera um link rastreável",
      () => {
        expect(
          buildPublicLink({
            businessSlug: "studio-aurora",
            serviceId: 12,
            origin: "https://app.agendafashion.com.br",
            acquisition: {
              medium: PUBLIC_LINK_MEDIA.COPY,
              content: "servico"
            }
          })
        ).toBe(
          "https://app.agendafashion.com.br/negocio/studio-aurora?servico=12&af_source=agenda_fashion&af_medium=copy&af_content=servico"
        );
      }
    );

    it.each([
      [PUBLIC_LINK_MEDIA.SHARE, "share"],
      [PUBLIC_LINK_MEDIA.QR, "qr"],
      [PUBLIC_LINK_MEDIA.WHATSAPP, "whatsapp"],
    ])(
      "suporta origem AF %s sem usar UTM de campanha",
      (medium, expected) => {
        const link = buildPublicLink({
          businessSlug: "studio-aurora",
          origin: "https://app.agendafashion.com.br",
          acquisition: {
            medium,
            content: "negocio"
          }
        });

        const url = new URL(link);
        expect(url.searchParams.get("af_source"))
          .toBe("agenda_fashion");
        expect(url.searchParams.get("af_medium"))
          .toBe(expected);
        expect(url.searchParams.get("af_content"))
          .toBe("negocio");
        expect(url.searchParams.has("utm_campaign"))
          .toBe(false);
      }
    );

    it(
      "ignora meio de aquisição não reconhecido",
      () => {
        expect(
          buildPublicLink({
            businessSlug: "studio-aurora",
            origin: "https://app.agendafashion.com.br",
            acquisition: {
              medium: "inventado",
              content: "negocio"
            }
          })
        ).toBe(
          "https://app.agendafashion.com.br/negocio/studio-aurora"
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
