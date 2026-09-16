// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BusinessCard } from "./BusinessCard";
import { ServiceCard } from "./ServiceCard";

vi.mock("../hooks/useRetryingMedia", () => ({
  useRetryingMedia: () => ({
    handleError: vi.fn(),
    hasImage: false,
    imageUrl: ""
  })
}));

afterEach(cleanup);

const business = {
  id: 1,
  nome: "Studio Aurora",
  slug: "studio-aurora",
  servicos: [{ id: 9, nome: "Manicure" }]
};

const service = {
  id: 9,
  nome: "Manicure",
  negocio_slug: "studio-aurora",
  negocio_nome: "Studio Aurora",
  negocio_cidade: "Goiânia",
  negocio_estado: "GO",
  categoria: "unha",
  valor: 50,
  duracao_minutos: 60,
  agendamento_online_disponivel: true
};

describe("links de entrada do perfil público", () => {
  it("marca a home como origem do card de negócio", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <BusinessCard business={business} />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("link", { name: "Ver perfil de Studio Aurora" })
        .getAttribute("href")
    ).toBe("/negocio/studio-aurora?origem=inicio");
  });

  it("marca uma busca textual da home como busca", () => {
    render(
      <MemoryRouter initialEntries={["/?busca=manicure"]}>
        <BusinessCard business={business} />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("link", { name: "Ver perfil de Studio Aurora" })
        .getAttribute("href")
    ).toBe("/negocio/studio-aurora?origem=busca");
  });

  it("marca o catálogo local como busca e preserva o serviço escolhido", () => {
    render(
      <MemoryRouter initialEntries={["/servicos/unha/em/goiania-go"]}>
        <ServiceCard service={service} />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("link", { name: "Ver horários para Manicure" })
        .getAttribute("href")
    ).toBe("/negocio/studio-aurora?servico=9&origem=busca");
  });
});
