// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { track } from "../analytics/track";
import { PublicShareButton } from "./PublicShareButton";

vi.mock(
  "../analytics/track",
  () => ({
    track: vi.fn()
  })
);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe(
  "compartilhamento público",
  () => {
    it(
      "copia link de serviço com origem própria do AF",
      async () => {
        const writeText =
          vi.fn().mockResolvedValue();

        Object.defineProperty(
          navigator,
          "clipboard",
          {
            configurable: true,
            value: {
              writeText
            }
          }
        );

        render(
          <PublicShareButton
            ariaLabel="Copiar link de Limpeza de pele"
            businessId={7}
            businessName="Studio Aurora"
            businessSlug="studio-aurora"
            label="Copiar link"
            mode="copy"
            origin="https://app.agendafashion.com.br"
            serviceId={12}
            serviceName="Limpeza de pele"
          />
        );

        await userEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Copiar link de Limpeza de pele"
            }
          )
        );

        expect(
          writeText
        ).toHaveBeenCalledWith(
          "https://app.agendafashion.com.br/negocio/studio-aurora?servico=12&af_source=agenda_fashion&af_medium=copy&af_content=servico"
        );

        expect(
          screen.getByText(
            "Link copiado"
          )
        ).not.toBeNull();

        expect(
          track
        ).toHaveBeenCalledWith(
          "link_servico_copiado",
          expect.objectContaining({
            businessId: 7,
            mission:
              "descobrir_compartilhar_agendar",
            properties:
              expect.objectContaining({
                af_source:
                  "agenda_fashion",
                af_medium:
                  "copy",
                af_content:
                  "servico",
                tipo_link:
                  "servico",
                metodo:
                  "area_transferencia"
              })
          })
        );
      }
    );

    it(
      "abre compartilhamento nativo com link rastreável do AF",
      async () => {
        const share =
          vi.fn().mockResolvedValue();

        Object.defineProperty(
          navigator,
          "share",
          {
            configurable: true,
            value: share
          }
        );

        render(
          <PublicShareButton
            businessId={7}
            businessName="Studio Aurora"
            businessSlug="studio-aurora"
            origin="https://app.agendafashion.com.br"
          />
        );

        await userEvent.click(
          screen.getByRole(
            "button",
            {
              name: "Compartilhar"
            }
          )
        );

        expect(
          share
        ).toHaveBeenCalledWith({
          title:
            "Studio Aurora | Agenda Fashion",
          text:
            "Veja os serviços de Studio Aurora e escolha seu horário no Agenda Fashion.",
          url:
            "https://app.agendafashion.com.br/negocio/studio-aurora?af_source=agenda_fashion&af_medium=share&af_content=negocio"
        });

        expect(
          track
        ).toHaveBeenCalledWith(
          "link_negocio_compartilhado",
          expect.objectContaining({
            businessId: 7,
            mission:
              "descobrir_compartilhar_agendar",
            properties:
              expect.objectContaining({
                af_source:
                  "agenda_fashion",
                af_medium:
                  "share",
                af_content:
                  "negocio",
                tipo_link:
                  "negocio",
                metodo:
                  "compartilhamento_nativo"
              })
          })
        );
      }
    );
  }
);
