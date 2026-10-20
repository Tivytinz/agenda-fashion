// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardGrowthInsight } from "./DashboardGrowthInsight";

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  track: vi.fn(),
}));

vi.mock("../api/client", () => ({
  apiRequest: mocks.apiRequest,
}));

vi.mock("../analytics/track", () => ({
  track: mocks.track,
}));

vi.mock("./PublicShareButton", () => ({
  PublicShareButton: ({ label, shareText }) => (
    <button data-share-text={shareText || ""} type="button">
      {label}
    </button>
  ),
}));

beforeEach(() => {
  mocks.apiRequest.mockReset();
  mocks.track.mockReset();
});

afterEach(cleanup);

describe("DashboardGrowthInsight", () => {
  it("orienta a rotina com pouca amostra sem inventar oportunidade", () => {
    render(
      <MemoryRouter>
        <DashboardGrowthInsight
          insight={{
            status: "DADOS_INSUFICIENTES",
            oportunidade_principal: null,
          }}
          businessId={11}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", {
      name: "Continue cuidando do seu negócio",
    })).not.toBeNull();
    expect(screen.getByRole("link", {
      name: "Abrir agenda",
    }).getAttribute("href")).toBe("/painel/agenda");
    expect(screen.queryByLabelText("Evidências da oportunidade")).toBeNull();
    expect(mocks.track).not.toHaveBeenCalled();
    expect(mocks.apiRequest).not.toHaveBeenCalled();
  });

  it.each(["AGUARDANDO_ATIVACAO", "INDISPONIVEL", "SEM_OPORTUNIDADE_PRIORITARIA"])(
    "não cria orientação genérica para %s",
    (status) => {
      const { container } = render(
        <MemoryRouter>
          <DashboardGrowthInsight insight={{ status }} businessId={11} />
        </MemoryRouter>
      );
      expect(container.innerHTML).toBe("");
      expect(mocks.track).not.toHaveBeenCalled();
    }
  );

  it("orienta revisar horários sem oferecer divulgação ou Copilot", () => {
    render(
      <MemoryRouter>
        <DashboardGrowthInsight
          businessId={11}
          insight={{
            status: "OPORTUNIDADE_PRIORIZADA",
            oportunidade_principal: {
              codigo: "REVISAR_DISPONIBILIDADE",
              categoria: "operacao",
              titulo: "Revise os horários antes de divulgar",
              mensagem: "Se a pausa for intencional, mantenha sua configuração.",
              acao: {
                tipo: "NAVEGAR",
                rotulo: "Revisar horários",
                destino: "/painel/horarios",
              },
            },
          }}
        />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: "Revisar horários" }).getAttribute("href"))
      .toBe("/painel/horarios");
    expect(screen.queryByRole("button", { name: /Compartilhar|Criar texto/i })).toBeNull();
    expect(mocks.apiRequest).not.toHaveBeenCalled();
  });

  it("não mostra divulgação de uma resposta antiga depois da revisão de horários", async () => {
    let resolveCopy;
    mocks.apiRequest.mockReturnValue(new Promise((resolve) => { resolveCopy = resolve; }));
    const share = {
      status: "OPORTUNIDADE_PRIORIZADA",
      oportunidade_principal: {
        codigo: "SERVICO_COM_TRACAO_CONCENTRADA",
        categoria: "demanda",
        titulo: "Divulgue seu perfil",
        acao: { tipo: "COMPARTILHAR_PERFIL", rotulo: "Compartilhar perfil" },
      },
    };
    const { rerender } = render(
      <MemoryRouter><DashboardGrowthInsight insight={share} businessId={11} /></MemoryRouter>
    );
    fireEvent.click(screen.getByRole("button", { name: "✨ Criar texto de divulgação" }));
    rerender(
      <MemoryRouter>
        <DashboardGrowthInsight
          businessId={11}
          insight={{
            status: "OPORTUNIDADE_PRIORIZADA",
            oportunidade_principal: {
              codigo: "REVISAR_DISPONIBILIDADE",
              categoria: "operacao",
              titulo: "Revise os horários antes de divulgar",
              acao: { tipo: "NAVEGAR", rotulo: "Revisar horários", destino: "/painel/horarios" },
            },
          }}
        />
      </MemoryRouter>
    );
    await act(async () => resolveCopy({ fonte: "deterministic", titulo: "Divulgação anterior", texto: "Texto antigo" }));
    expect(mocks.track).not.toHaveBeenCalledWith(
      "copilot_divulgacao_gerada", expect.anything()
    );
    expect(screen.queryByLabelText("Texto de divulgação")).toBeNull();
    expect(screen.queryByRole("button", { name: /Compartilhar|Criar texto/i })).toBeNull();
    expect(screen.getByRole("link", { name: "Revisar horários" })).not.toBeNull();
  });

  it("mostra evidências e mantém navegação em destino permitido", () => {
    render(
      <MemoryRouter>
        <DashboardGrowthInsight
          businessId={11}
          insight={{
            status: "OPORTUNIDADE_PRIORIZADA",
            oportunidade_principal: {
              codigo: "CONVERSAO_SEM_AGENDAMENTO",
              categoria: "conversao",
              titulo: "Transforme visitas em agendamentos",
              mensagem: "Há sinal suficiente para revisar a conversão.",
              evidencias: [
                {
                  chave: "visitas_perfil",
                  rotulo: "Visitas ao perfil",
                  valor: 50,
                },
                {
                  chave: "taxa_conversao",
                  rotulo: "Conversão",
                  valor: 0,
                  unidade: "%",
                },
              ],
              acao: {
                tipo: "NAVEGAR",
                rotulo: "Revisar meu perfil",
                destino: "/painel/negocio",
              },
            },
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", {
      name: "Transforme visitas em agendamentos",
    })).not.toBeNull();
    expect(screen.getByLabelText("Evidências da oportunidade")).not.toBeNull();
    expect(screen.getByRole("link", {
      name: "Revisar meu perfil",
    }).getAttribute("href")).toBe("/painel/negocio");
    expect(screen.queryByRole("button", {
      name: "✨ Criar texto de divulgação",
    })).toBeNull();
  });

  it("não renderiza link fornecido pelo backend quando o destino não está na allowlist", () => {
    render(
      <MemoryRouter>
        <DashboardGrowthInsight
          businessId={11}
          insight={{
            status: "OPORTUNIDADE_PRIORIZADA",
            oportunidade_principal: {
              codigo: "TESTE",
              categoria: "geral",
              titulo: "Teste",
              mensagem: "Teste",
              acao: {
                tipo: "NAVEGAR",
                rotulo: "Abrir",
                destino: "https://example.com",
              },
            },
          }}
        />
      </MemoryRouter>
    );

    expect(screen.queryByRole("link", { name: "Abrir" })).toBeNull();
  });

  it("gera texto somente para oportunidade de compartilhamento e preserva o período", async () => {
    mocks.apiRequest.mockResolvedValue({
      fonte: "openai",
      titulo: "Alongamento em destaque",
      texto: "Seu alongamento está em destaque. Veja o perfil e escolha seu horário.",
    });

    render(
      <MemoryRouter>
        <DashboardGrowthInsight
          businessId={11}
          businessName="Studio Rosa"
          businessSlug="studio-rosa"
          insight={{
            status: "OPORTUNIDADE_PRIORIZADA",
            periodo: "30dias",
            oportunidade_principal: {
              codigo: "SERVICO_COM_TRACAO_CONCENTRADA",
              categoria: "demanda",
              titulo: "Aproveite seu serviço de maior tração",
              mensagem: "Alongamento concentrou os agendamentos do período.",
              evidencias: [],
              acao: {
                tipo: "COMPARTILHAR_PERFIL",
                rotulo: "Compartilhar perfil",
              },
            },
          }}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", {
      name: "✨ Criar texto de divulgação",
    }));

    await waitFor(() => {
      expect(mocks.apiRequest).toHaveBeenCalledWith(
        "/dashboard-dono/copilot/divulgacao",
        expect.objectContaining({
          method: "POST",
          body: {
            periodo: "30dias",
            canal: "whatsapp",
          },
        })
      );
    });

    const textarea = await screen.findByLabelText("Texto de divulgação");
    expect(textarea.value).toContain("alongamento está em destaque");

    const shareButton = screen.getByRole("button", {
      name: "Compartilhar texto + perfil",
    });
    expect(shareButton.getAttribute("data-share-text")).toContain(
      "alongamento está em destaque"
    );

    expect(mocks.track).toHaveBeenCalledWith(
      "copilot_divulgacao_gerada",
      expect.objectContaining({
        properties: expect.objectContaining({
          fonte_copilot: "openai",
          canal_copilot: "whatsapp",
        }),
      })
    );
  });
});


describe("fonte determinística do Copilot", () => {
  it("registra deterministic quando o backend usa o caminho sem tokens", async () => {
    mocks.apiRequest.mockResolvedValue({
      fonte: "deterministic",
      titulo: "Studio Rosa no Agenda Fashion",
      texto: "Conheça o Studio Rosa no Agenda Fashion. Veja os serviços e escolha o melhor horário para você.",
    });

    render(
      <MemoryRouter>
        <DashboardGrowthInsight
          businessId={11}
          businessName="Studio Rosa"
          businessSlug="studio-rosa"
          insight={{
            status: "OPORTUNIDADE_PRIORIZADA",
            periodo: "30dias",
            oportunidade_principal: {
              codigo: "SERVICO_COM_TRACAO_CONCENTRADA",
              categoria: "demanda",
              titulo: "Divulgue seu perfil",
              mensagem: "Há uma oportunidade de divulgação.",
              evidencias: [],
              acao: {
                tipo: "COMPARTILHAR_PERFIL",
                rotulo: "Compartilhar perfil",
              },
            },
          }}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", {
      name: "✨ Criar texto de divulgação",
    }));

    await screen.findByLabelText("Texto de divulgação");

    expect(mocks.track).toHaveBeenCalledWith(
      "copilot_divulgacao_gerada",
      expect.objectContaining({
        properties: expect.objectContaining({
          fonte_copilot: "deterministic",
        }),
      })
    );
  });
});

 it.each(["success", "error"])("descarta resposta antiga entre períodos: %s", async (outcome) => {
   let resolveOld, rejectOld;
   mocks.apiRequest.mockImplementationOnce(() => new Promise((resolve, reject) => {
     resolveOld = resolve; rejectOld = reject;
   })).mockResolvedValueOnce({ texto: "Texto atual de 30 dias" });
   const view = (periodo, businessId = 11) => <MemoryRouter><DashboardGrowthInsight businessId={businessId} insight={{
     status: "OPORTUNIDADE_PRIORIZADA", periodo,
     oportunidade_principal: { codigo: "TRACAO", acao: { tipo: "COMPARTILHAR_PERFIL" } },
   }} /></MemoryRouter>;
   const { rerender } = render(view("7dias"));
   fireEvent.click(screen.getByRole("button", { name: /Criar texto/ }));
   const oldSignal = mocks.apiRequest.mock.calls[0][1].signal;
   rerender(view("30dias"));
   expect(oldSignal.aborted).toBe(true);
   fireEvent.click(screen.getByRole("button", { name: /Criar texto/ }));
   await waitFor(() => expect(screen.getByLabelText("Texto de divulgação").value).toBe("Texto atual de 30 dias"));
   await act(async () => {
     if (outcome === "success") resolveOld({ texto: "Texto antigo" });
     else rejectOld(new Error("Falha antiga"));
   });
   expect(screen.getByLabelText("Texto de divulgação").value).toBe("Texto atual de 30 dias");
   expect(screen.queryByRole("alert")).toBeNull();
   expect(mocks.track.mock.calls.filter(([event]) => event === "copilot_divulgacao_gerada")).toHaveLength(1);
   rerender(view("30dias", 22));
   expect(screen.queryByLabelText("Texto de divulgação")).toBeNull();
 });

it.each(["negocio", "recomendacao", "unmount"])("invalida pedido pendente ao mudar %s", async (change) => {
  let resolveCopy;
  mocks.apiRequest.mockImplementationOnce(() => new Promise((resolve) => { resolveCopy = resolve; }));
  const view = (businessId, codigo) => <MemoryRouter><DashboardGrowthInsight businessId={businessId} insight={{
    status: "OPORTUNIDADE_PRIORIZADA", periodo: "7dias",
    oportunidade_principal: { codigo, acao: { tipo: "COMPARTILHAR_PERFIL" } },
  }} /></MemoryRouter>;
  const { rerender, unmount } = render(view(11, "A"));
  fireEvent.click(screen.getByRole("button", { name: /Criar texto/ }));
  const signal = mocks.apiRequest.mock.calls[0][1].signal;
  if (change === "unmount") unmount();
  else rerender(view(change === "negocio" ? 22 : 11, change === "recomendacao" ? "B" : "A"));
  expect(signal.aborted).toBe(true);
  await act(async () => resolveCopy({ texto: "Resposta descartada" }));
  expect(screen.queryByLabelText("Texto de divulgação")).toBeNull();
  expect(mocks.track).not.toHaveBeenCalledWith("copilot_divulgacao_gerada", expect.anything());
});
