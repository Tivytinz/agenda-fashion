// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { DashboardNextAction } from "./DashboardNextAction";

vi.mock(
  "./PublicShareButton",
  () => ({
    PublicShareButton: ({
      label,
      trackingMission,
      trackingPage,
    }) => (
      <button
        data-mission={trackingMission}
        data-page={trackingPage}
        type="button"
      >
        {label}
      </button>
    ),
  })
);

afterEach(cleanup);

function renderAction({
  activation,
  publication,
  profileVisits = 0,
} = {}) {
  return render(
    <MemoryRouter>
      <DashboardNextAction
        activation={activation}
        businessId={12}
        businessName="Studio Aurora"
        businessSlug="studio-aurora"
        publication={publication}
        profileVisits={profileVisits}
      />
    </MemoryRouter>
  );
}

describe(
  "DashboardNextAction",
  () => {
    it(
      "leva para horários quando a agenda ainda não foi confirmada",
      () => {
        renderAction({
          activation: {
            negocio_publicado: true,
            agenda_configurada: false,
            primeiro_agendamento_recebido: false,
          },
        });

        expect(
          screen.getByRole(
            "heading",
            {
              name:
                "Deixe a agenda pronta",
            }
          )
        ).not.toBeNull();
        expect(
          screen.getByRole(
            "link",
            {
              name:
                "Configurar horários",
            }
          ).getAttribute("href")
        ).toBe(
          "/painel/horarios"
        );
      }
    );

    it(
      "leva aos horários quando essa é a única pendência para publicar",
      () => {
        renderAction({
          activation: {
            negocio_publicado: false,
            agenda_configurada: false,
            primeiro_agendamento_recebido: false,
          },
          publication: {
            publicado: false,
            pode_publicar: false,
            pendencias: [
              "confirmar os horários de atendimento",
            ],
          },
        });

        expect(
          screen.getByRole(
            "heading",
            {
              name:
                "Confirme horários para publicar",
            }
          )
        ).not.toBeNull();
        expect(
          screen.getByRole(
            "link",
            {
              name:
                "Configurar horários",
            }
          ).getAttribute("href")
        ).toBe(
          "/painel/horarios"
        );
      }
    );

    it(
      "prioriza divulgação depois da agenda e antes do primeiro agendamento",
      () => {
        renderAction({
          activation: {
            negocio_publicado: true,
            agenda_configurada: true,
            primeiro_agendamento_recebido: false,
          },
        });

        expect(
          screen.getByRole(
            "heading",
            {
              name:
                "Divulgue seu perfil",
            }
          )
        ).not.toBeNull();

        const share =
          screen.getByRole(
            "button",
            {
              name:
                "Compartilhar perfil",
            }
          );

        expect(
          share.getAttribute(
            "data-page"
          )
        ).toBe(
          "dashboard_dono"
        );
        expect(
          share.getAttribute(
            "data-mission"
          )
        ).toBe(
          "gerenciar_crescimento"
        );
        expect(
          screen.getByRole(
            "link",
            {
              name:
                "Ver perfil público",
            }
          ).getAttribute("href")
        ).toBe(
          "/negocio/studio-aurora"
        );
      }
    );

    it(
      "troca divulgação por otimização quando há visitas suficientes sem primeiro agendamento",
      () => {
        renderAction({
          activation: {
            negocio_publicado: true,
            agenda_configurada: true,
            primeiro_agendamento_recebido: false,
          },
          profileVisits: 15,
        });

        expect(
          screen.getByRole(
            "heading",
            {
              name:
                "Transforme visitas em agendamentos",
            }
          )
        ).not.toBeNull();
        expect(
          screen.getByText(
            /15 pessoas visitaram seu perfil/i
          )
        ).not.toBeNull();
      }
    );

    it(
      "usa o primeiro agendamento canônico para avançar à retenção",
      () => {
        renderAction({
          activation: {
            negocio_publicado: true,
            agenda_configurada: true,
            primeiro_agendamento_recebido: true,
          },
          profileVisits: 0,
        });

        expect(
          screen.getByRole(
            "heading",
            {
              name:
                "Mantenha o ritmo",
            }
          )
        ).not.toBeNull();
        expect(
          screen.getByRole(
            "link",
            {
              name:
                "Abrir agenda",
            }
          ).getAttribute("href")
        ).toBe(
          "/painel/agenda"
        );
      }
    );

    it(
      "não oferece divulgação enquanto o negócio não estiver publicado",
      () => {
        renderAction({
          activation: {
            negocio_publicado: false,
            agenda_configurada: true,
            primeiro_agendamento_recebido: false,
          },
        });

        expect(
          screen.getByRole(
            "heading",
            {
              name:
                "Finalize seu perfil para aparecer",
            }
          )
        ).not.toBeNull();
        expect(
          screen.queryByRole(
            "button",
            {
              name:
                "Compartilhar perfil",
            }
          )
        ).toBeNull();
      }
    );
  }
);
