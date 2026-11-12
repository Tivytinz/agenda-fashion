// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { BusinessPage } from "./BusinessPage";

const refreshSession = vi.fn();

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

vi.mock("../auth/SessionContext", () => ({
  useSession: () => ({
    usuario: {
      id: 7,
      nome: "Ana",
      whatsapp: "62999999999"
    },
    refresh: refreshSession
  })
}));

beforeEach(() => {
  sessionStorage.clear();
  apiRequest.mockReset();
  refreshSession.mockReset();
});

afterEach(cleanup);

describe("criação do negócio", () => {
  it.each([
    ["/criar-negocio", "/"],
    ["/criar-negocio?plano=autonoma", "/planos"]
  ])("preserva a saída contextual em %s", (path, exitTo) => {
    render(<MemoryRouter initialEntries={[path]}><BusinessPage create /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Sair", exact: true }).getAttribute("href")).toBe(exitTo);
  });

  it("recupera rascunho da mesma conta após remount, sem localStorage", async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={["/criar-negocio"]}><BusinessPage create /></MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText("Nome do negócio"), {
      target: { value: "Studio retomado" }
    });
    await waitFor(() => expect(sessionStorage.getItem("af_business_creation_draft_v1"))
      .toContain("Studio retomado"));
    unmount();
    render(<MemoryRouter initialEntries={["/criar-negocio"]}><BusinessPage create /></MemoryRouter>);
    expect(screen.getByLabelText("Nome do negócio").value).toBe("Studio retomado");
  });

  it("seleciona fuso ambíguo e oferece link de busca a partir do endereço", async () => {
    render(<MemoryRouter initialEntries={["/criar-negocio"]}><BusinessPage create /></MemoryRouter>);
    fireEvent.change(screen.getByRole("combobox", { name: "Estado" }), {
      target: { value: "AM" }
    });
    const zone = await screen.findByRole("combobox", { name: /Fuso horário do atendimento/ });
    expect(zone.required).toBe(true);
    fireEvent.change(zone, { target: { value: "America/Eirunepe" } });
    expect(zone.value).toBe("America/Eirunepe");
    for (const [label, value] of [
      ["Endereço", "Rua do Rio"], ["Número", "10"], ["Bairro", "Centro"], ["Cidade", "Manaus"]
    ]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: /Gerar link de busca/ }));
    expect(screen.getByLabelText(/Link da localização/).value)
      .toContain("www.google.com/maps/search/");
  });

  it("reaproveita o WhatsApp da conta e deixa descrição, foto e complemento opcionais", () => {
    render(
      <MemoryRouter initialEntries={["/criar-negocio"]}>
        <BusinessPage create />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Seu negócio" })).not.toBeNull();
    expect(screen.queryByText(/Negócio completo desde o início/i)).toBeNull();
    expect(screen.getByLabelText("Etapa 2 de 4: Negócio")).not.toBeNull();

    const requiredFields = [
      /Nome do negócio/,
      /WhatsApp/,
      /Link da localização/,
      /CEP/,
      /Endereço/,
      /Número/,
      /Bairro/,
      /Cidade/
    ];

    for (const label of requiredFields) {
      expect(screen.getByLabelText(label).required).toBe(true);
    }

    expect(screen.getByLabelText(/Descrição \(opcional\)/).required)
      .toBe(false);
    expect(screen.getByLabelText(/Complemento/).required).toBe(false);
    expect(screen.getByRole("combobox", { name: "Estado" }).required).toBe(true);

    const whatsapp = screen.getByLabelText(/WhatsApp/);
    expect(whatsapp.value).toBe("(62) 99999-9999");
    expect(screen.queryByText(/Trouxemos o número da sua conta/i)).toBeNull();
    expect(screen.queryByText(/Sem complemento/i)).toBeNull();
    expect(screen.queryByLabelText(/Adicionar foto/i)).toBeNull();
  });

  it("CA-NEG-02: exibe a rejeição do backend ao tentar criar segundo negócio operacional", async () => {
    apiRequest.mockImplementation(
      (path) => {
        if (path === "/cep/74000123") {
          return Promise.resolve({
            cep: "74000123",
            endereco: "Rua das Flores",
            bairro: "Centro",
            cidade: "Goiânia",
            estado: "GO"
          });
        }

        if (path === "/criar-negocio") {
          return Promise.reject(
            Object.assign(new Error(
              "Esta conta já possui um negócio."
            ), { status: 409 })
          );
        }

        return Promise.reject(
          new Error(
            `Rota inesperada: ${path}`
          )
        );
      }
    );

    render(
      <MemoryRouter initialEntries={["/criar-negocio"]}>
        <BusinessPage create />
      </MemoryRouter>
    );

    fireEvent.change(
      screen.getByLabelText(/Nome do negócio/),
      {
        target: { value: "Studio Aurora" }
      }
    );
    fireEvent.click(
      screen.getByLabelText("Unhas")
    );
    fireEvent.change(
      screen.getByLabelText(
        /Link da localização/
      ),
      {
        target: {
          value:
            "https://maps.google.com/?q=goiania"
        }
      }
    );
    fireEvent.change(
      screen.getByLabelText(/CEP/),
      {
        target: { value: "74000-123" }
      }
    );
    fireEvent.change(
      screen.getByLabelText("Endereço"),
      {
        target: { value: "Rua das Flores" }
      }
    );
    fireEvent.change(
      screen.getByLabelText("Número"),
      {
        target: { value: "10" }
      }
    );
    fireEvent.change(
      screen.getByLabelText("Bairro"),
      {
        target: { value: "Centro" }
      }
    );
    fireEvent.change(
      screen.getByLabelText("Cidade"),
      {
        target: { value: "Goiânia" }
      }
    );
    fireEvent.change(
      screen.getByRole(
        "combobox",
        { name: "Estado" }
      ),
      {
        target: { value: "GO" }
      }
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Criar negócio" }).disabled).toBe(false);
    });

    fireEvent.submit(
      screen
        .getByRole(
          "button",
          { name: "Criar negócio" }
        )
        .closest("form")
    );

    expect(
      (
        await screen.findByRole("alert")
      ).textContent
    ).toContain(
      "Esta conta já possui um negócio."
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/criar-negocio",
        expect.objectContaining({
          method: "POST"
        })
      );
    });
  });

  it("não envia a criação quando faltar uma informação obrigatória", () => {
    render(
      <MemoryRouter initialEntries={["/criar-negocio"]}>
        <BusinessPage create />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Nome do negócio/), {
      target: { value: "Studio Aurora" }
    });
    fireEvent.click(screen.getByLabelText("Unhas"));
    fireEvent.submit(screen.getByRole("button", { name: "Criar negócio" }).closest("form"));

    expect(screen.getByRole("alert").textContent)
      .toContain("Campo pendente: Cidade");
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
