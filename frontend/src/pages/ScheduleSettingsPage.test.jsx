// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { track } from "../analytics/track";
import { apiRequest } from "../api/client";
import {
  ScheduleSettingsPage,
  summarizeSchedule,
  validateSchedule
} from "./ScheduleSettingsPage";

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

function defaultSuggestedWeek() {
  return [
    {
      dia_semana: 0,
      trabalha: false,
      hora_inicio: null,
      hora_fim: null,
      intervalo_inicio: null,
      intervalo_fim: null
    },
    ...Array.from({ length: 5 }, (_, index) => ({
      dia_semana: index + 1,
      trabalha: true,
      hora_inicio: "08:00",
      hora_fim: "18:00",
      intervalo_inicio: "12:00",
      intervalo_fim: "13:00"
    })),
    {
      dia_semana: 6,
      trabalha: true,
      hora_inicio: "08:00",
      hora_fim: "13:00",
      intervalo_inicio: null,
      intervalo_fim: null
    }
  ];
}

function activationBusiness() {
  return {
    negocio_id: 11,
    papel: "dono",
    nome: "Studio Aurora",
    slug: "studio-aurora"
  };
}

function Destination() {
  const location = useLocation();
  return (
    <>
      <h1>Destino do onboarding</h1>
      <output data-testid="destination">{location.pathname}{location.search}</output>
    </>
  );
}

function OwnerScheduleRoute() {
  const navigate = useNavigate();

  return (
    <>
      <button
        onClick={() => navigate("/painel/horarios")}
        type="button"
      >
        Abrir editor de horários
      </button>
      <ScheduleSettingsPage />
    </>
  );
}

function renderPage(entry = "/painel/horarios") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/painel/horarios" element={<OwnerScheduleRoute />} />
        <Route path="/profissional/horarios" element={<ScheduleSettingsPage />} />
        <Route path="/profissional/agenda" element={<Destination />} />
        <Route path="/painel" element={<Destination />} />
        <Route path="/checkout" element={<Destination />} />
      </Routes>
    </MemoryRouter>
  );
}

async function openFirstScheduleEditor() {
  fireEvent.click(await screen.findByRole("button", { name: "Ajustar horários" }));
}

function mockFirstConfiguration() {
  apiRequest.mockImplementation((path, options = {}) => {
    if (path === "/agenda-configuracao" && !options.method) {
      return Promise.resolve({
        configuracao: {
          duracao_padrao: 60,
          intervalo_minutos: 0,
          antecedencia_agendamento: 0,
          antecedencia_cancelamento: 2,
          configurado_em: "2026-09-10T04:00:00.000Z",
          origem_horarios: "padrao_af"
        },
        horarios: defaultSuggestedWeek()
      });
    }

    if (path === "/agenda-configuracao" && options.method === "PUT") {
      return Promise.resolve({
        mensagem: "Horários salvos.",
        configuracao: {
          configurado_em: "2026-09-10T05:00:00.000Z"
        },
        horarios: defaultSuggestedWeek(),
        publicacao: null
      });
    }

    if (path === "/dashboard-dono/ativacao") {
      return Promise.resolve({
        negocio: activationBusiness(),
        proxima_acao_ativacao: {
          estado: "CONQUISTAR_PRIMEIRO_AGENDAMENTO",
          concluido: false
        }
      });
    }

    return Promise.reject(new Error(`Rota inesperada: ${path}`));
  });
}

beforeEach(() => {
  apiRequest.mockReset();
  track.mockReset();
  apiRequest.mockResolvedValue({
    configuracao: {},
    horarios: [{
      dia_semana: 1,
      trabalha: true,
      hora_inicio: "18:00",
      hora_fim: "08:00"
    }]
  });
});

afterEach(cleanup);

describe("configuração de horários", () => {
  it("mostra a sugestão antes do editor com confirmar e ajustar", async () => {
    mockFirstConfiguration();
    renderPage();

    expect(await screen.findByRole("heading", {
      name: "Confirme quando você atende"
    })).not.toBeNull();
    expect(screen.getByText(/Agenda Fashion preparou horários sugeridos/i)).not.toBeNull();
    expect(screen.getByText("Seg, Ter, Qua, Qui, Sex")).not.toBeNull();
    expect(screen.getByText("Sáb")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Confirmar horários" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Pular por agora" })).toBeNull();
    expect(screen.getByRole("button", { name: "Ajustar horários" })).not.toBeNull();
    expect(screen.getByText(/Ao confirmar, estes horários sugeridos serão salvos/i)).not.toBeNull();
    expect(screen.queryByText("Ajustes avançados")).toBeNull();

    await waitFor(() => {
      expect(track).toHaveBeenCalledWith(
        "agenda_configuracao_visualizada",
        expect.objectContaining({
          page: "configuracao_agenda",
          mission: "disponibilizar_horarios",
          properties: {
            status: "pendente",
            origem: "confirmacao_rapida"
          }
        })
      );
    });
  });

  it("a dona edita a disponibilidade de uma profissional da equipe sem alterar a política do negócio", async () => {
    apiRequest.mockImplementation((requestPath, options = {}) => {
      if (
        requestPath ===
          "/agenda-configuracao?profissionalId=9" &&
        !options.method
      ) {
        return Promise.resolve({
          configuracao: {
            duracao_padrao: 60,
            intervalo_minutos: 0,
            antecedencia_agendamento: 0,
            antecedencia_cancelamento: 12,
            configurado_em:
              "2026-09-28T20:00:00.000Z",
            origem_horarios:
              "personalizado"
          },
          profissional: {
            id: 9,
            nome: "Ana",
            papel: "profissional"
          },
          horarios: defaultSuggestedWeek()
        });
      }

      if (
        requestPath === "/agenda-configuracao" &&
        options.method === "PUT"
      ) {
        return Promise.resolve({
          mensagem: "Horários atualizados com sucesso.",
          configuracao: {
            configurado_em:
              "2026-09-28T20:00:00.000Z",
            origem_horarios:
              "personalizado"
          },
          horarios: defaultSuggestedWeek()
        });
      }

      return Promise.reject(
        new Error(
          `Rota inesperada: ${requestPath}`
        )
      );
    });

    renderPage(
      "/painel/horarios?profissional=9"
    );

    expect(
      await screen.findByText(
        /Configurando a disponibilidade de/
      )
    ).not.toBeNull();
    expect(
      screen.getByText("Ana")
    ).not.toBeNull();
    expect(
      screen.queryByLabelText(
        "Antecedência para cancelar"
      )
    ).toBeNull();

    fireEvent.click(
      screen.getByRole(
        "button",
        { name: "Salvar horários" }
      )
    );

    await waitFor(() => {
      expect(
        apiRequest
      ).toHaveBeenCalledWith(
        "/agenda-configuracao",
        expect.objectContaining({
          method: "PUT",
          body: expect.objectContaining({
            profissionalId: 9
          })
        })
      );
    });

    const saveCall =
      apiRequest.mock.calls.find(
        ([requestPath, options = {}]) =>
          requestPath ===
            "/agenda-configuracao" &&
          options.method === "PUT"
      );

    expect(
      saveCall[1].body
    ).not.toHaveProperty(
      "antecedenciaCancelamento"
    );
    expect(
      screen.queryByRole(
        "heading",
        { name: "Agora divulgue seu perfil" }
      )
    ).toBeNull();
  });

  it("mantém a primeira configuração profissional no editor operacional", async () => {
    apiRequest.mockImplementation((requestPath, options = {}) => {
      if (requestPath === "/agenda-configuracao" && !options.method) {
        return Promise.resolve({
          configuracao: {
            duracao_padrao: 60,
            intervalo_minutos: 0,
            antecedencia_agendamento: 0,
            antecedencia_cancelamento: 2,
            configurado_em: "2026-09-10T04:00:00.000Z",
          origem_horarios: "padrao_af"
          },
          horarios: defaultSuggestedWeek()
        });
      }

      if (requestPath === "/agenda-configuracao" && options.method === "PUT") {
        return Promise.resolve({
          mensagem: "Horários salvos.",
          configuracao: {
            configurado_em: "2026-09-27T22:00:00.000Z"
          },
          horarios: defaultSuggestedWeek(),
          publicacao: {
            publicado: true,
            pode_publicar: true
          }
        });
      }

      return Promise.reject(new Error(`Rota inesperada: ${requestPath}`));
    });

    renderPage("/profissional/horarios");

    expect(
      (await screen.findAllByRole("heading", {
        name: "Quando você recebe clientes"
      })).length
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("heading", { name: "Confirme quando você atende" })
    ).toBeNull();
    expect(
      screen.queryByLabelText("Etapas iniciais do negócio")
    ).toBeNull();

    expect(
      screen.queryByLabelText("Antecedência para cancelar")
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Salvar horários" }));

    expect(await screen.findByText("Horários salvos.")).not.toBeNull();

    const professionalSave =
      apiRequest.mock.calls.find(
        ([requestPath, options = {}]) =>
          requestPath === "/agenda-configuracao"
          && options.method === "PUT"
      );

    expect(professionalSave).toBeTruthy();
    expect(professionalSave[1]).toEqual(
      expect.objectContaining({
        method: "PUT",
        headers: {
          "X-AF-Contexto": "profissional"
        }
      })
    );
    expect(
      professionalSave[1].body
    ).not.toHaveProperty(
      "antecedenciaCancelamento"
    );
    expect(
      screen.queryByRole("heading", { name: "Agora divulgue seu perfil" })
    ).toBeNull();
    expect(screen.queryByTestId("destination")).toBeNull();
  });

  it("agrupa horários iguais e separa o sábado na confirmação rápida", () => {
    const summary = summarizeSchedule(defaultSuggestedWeek().map((day) => ({
      diaSemana: day.dia_semana,
      trabalha: day.trabalha,
      horaInicio: day.hora_inicio || "",
      horaFim: day.hora_fim || "",
      intervaloInicio: day.intervalo_inicio || "",
      intervaloFim: day.intervalo_fim || ""
    })));

    expect(summary).toEqual([
      {
        key: "08:00|18:00|12:00|13:00",
        days: "Seg, Ter, Qua, Qui, Sex",
        attendance: "08:00–18:00",
        pause: "12:00–13:00"
      },
      {
        key: "08:00|13:00||",
        days: "Sáb",
        attendance: "08:00–13:00",
        pause: null
      }
    ]);
  });

  it("salva a sugestão e segue para divulgação sem redirecionar ao checkout", async () => {
    mockFirstConfiguration();
    const originalImplementation = apiRequest.getMockImplementation();
    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/configuracoes") {
        return Promise.resolve({
          negocio: {
            id: 11,
            nome: "Studio Aurora",
            slug: "studio-aurora",
            publicado: true
          }
        });
      }
      return originalImplementation(path, options);
    });

    renderPage("/painel/horarios?plano=autonoma");
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar horários" }));

    expect(await screen.findByRole("heading", { name: "Agora divulgue seu perfil" }))
      .not.toBeNull();
    expect(screen.getByRole("button", { name: "Compartilhar perfil" }))
      .not.toBeNull();
    expect(screen.queryByTestId("destination")).toBeNull();
    expect(screen.queryByRole("link", { name: "Concluir plano escolhido" }))
      .toBeNull();
    expect(apiRequest).toHaveBeenCalledWith(
      "/agenda-configuracao",
      expect.objectContaining({
        method: "PUT",
        body: expect.objectContaining({
          horarios: expect.arrayContaining([
            expect.objectContaining({
              diaSemana: 1,
              trabalha: true,
              horaInicio: "08:00",
              horaFim: "18:00",
              intervaloInicio: "12:00",
              intervaloFim: "13:00"
            }),
            expect.objectContaining({
              diaSemana: 6,
              trabalha: true,
              horaInicio: "08:00",
              horaFim: "13:00"
            })
          ])
        })
      })
    );
    expect(track).toHaveBeenCalledWith(
      "agenda_configurada",
      expect.objectContaining({
        properties: {
          status: "sucesso",
          origem: "confirmacao_rapida"
        }
      })
    );
  });

  it("restaura a missão de divulgação ao recarregar a URL após salvar os horários", async () => {
    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/agenda-configuracao" && !options.method) {
        return Promise.resolve({
          configuracao: {
            duracao_padrao: 60,
            intervalo_minutos: 0,
            antecedencia_agendamento: 0,
            antecedencia_cancelamento: 24,
            configurado_em: "2026-09-10T05:00:00.000Z",
            origem_horarios: "personalizado"
          },
          horarios: defaultSuggestedWeek()
        });
      }

      if (path === "/configuracoes") {
        return Promise.resolve({
          negocio: {
            id: 11,
            nome: "Studio Aurora",
            slug: "studio-aurora",
            publicado: true
          }
        });
      }

      if (path === "/dashboard-dono/ativacao") {
        return Promise.resolve({
        negocio: activationBusiness(),
          proxima_acao_ativacao: {
            estado: "CONQUISTAR_PRIMEIRO_AGENDAMENTO",
            concluido: false
          }
        });
      }

      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    renderPage("/painel/horarios?plano=autonoma&onboarding=divulgacao");

    expect(await screen.findByRole("heading", { name: "Agora divulgue seu perfil" }))
      .not.toBeNull();
    expect(screen.getByRole("button", { name: "Compartilhar perfil" }))
      .not.toBeNull();
    expect(screen.queryByRole("button", { name: "Salvar horários" }))
      .toBeNull();
    expect(screen.queryByRole("link", { name: "Concluir plano escolhido" }))
      .toBeNull();
  });

  it("restaura o editor em vez da divulgação quando o negócio está sem disponibilidade agendável", async () => {
    apiRequest.mockImplementation((path, options = {}) => {
      if (
        path === "/agenda-configuracao" &&
        !options.method
      ) {
        return Promise.resolve({
          configuracao: {
            duracao_padrao: 60,
            intervalo_minutos: 0,
            antecedencia_agendamento: 0,
            antecedencia_cancelamento: 2,
            configurado_em:
              "2026-09-10T05:00:00.000Z",
            origem_horarios:
              "personalizado"
          },
          horarios: defaultSuggestedWeek()
        });
      }

      if (
        path === "/dashboard-dono/ativacao"
      ) {
        return Promise.resolve({
          negocio:
            activationBusiness(),
          ativacao: {
            possui_servico_ativo:
              true,
            negocio_publicado:
              true,
            agenda_configurada:
              true,
            possui_disponibilidade_agendavel:
              false,
            primeiro_agendamento_recebido:
              false
          },
          proxima_acao_ativacao: {
            estado:
              "CONQUISTAR_PRIMEIRO_AGENDAMENTO",
            concluido: false,
            acao: {
              tipo: "NAVEGAR",
              rotulo:
                "Configurar horários",
              destino:
                "/painel/horarios"
            }
          }
        });
      }

      return Promise.reject(
        new Error(
          `Rota inesperada: ${path}`
        )
      );
    });

    renderPage(
      "/painel/horarios?onboarding=divulgacao"
    );

    expect(
      await screen.findByText(
        /ainda não há disponibilidade para novas reservas/i
      )
    ).not.toBeNull();
    expect(
      screen.queryByRole(
        "heading",
        { name: "Agora divulgue seu perfil" }
      )
    ).toBeNull();
    expect(
      screen.getByRole(
        "button",
        { name: "Salvar horários" }
      )
    ).not.toBeNull();
  });

  it("volta ao editor quando Horários é aberto sem o marcador de divulgação", async () => {
    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/agenda-configuracao" && !options.method) {
        return Promise.resolve({
          configuracao: {
            duracao_padrao: 60,
            intervalo_minutos: 0,
            antecedencia_agendamento: 0,
            antecedencia_cancelamento: 2,
            configurado_em: "2026-09-10T05:00:00.000Z",
            origem_horarios: "personalizado"
          },
          horarios: defaultSuggestedWeek()
        });
      }

      if (path === "/configuracoes") {
        return Promise.resolve({
          negocio: {
            id: 11,
            nome: "Studio Aurora",
            slug: "studio-aurora",
            publicado: true
          }
        });
      }

      if (path === "/dashboard-dono/ativacao") {
        return Promise.resolve({
        negocio: activationBusiness(),
          proxima_acao_ativacao: {
            estado: "CONQUISTAR_PRIMEIRO_AGENDAMENTO",
            concluido: false
          }
        });
      }

      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    renderPage("/painel/horarios?onboarding=divulgacao");

    expect(await screen.findByRole("heading", { name: "Agora divulgue seu perfil" }))
      .not.toBeNull();

    fireEvent.click(screen.getByRole("button", {
      name: "Abrir editor de horários"
    }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Agora divulgue seu perfil" }))
        .toBeNull();
    });
    expect(screen.getByRole("button", { name: "Salvar horários" }))
      .not.toBeNull();
  });

  it("volta ao painel se não conseguir confirmar a missão ao recarregar a divulgação", async () => {
    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/agenda-configuracao" && !options.method) {
        return Promise.resolve({
          configuracao: {
            duracao_padrao: 60,
            intervalo_minutos: 0,
            antecedencia_agendamento: 0,
            antecedencia_cancelamento: 24,
            configurado_em: "2026-09-10T05:00:00.000Z",
            origem_horarios: "personalizado"
          },
          horarios: defaultSuggestedWeek()
        });
      }

      if (path === "/configuracoes") {
        return Promise.resolve({
          negocio: {
            id: 11,
            nome: "Studio Aurora",
            slug: "studio-aurora",
            publicado: true
          }
        });
      }

      if (path === "/dashboard-dono/ativacao") {
        return Promise.reject(new Error("dashboard indisponível"));
      }

      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    renderPage("/painel/horarios?onboarding=divulgacao");

    expect((await screen.findByTestId("destination")).textContent)
      .toBe("/painel");
    expect(screen.queryByRole("heading", { name: "Agora divulgue seu perfil" }))
      .toBeNull();
  });

  it("não restaura divulgação de uma URL antiga depois da ativação", async () => {
    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/agenda-configuracao" && !options.method) {
        return Promise.resolve({
          configuracao: {
            duracao_padrao: 60,
            intervalo_minutos: 0,
            antecedencia_agendamento: 0,
            antecedencia_cancelamento: 24,
            configurado_em: "2026-09-10T05:00:00.000Z",
            origem_horarios: "personalizado"
          },
          horarios: defaultSuggestedWeek()
        });
      }

      if (path === "/configuracoes") {
        return Promise.resolve({
          negocio: {
            id: 11,
            nome: "Studio Aurora",
            slug: "studio-aurora",
            publicado: true
          }
        });
      }

      if (path === "/dashboard-dono/ativacao") {
        return Promise.resolve({
        negocio: activationBusiness(),
          proxima_acao_ativacao: {
            estado: "ATIVADO",
            concluido: true
          }
        });
      }

      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    renderPage("/painel/horarios?onboarding=divulgacao");

    expect((await screen.findByTestId("destination")).textContent)
      .toBe("/painel");
    expect(screen.queryByRole("heading", { name: "Agora divulgue seu perfil" }))
      .toBeNull();
  });

  it("vai ao painel quando o primeiro agendamento já ativou o negócio antes da confirmação dos horários", async () => {
    mockFirstConfiguration();
    const originalImplementation = apiRequest.getMockImplementation();

    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/configuracoes") {
        return Promise.resolve({
          negocio: {
            id: 11,
            nome: "Studio Aurora",
            slug: "studio-aurora",
            publicado: true
          }
        });
      }

      if (path === "/dashboard-dono/ativacao") {
        return Promise.resolve({
        negocio: activationBusiness(),
          proxima_acao_ativacao: {
            estado: "ATIVADO",
            concluido: true
          }
        });
      }

      return originalImplementation(path, options);
    });

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar horários" }));

    expect((await screen.findByTestId("destination")).textContent)
      .toBe("/painel");
    expect(screen.queryByRole("heading", { name: "Agora divulgue seu perfil" }))
      .toBeNull();
  });

  it("não afirma divulgação quando a próxima ação canônica fica indisponível após salvar", async () => {
    mockFirstConfiguration();
    const originalImplementation = apiRequest.getMockImplementation();

    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/configuracoes") {
        return Promise.resolve({
          negocio: {
            id: 11,
            nome: "Studio Aurora",
            slug: "studio-aurora",
            publicado: true
          }
        });
      }

      if (path === "/dashboard-dono/ativacao") {
        return Promise.reject(new Error("dashboard indisponível"));
      }

      return originalImplementation(path, options);
    });

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar horários" }));

    expect((await screen.findByTestId("destination")).textContent)
      .toBe("/painel");
    expect(screen.queryByRole("heading", { name: "Agora divulgue seu perfil" }))
      .toBeNull();
  });

  it("mantém o editor e pede disponibilidade antes de divulgar quando todos os dias estão fechados", async () => {
    const closedWeek = Array.from(
      { length: 7 },
      (_, diaSemana) => ({
        dia_semana: diaSemana,
        trabalha: false,
        hora_inicio: null,
        hora_fim: null,
        intervalo_inicio: null,
        intervalo_fim: null
      })
    );

    apiRequest.mockImplementation((path, options = {}) => {
      if (
        path === "/agenda-configuracao" &&
        !options.method
      ) {
        return Promise.resolve({
          configuracao: {
            duracao_padrao: 60,
            intervalo_minutos: 0,
            antecedencia_agendamento: 0,
            antecedencia_cancelamento: 2,
            configurado_em:
              "2026-09-10T04:00:00.000Z",
            origem_horarios:
              "padrao_af"
          },
          horarios: closedWeek
        });
      }

      if (
        path === "/agenda-configuracao" &&
        options.method === "PUT"
      ) {
        return Promise.resolve({
          mensagem:
            "Horários salvos.",
          configuracao: {
            configurado_em:
              "2026-09-10T05:00:00.000Z",
            origem_horarios:
              "personalizado"
          },
          horarios: closedWeek,
          publicacao: null
        });
      }

      if (
        path === "/dashboard-dono/ativacao"
      ) {
        return Promise.resolve({
          negocio:
            activationBusiness(),
          ativacao: {
            possui_servico_ativo:
              true,
            negocio_publicado:
              true,
            agenda_configurada:
              true,
            possui_disponibilidade_agendavel:
              false,
            primeiro_agendamento_recebido:
              false
          },
          proxima_acao_ativacao: {
            estado:
              "CONQUISTAR_PRIMEIRO_AGENDAMENTO",
            concluido: false,
            acao: {
              tipo: "NAVEGAR",
              rotulo:
                "Configurar horários",
              destino:
                "/painel/horarios"
            }
          }
        });
      }

      return Promise.reject(
        new Error(
          `Rota inesperada: ${path}`
        )
      );
    });

    renderPage();

    fireEvent.click(
      await screen.findByRole(
        "button",
        { name: "Ajustar horários" }
      )
    );

    fireEvent.click(
      screen.getByRole(
        "button",
        { name: "Salvar horários e continuar" }
      )
    );

    expect(
      await screen.findByText(
        /ainda não há disponibilidade para novas reservas/i
      )
    ).not.toBeNull();
    expect(
      screen.queryByRole(
        "heading",
        { name: "Agora divulgue seu perfil" }
      )
    ).toBeNull();
    expect(
      screen.queryByRole(
        "button",
        { name: "Compartilhar perfil" }
      )
    ).toBeNull();
    expect(
      screen.getByRole(
        "button",
        { name: "Salvar horários" }
      )
    ).not.toBeNull();
  });

  it("não avança quando o salvamento da sugestão falha", async () => {
    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/agenda-configuracao" && !options.method) {
        return Promise.resolve({
          configuracao: { configurado_em: "2026-09-10T04:00:00.000Z",
          origem_horarios: "padrao_af" },
          horarios: defaultSuggestedWeek()
        });
      }
      if (path === "/agenda-configuracao" && options.method === "PUT") {
        return Promise.reject(new Error("Não foi possível salvar os horários"));
      }
      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar horários" }));

    expect(await screen.findByRole("alert")).not.toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("Não foi possível salvar os horários");
    expect(screen.queryByTestId("destination")).toBeNull();
  });

  it("abre o editor completo quando a profissional decide ajustar a sugestão", async () => {
    mockFirstConfiguration();
    renderPage();
    await openFirstScheduleEditor();

    expect(screen.getByText("Ajustes avançados")).not.toBeNull();
    expect(screen.getByLabelText("Início do atendimento de Segunda")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Salvar horários e continuar" }))
      .not.toBeNull();

    expect(track).toHaveBeenCalledWith(
      "agenda_configuracao_visualizada",
      expect.objectContaining({
        properties: {
          status: "editor_aberto",
          origem: "ajuste_manual"
        }
      })
    );
  });

  it("abre os ajustes avançados por padrão quando a agenda já foi configurada", async () => {
    apiRequest.mockResolvedValueOnce({
      configuracao: {
        duracao_padrao: 60,
        intervalo_minutos: 0,
        antecedencia_agendamento: 0,
        antecedencia_cancelamento: 24,
        configurado_em: "2026-08-29T01:00:00.000Z",
        origem_horarios: "personalizado"
      },
      horarios: validWeek()
    });

    renderPage();

    await screen.findByText("Quando você recebe clientes");
    const advanced = screen.getByText("Ajustes avançados").closest("details");
    expect(advanced?.open).toBe(true);
    expect(screen.getByRole("combobox", { name: "Intervalo entre clientes" }))
      .not.toBeNull();
  });

  it("valida pausas incompletas", () => {
    expect(validateSchedule([{
      diaSemana: 1,
      trabalha: true,
      horaInicio: "08:00",
      horaFim: "18:00",
      intervaloInicio: "12:00",
      intervaloFim: ""
    }])).toContain("preencha o início e o fim da pausa");
  });

  it("permite uma semana inteira fechada sem criar gate de publicação", () => {
    const closedWeek = Array.from({ length: 7 }, (_, diaSemana) => ({
      diaSemana,
      trabalha: false,
      horaInicio: "",
      horaFim: "",
      intervaloInicio: "",
      intervaloFim: ""
    }));

    expect(
      validateSchedule(closedWeek)
    ).toBe("");
  });

  it("não envia um período cujo fim antecede o início", async () => {
    renderPage();
    const save = await screen.findByRole("button", { name: "Confirmar horários" });
    fireEvent.click(save);

    expect(screen.getByRole("alert").textContent).toContain("horário final precisa ser depois");
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it("explica intervalo e antecedências com unidades humanas", async () => {
    apiRequest.mockResolvedValueOnce({
      configuracao: {
        duracao_padrao: 60,
        intervalo_minutos: 0,
        antecedencia_agendamento: 0,
        antecedencia_cancelamento: 24,
        configurado_em: "2026-08-29T01:00:00.000Z",
        origem_horarios: "personalizado"
      },
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

    const interval = await screen.findByRole("combobox", { name: "Intervalo entre clientes" });
    const bookingLead = screen.getByRole("combobox", { name: "Antecedência para agendar" });
    const cancellationLead = screen.getByRole("spinbutton", { name: "Antecedência para cancelar" });

    expect(interval.selectedOptions[0].textContent).toBe("Sem intervalo");
    expect(bookingLead.selectedOptions[0].textContent).toBe("Sem antecedência");
    expect(cancellationLead.value).toBe("24");
    expect(cancellationLead.min).toBe("0");
    expect(cancellationLead.max).toBe("168");
  });

  it("rejeita na interface antecedência de cancelamento fora de 0 a 168 horas", async () => {
    apiRequest.mockResolvedValueOnce({
      configuracao: {
        duracao_padrao: 60,
        intervalo_minutos: 0,
        antecedencia_agendamento: 0,
        antecedencia_cancelamento: 2,
        configurado_em:
          "2026-09-28T20:00:00.000Z",
        origem_horarios:
          "personalizado"
      },
      horarios: validWeek()
    });

    renderPage();

    const cancellationLead =
      await screen.findByRole(
        "spinbutton",
        { name: "Antecedência para cancelar" }
      );

    fireEvent.change(
      cancellationLead,
      { target: { value: "169" } }
    );

    fireEvent.submit(
      cancellationLead.closest("form")
    );

    expect(
      await screen.findByRole("alert")
    ).toHaveProperty(
      "textContent",
      "A antecedência para cancelamento deve estar entre 0 e 168 horas."
    );

    expect(
      apiRequest.mock.calls.filter(
        ([requestPath, options = {}]) =>
          requestPath ===
            "/agenda-configuracao" &&
          options.method === "PUT"
      )
    ).toHaveLength(0);
  });

  it("rejeita antecedência de cancelamento vazia em vez de salvar zero", async () => {
    apiRequest.mockResolvedValueOnce({
      configuracao: {
        duracao_padrao: 60,
        intervalo_minutos: 0,
        antecedencia_agendamento: 0,
        antecedencia_cancelamento: 24,
        configurado_em:
          "2026-09-28T20:00:00.000Z",
        origem_horarios:
          "personalizado"
      },
      horarios: validWeek()
    });

    renderPage();

    const cancellationLead =
      await screen.findByRole(
        "spinbutton",
        { name: "Antecedência para cancelar" }
      );

    fireEvent.change(
      cancellationLead,
      { target: { value: "" } }
    );

    fireEvent.submit(
      cancellationLead.closest("form")
    );

    expect(
      await screen.findByRole("alert")
    ).toHaveProperty(
      "textContent",
      "A antecedência para cancelamento deve estar entre 0 e 168 horas."
    );

    expect(
      apiRequest.mock.calls.filter(
        ([requestPath, options = {}]) =>
          requestPath ===
            "/agenda-configuracao" &&
          options.method === "PUT"
      )
    ).toHaveLength(0);
  });

  it("mostra a pausa apenas quando a profissional decide configurá-la", async () => {
    apiRequest.mockResolvedValueOnce({
      configuracao: {},
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
    await openFirstScheduleEditor();

    const pauseMode = await screen.findByRole("combobox", { name: "Pausa de Segunda" });
    expect(screen.queryByLabelText("Início da pausa de Segunda")).toBeNull();
    fireEvent.change(pauseMode, { target: { value: "custom" } });
    expect(screen.getByLabelText("Início da pausa de Segunda")).not.toBeNull();
    expect(screen.getByLabelText("Fim da pausa de Segunda")).not.toBeNull();
  });

  it("copia um horário configurado para os demais dias ativos", async () => {
    apiRequest.mockResolvedValueOnce({
      configuracao: {},
      horarios: [
        {
          dia_semana: 1,
          trabalha: true,
          hora_inicio: "08:00",
          hora_fim: "18:00",
          intervalo_inicio: null,
          intervalo_fim: null
        },
        {
          dia_semana: 2,
          trabalha: true,
          hora_inicio: "10:00",
          hora_fim: "20:00",
          intervalo_inicio: null,
          intervalo_fim: null
        },
        {
          dia_semana: 3,
          trabalha: false,
          hora_inicio: null,
          hora_fim: null,
          intervalo_inicio: null,
          intervalo_fim: null
        }
      ]
    });

    renderPage();
    await openFirstScheduleEditor();

    const mondayStart = await screen.findByLabelText("Início do atendimento de Segunda");
    const mondayEnd = screen.getByLabelText("Fim do atendimento de Segunda");
    fireEvent.change(mondayStart, { target: { value: "09:00" } });
    fireEvent.change(mondayEnd, { target: { value: "17:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Copiar horário de Segunda para os dias ativos" }));

    expect(screen.getByLabelText("Início do atendimento de Terça").value).toBe("09:00");
    expect(screen.getByLabelText("Fim do atendimento de Terça").value).toBe("17:00");
    expect(screen.queryByLabelText("Início do atendimento de Quarta")).toBeNull();
  });

  it("mantém a missão de divulgação após ajuste manual quando o backend confirma publicação", async () => {
    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/agenda-configuracao" && !options.method) {
        return Promise.resolve({
          configuracao: { configurado_em: "2026-09-10T04:00:00.000Z",
          origem_horarios: "padrao_af" },
          horarios: validWeek()
        });
      }
      if (path === "/agenda-configuracao" && options.method === "PUT") {
        return Promise.resolve({
          mensagem: "Horários salvos.",
          configuracao: { configurado_em: "2026-09-10T05:00:00.000Z", origem_horarios: "personalizado" },
          horarios: validWeek(),
          publicacao: { publicado: true, pode_publicar: true }
        });
      }
      if (path === "/configuracoes") {
        return Promise.resolve({
          negocio: { id: 11, nome: "Studio Aurora", slug: "studio-aurora", publicado: true }
        });
      }
      if (path === "/dashboard-dono/ativacao") {
        return Promise.resolve({
        negocio: activationBusiness(),
          proxima_acao_ativacao: {
            estado: "CONQUISTAR_PRIMEIRO_AGENDAMENTO"
          }
        });
      }
      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    renderPage();
    await openFirstScheduleEditor();
    fireEvent.click(screen.getByRole("button", { name: "Salvar horários e continuar" }));

    expect(await screen.findByRole("heading", { name: "Agora divulgue seu perfil" }))
      .not.toBeNull();
    expect(await screen.findByRole("button", { name: "Compartilhar perfil" }))
      .not.toBeNull();
  });

  it("não repete a missão de primeira configuração em edições posteriores", async () => {
    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/agenda-configuracao" && !options.method) {
        return Promise.resolve({
          configuracao: {
            duracao_padrao: 60,
            intervalo_minutos: 0,
            antecedencia_agendamento: 0,
            antecedencia_cancelamento: 24,
            configurado_em: "2026-08-28T22:00:00.000Z",
        origem_horarios: "personalizado"
          },
          horarios: validWeek()
        });
      }
      if (path === "/agenda-configuracao" && options.method === "PUT") {
        return Promise.resolve({
          mensagem: "Horários de atendimento atualizados com sucesso.",
          configuracao: { configurado_em: "2026-08-28T22:00:00.000Z",
        origem_horarios: "personalizado" },
          horarios: validWeek()
        });
      }
      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Salvar horários" }));

    await waitFor(() => {
      expect(screen.getByText("Horários de atendimento atualizados com sucesso."))
        .not.toBeNull();
    });
    expect(screen.queryByRole("heading", { name: "Agora divulgue seu perfil" }))
      .toBeNull();
    expect(track).not.toHaveBeenCalledWith("agenda_configurada", expect.anything());
  });
});