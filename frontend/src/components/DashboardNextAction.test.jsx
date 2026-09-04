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

function renderAction(
  nextAction
) {
  return render(
    <MemoryRouter>
      <DashboardNextAction
        nextAction={nextAction}
        businessId={12}
        businessName="Studio Aurora"
        businessSlug="studio-aurora"
      />
    </MemoryRouter>
  );
}

describe(
  "DashboardNextAction",
  () => {
    it.each([
      [
        "GARANTIR_SERVICO_ATIVO",
        "Ative seus serviços",
        "Gerenciar serviços",
        "/painel/servicos",
      ],
      [
        "CONFIRMAR_AGENDA",
        "Confirme seus horários",
        "Confirmar horários",
        "/painel/horarios",
      ],
      [
        "REVISAR_PUBLICACAO",
        "Revise a publicação",
        "Revisar meu negócio",
        "/painel/negocio",
      ],
      [
        "ATIVADO",
        "Ativação concluída",
        "Abrir agenda",
        "/painel/agenda",
      ],
    ])(
      "renderiza a navegação canônica do estado %s",
      (
        estado,
        titulo,
        rotulo,
        destino
      ) => {
        renderAction({
          estado,
          concluido:
            estado === "ATIVADO",
          titulo,
          mensagem:
            "Mensagem definida pelo backend.",
          acao: {
            tipo: "NAVEGAR",
            rotulo,
            destino,
          },
        });

        expect(
          screen.getByText(
            "Próximo passo"
          )
        ).not.toBeNull();
        expect(
          screen.queryByText(
            /Copilot AF/i
          )
        ).toBeNull();
        expect(
          screen.getByRole(
            "heading",
            { name: titulo }
          )
        ).not.toBeNull();
        expect(
          screen.getByRole(
            "link",
            { name: rotulo }
          ).getAttribute("href")
        ).toBe(destino);
      }
    );

    it(
      "usa o compartilhamento rastreável no estado de primeiro agendamento",
      () => {
        renderAction({
          estado:
            "CONQUISTAR_PRIMEIRO_AGENDAMENTO",
          concluido: false,
          titulo: "Divulgue seu perfil",
          mensagem:
            "Compartilhe o link para conquistar o primeiro agendamento.",
          acao: {
            tipo: "COMPARTILHAR_PERFIL",
            rotulo: "Compartilhar perfil",
          },
        });

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
      "não recalcula ação a partir de métricas do frontend",
      () => {
        renderAction({
          estado:
            "CONQUISTAR_PRIMEIRO_AGENDAMENTO",
          concluido: false,
          titulo: "Divulgue seu perfil",
          mensagem:
            "A decisão já veio pronta do backend.",
          acao: {
            tipo: "COMPARTILHAR_PERFIL",
            rotulo: "Compartilhar perfil",
          },
        });

        expect(
          screen.queryByRole(
            "heading",
            {
              name:
                "Transforme visitas em agendamentos",
            }
          )
        ).toBeNull();
        expect(
          screen.queryByRole(
            "heading",
            {
              name:
                "Mantenha o ritmo",
            }
          )
        ).toBeNull();
      }
    );

    it(
      "impede que um destino não permitido vindo do contrato controle a navegação",
      () => {
        renderAction({
          estado: "DESCONHECIDO",
          concluido: false,
          titulo: "Ação inválida",
          mensagem:
            "Contrato com destino não permitido.",
          acao: {
            tipo: "NAVEGAR",
            rotulo: "Continuar",
            destino: "https://exemplo-malicioso.test",
          },
        });

        expect(
          screen.getByRole(
            "link",
            { name: "Continuar" }
          ).getAttribute("href")
        ).toBe(
          "/painel/negocio"
        );
      }
    );

    it(
      "mantém uma saída segura quando a próxima ação não está disponível",
      () => {
        renderAction(null);

        expect(
          screen.getByRole(
            "heading",
            {
              name:
                "Continue configurando seu negócio",
            }
          )
        ).not.toBeNull();
        expect(
          screen.getByRole(
            "link",
            {
              name:
                "Revisar meu negócio",
            }
          ).getAttribute("href")
        ).toBe(
          "/painel/negocio"
        );
      }
    );
  }
);
