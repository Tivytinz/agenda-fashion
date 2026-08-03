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
});
