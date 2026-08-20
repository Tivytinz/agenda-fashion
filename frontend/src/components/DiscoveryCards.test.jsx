// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { BusinessCard } from "./BusinessCard";
import { ServiceCard } from "./ServiceCard";

afterEach(cleanup);

describe("imagens dos cards do catálogo", () => {
  it("procura a capa em todos os serviços do negócio", () => {
    render(
      <MemoryRouter>
        <BusinessCard business={{
          id: 1,
          nome: "Studio Aurora",
          slug: "studio-aurora",
          descricao: "Atendimento acolhedor para realçar sua beleza.",
          servicos: [
            { id: 1, nome: "Primeiro", valor: 20 },
            { id: 2, nome: "Segundo", valor: 30 },
            {
              id: 3,
              nome: "Terceiro",
              valor: 40,
              foto_url: "/uploads/terceiro.jpg"
            }
          ]
        }} />
      </MemoryRouter>
    );

    expect(document.querySelector(".business-card img")?.src)
      .toContain("/uploads/terceiro.jpg");
    expect(screen.getByText("Atendimento acolhedor para realçar sua beleza."))
      .not.toBeNull();
    expect(screen.queryByText("Primeiro")).toBeNull();
    expect(screen.queryByText("R$ 20,00")).toBeNull();
    expect(screen.queryByText("3 serviços")).toBeNull();
  });

  it("volta a tentar quando a URL do mesmo card muda", async () => {
    const service = {
      id: 10,
      nome: "Design com henna",
      negocio_nome: "Studio Aurora",
      negocio_slug: "studio-aurora",
      foto_url: "/uploads/indisponivel.jpg",
      valor: 55
    };

    const view = render(
      <MemoryRouter>
        <ServiceCard service={service} />
      </MemoryRouter>
    );

    fireEvent.error(screen.getByRole("img"));
    fireEvent.error(screen.getByRole("img"));

    expect(screen.queryByRole("img")).toBeNull();

    view.rerender(
      <MemoryRouter>
        <ServiceCard service={{
          ...service,
          foto_url: "/uploads/nova.jpg"
        }} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("img").src)
        .toContain("/uploads/nova.jpg");
    });
  });

  it("mostra a categoria do serviço sem repetir a especialidade do negócio", () => {
    render(
      <MemoryRouter>
        <ServiceCard service={{
          id: 12,
          nome: "Limpeza de pele",
          categoria: "estetica",
          negocio_nome: "Studio Aurora",
          negocio_slug: "studio-aurora",
          negocio_setor: "Sobrancelhas",
          valor: 80,
          duracao_minutos: 50
        }} />
      </MemoryRouter>
    );

    expect(screen.getAllByText("Estética").length).toBeGreaterThan(0);
    expect(screen.queryByText("Sobrancelhas")).toBeNull();
  });

  it("usa o emoji da categoria quando o serviço não possui foto", () => {
    render(
      <MemoryRouter>
        <ServiceCard service={{
          id: 14,
          nome: "Drenagem linfática",
          categoria: "estetica",
          negocio_nome: "Studio Aurora",
          negocio_slug: "studio-aurora",
          valor: 130,
          duracao_minutos: 90
        }} />
      </MemoryRouter>
    );

    expect(document.querySelector(".service-discovery-placeholder strong")
      ?.textContent).toBe("💆");
    expect(document.querySelector(".service-discovery-placeholder")
      ?.textContent).not.toContain("D");
  });

  it("identifica negócio, localização, duração e valor com emojis", () => {
    const { container } = render(
      <MemoryRouter>
        <ServiceCard service={{
          id: 13,
          nome: "Design + Henna",
          categoria: "sobrancelhas",
          negocio_nome: "Beauty Vanessa",
          negocio_slug: "beauty-vanessa",
          negocio_bairro: "Araguaia",
          negocio_cidade: "Aparecida de Goiânia",
          negocio_estado: "GO",
          valor: 40,
          duracao_minutos: 60
        }} />
      </MemoryRouter>
    );

    expect(container.textContent).toContain("🏢Beauty Vanessa");
    expect(container.textContent).toContain("📍Araguaia");
    expect(container.textContent).toContain("🕒60 min");
    expect(container.textContent.replace(/\u00a0/g, " "))
      .toContain("💰R$ 40,00");
  });
});
