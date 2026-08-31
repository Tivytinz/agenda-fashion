// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceCard } from "./ServiceCard";

vi.mock("../hooks/useRetryingMedia", () => ({
  useRetryingMedia: () => ({
    handleError: vi.fn(),
    hasImage: false,
    imageUrl: ""
  })
}));

const BASE_SERVICE = {
  id: 12,
  nome: "Manicure",
  categoria: "unha",
  valor: 45,
  duracao_minutos: 50,
  negocio_nome: "Studio Aurora",
  negocio_slug: "studio-aurora",
  negocio_cidade: "Goiânia",
  negocio_estado: "GO"
};

function renderCard(overrides = {}) {
  return render(
    <MemoryRouter>
      <ServiceCard service={{ ...BASE_SERVICE, ...overrides }} />
    </MemoryRouter>
  );
}

afterEach(cleanup);

describe("ServiceCard", () => {
  it("oferece horários somente quando o backend confirma a agenda online", () => {
    renderCard({ agendamento_online_disponivel: true });

    expect(screen.getByRole("link", { name: "Ver horários" })
      .getAttribute("href")).toBe("/negocio/studio-aurora?servico=12");
    expect(screen.queryByText("Agenda online em configuração")).toBeNull();
  });

  it("mantém o perfil acessível sem prometer horários quando a agenda não foi confirmada", () => {
    renderCard({ agendamento_online_disponivel: false });

    expect(screen.getByRole("link", { name: "Ver perfil" })
      .getAttribute("href")).toBe("/negocio/studio-aurora");
    expect(screen.getByText("Agenda online em configuração")).not.toBeNull();
    expect(screen.queryByRole("link", { name: "Ver horários" })).toBeNull();
  });

  it("trata payload legado sem o sinal como não confirmado", () => {
    renderCard();

    expect(screen.getByRole("link", { name: "Ver perfil" })
      .getAttribute("href")).toBe("/negocio/studio-aurora");
    expect(screen.queryByRole("link", { name: "Ver horários" })).toBeNull();
  });
});
