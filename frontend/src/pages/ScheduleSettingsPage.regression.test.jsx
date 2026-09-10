// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { ScheduleSettingsPage } from "./ScheduleSettingsPage";

vi.mock("../analytics/track", () => ({ track: vi.fn() }));
vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));

function validWeek() {
  return Array.from({ length: 7 }, (_, diaSemana) => ({
    dia_semana: diaSemana,
    trabalha: diaSemana > 0,
    hora_inicio: diaSemana > 0 ? "08:00" : null,
    hora_fim: diaSemana > 0 ? "18:00" : null,
    intervalo_inicio: diaSemana > 0 ? "12:00" : null,
    intervalo_fim: diaSemana > 0 ? "13:00" : null
  }));
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ScheduleSettingsPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  apiRequest.mockReset();
});

afterEach(cleanup);

describe("regressões da configuração de horários", () => {
  it("mantém a estrutura responsiva do editor sem repetir cabeçalhos por linha", async () => {
    apiRequest.mockResolvedValueOnce({
      configuracao: { configurado_em: null },
      horarios: [{
        dia_semana: 1,
        trabalha: true,
        hora_inicio: "08:00",
        hora_fim: "18:00",
        intervalo_inicio: null,
        intervalo_fim: null
      }]
    });

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Ajustar horários" }));

    expect(screen.getByText("Dia")).not.toBeNull();
    expect(screen.getAllByText("Atendimento")).toHaveLength(2);
    expect(screen.getAllByText("Pausa")).toHaveLength(2);
  });

  it("não oferece compartilhamento quando o backend informa pendência após ajuste manual", async () => {
    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/agenda-configuracao" && !options.method) {
        return Promise.resolve({
          configuracao: { configurado_em: null },
          horarios: validWeek()
        });
      }
      if (path === "/agenda-configuracao" && options.method === "PUT") {
        return Promise.resolve({
          mensagem: "Horários de atendimento confirmados com sucesso.",
          configuracao: { configurado_em: "2026-09-10T05:00:00.000Z" },
          horarios: validWeek(),
          publicacao: { publicado: false, pode_publicar: false }
        });
      }
      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Ajustar horários" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar horários e continuar" }));

    expect(await screen.findByText("Horários de atendimento confirmados com sucesso."))
      .not.toBeNull();
    expect(screen.queryByRole("heading", { name: "Agora divulgue seu perfil" }))
      .toBeNull();
    expect(apiRequest.mock.calls.some(([path]) => path === "/configuracoes"))
      .toBe(false);
  });

  it("mantém a agenda salva mesmo se o contexto de compartilhamento falhar", async () => {
    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/agenda-configuracao" && !options.method) {
        return Promise.resolve({
          configuracao: { configurado_em: null },
          horarios: validWeek()
        });
      }
      if (path === "/agenda-configuracao" && options.method === "PUT") {
        return Promise.resolve({
          mensagem: "Horários salvos.",
          configuracao: { configurado_em: "2026-09-10T05:00:00.000Z" },
          horarios: validWeek(),
          publicacao: { publicado: true, pode_publicar: true }
        });
      }
      if (path === "/configuracoes") {
        return Promise.reject(new Error("perfil indisponível"));
      }
      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Ajustar horários" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar horários e continuar" }));

    expect(await screen.findByRole("heading", { name: "Agora divulgue seu perfil" }))
      .not.toBeNull();
    expect(await screen.findByRole("link", { name: "Ir para o painel" }))
      .not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/agenda-configuracao",
        expect.objectContaining({ method: "PUT" })
      );
    });
  });
});
