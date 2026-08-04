// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { SuccessPage } from "./SuccessPage";

const BOOKING = {
  slug: "studio-aurora",
  business: {
    id: 7,
    nome: "Studio Aurora",
    whatsapp: "62911112222",
    endereco: "Rua das Flores, 10",
    cidade: "Goiânia",
    estado: "GO"
  },
  service: {
    id: 11,
    nome: "Manicure",
    valor: 50,
    duracao_minutos: 60
  },
  professional: { id: 21, nome: "Ana" },
  date: "2026-08-05",
  time: "09:00"
};

function renderSuccess() {
  return render(
    <MemoryRouter initialEntries={[{
      pathname: "/sucesso",
      state: {
        booking: BOOKING,
        customer: {
          name: "Victor Souza",
          whatsapp: "62999998888"
        }
      }
    }]}>
      <Routes>
        <Route path="/sucesso" element={<SuccessPage />} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(cleanup);

describe("confirmação concluída", () => {
  it("exibe contato formatado, endereço e ações úteis", () => {
    renderSuccess();

    expect(screen.getByText("(62) 99999-8888")).not.toBeNull();
    expect(screen.getByText(/Rua das Flores, 10/)).not.toBeNull();

    const calendar = screen.getByRole("link", {
      name: "Adicionar ao calendário"
    });
    expect(calendar.getAttribute("href")).toContain(
      "calendar.google.com/calendar/render"
    );
    expect(calendar.getAttribute("href")).toContain(
      "20260805T090000%2F20260805T100000"
    );

    expect(screen.getByRole("link", {
      name: "Falar com o negócio"
    }).getAttribute("href")).toBe("https://wa.me/5562911112222");

    expect(screen.getByRole("img", {
      name: "Símbolo do Agenda Fashion completo"
    })).not.toBeNull();
    expect(document.querySelectorAll(".success-brand-mark .active"))
      .toHaveLength(6);
  });
});
