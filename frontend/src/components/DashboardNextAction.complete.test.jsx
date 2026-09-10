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
  it("mantém ATIVADO como estado interno sem card persistente", () => {
    const { container } = render(
      <MemoryRouter>
        <DashboardNextAction
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

    expect(container.innerHTML).toBe("");
    expect(
      screen.queryByLabelText("Negócio ativado")
    ).toBeNull();
    expect(
      screen.queryByRole("heading", {
        name: "Ativação concluída",
      })
    ).toBeNull();
    expect(
      screen.queryByText("Próximo passo")
    ).toBeNull();
    expect(
      screen.queryByLabelText("Progresso da ativação")
    ).toBeNull();
    expect(track).not.toHaveBeenCalled();
  });
});
