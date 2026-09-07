// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { track } from "../analytics/track";
import { DashboardNextAction } from "./DashboardNextAction";

vi.mock("../analytics/track", () => ({
  track: vi.fn(),
}));

afterEach(() => {
  cleanup();
  track.mockReset();
});

describe("DashboardNextAction concluído", () => {
  it("trata ATIVADO como marco secundário e não como próximo passo", () => {
    render(
      <MemoryRouter>
        <DashboardNextAction
          activation={{
            possui_servico_ativo: true,
            agenda_configurada: true,
            negocio_publicado: true,
            primeiro_agendamento_recebido: true,
          }}
          businessId={11}
          businessName="Studio Aurora"
          businessSlug="studio-aurora"
          nextAction={{
            estado: "ATIVADO",
            concluido: true,
            titulo: "Ativação concluída",
            mensagem:
              "Seu negócio já recebeu o primeiro agendamento pelo Agenda Fashion.",
            acao: {
              tipo: "NAVEGAR",
              rotulo: "Abrir agenda",
              destino: "/painel/agenda",
            },
          }}
        />
      </MemoryRouter>
    );

    expect(
      screen.getByLabelText("Negócio ativado")
    ).not.toBeNull();
    expect(
      screen.getByRole("heading", {
        name: "Ativação concluída",
      })
    ).not.toBeNull();
    expect(
      screen.queryByText("Próximo passo")
    ).toBeNull();
    expect(
      screen.queryByLabelText("Progresso da ativação")
    ).toBeNull();
    expect(
      screen.getByRole("link", {
        name: "Abrir agenda",
      }).getAttribute("href")
    ).toBe("/painel/agenda");
    expect(track).not.toHaveBeenCalledWith(
      "proxima_acao_ativacao_visualizada",
      expect.anything()
    );
  });
});
