// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { apiRequest } from "../api/client";
import { AdminProfessionalFunnelPage } from "./AdminProfessionalFunnelPage";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

function resultado() {
  return {
    periodo: "30",
    resumo: {
      cadastros: 20,
      negociosCriados: 12,
      servicosCriados: 10,
      agendasConfiguradas: 8,
      negociosPublicados: 7,
      checkoutsIniciados: 5,
      assinaturasAtivadas: 4,
      investimentoCentavos: 40000,
      receitaPrimeiroPagamentoCentavos: 59600,
      roas: 1.49,
      taxaNegocio: 60,
      taxaPublicacao: 35,
      taxaCheckout: 25,
      taxaAssinatura: 20,
      custoCadastroCentavos: 2000,
      custoCheckoutCentavos: 8000,
      cacAssinanteCentavos: 10000
    },
    decisao: {
      metaRoas: 1,
      faixaEscalaRoas: 1.2,
      minimoCadastros: 10,
      minimoAssinaturas: 2,
      contagem: {
        escalar: 1,
        manter: 0,
        observar: 0,
        revisar: 0,
        pausar: 0,
        semDados: 0
      }
    },
    campanhas: [
      {
        origem: "meta",
        midia: "cpc",
        campanha: "profissionais_goiania",
        cadastros: 20,
        negociosCriados: 12,
        servicosCriados: 10,
        agendasConfiguradas: 8,
        negociosPublicados: 7,
        checkoutsIniciados: 5,
        assinaturasAtivadas: 4,
        investimentoCentavos: 40000,
        receitaPrimeiroPagamentoCentavos: 59600,
        roas: 1.49,
        taxaAssinatura: 20,
        custoCadastroCentavos: 2000,
        custoCheckoutCentavos: 8000,
        cacAssinanteCentavos: 10000,
        decisao: {
          codigo: "escalar",
          rotulo: "Escalar",
          confianca: "alta",
          motivo: "ROAS 1.49x está acima da faixa de escala de 1.20x com volume mínimo atingido."
        }
      }
    ]
  };
}

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockResolvedValue(resultado());
});

afterEach(cleanup);

describe("AdminProfessionalFunnelPage", () => {
  it("renderiza KPIs, gráficos, marcos independentes e detalhes de decisão", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AdminProfessionalFunnelPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", { name: "Rentabilidade de profissionais" })
    ).not.toBeNull();

    expect(screen.getByRole("heading", { name: "Marcos alcançados pela coorte" })).not.toBeNull();
    expect(screen.getByText("Atingimento por marco")).not.toBeNull();
    expect(screen.getByText("ROAS por campanha")).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "Progressão da coorte" })).toBeNull();

    expect(screen.getAllByText("20").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("profissionais_goiania").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Meta Ads").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/R\$\s*100,00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/R\$\s*596,00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("1,49x").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Escalar").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Confiança alta/i)).not.toBeNull();
    expect(screen.getByText(/10 cadastros · 2 assinaturas/i)).not.toBeNull();
    expect(
      screen.getByText(/renovações posteriores não entram no ROAS/i)
    ).not.toBeNull();

    expect(screen.queryByText("Custo por checkout")).toBeNull();
    expect(screen.getAllByText(/R\$\s*80,00/)).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Ver detalhes" }));

    expect(screen.getByText("Custo por checkout")).not.toBeNull();
    expect(screen.getAllByText(/R\$\s*80,00/)).toHaveLength(2);
    expect(
      screen.getByText(/ROAS 1\.49x está acima da faixa de escala/i)
    ).not.toBeNull();
  });

  it("não chama tráfego pago sem utm_campaign de orgânico", async () => {
    const paidWithoutCampaign = resultado();
    paidWithoutCampaign.campanhas = [
      {
        ...paidWithoutCampaign.campanhas[0],
        origem: "google",
        midia: "cpc",
        campanha: "organico",
        roas: null,
        decisao: {
          codigo: "sem_dados",
          rotulo: "Sem dados",
          confianca: "baixa",
          motivo: "Sem investimento atribuído."
        }
      }
    ];
    apiRequest.mockResolvedValueOnce(paidWithoutCampaign);

    render(
      <MemoryRouter>
        <AdminProfessionalFunnelPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Tráfego sem UTM de campanha")).not.toBeNull();
    expect(screen.queryByText("Orgânico / sem campanha")).toBeNull();
    expect(screen.getAllByText("Google Ads").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("CPC")).not.toBeNull();
    expect(screen.getAllByText("Sem dados").length).toBeGreaterThanOrEqual(1);
  });

  it("remove o marcador técnico none do tráfego orgânico", async () => {
    const organic = resultado();
    organic.campanhas = [
      {
        ...organic.campanhas[0],
        origem: "organico",
        midia: "none",
        campanha: "organico",
        roas: null,
        investimentoCentavos: 0,
        receitaPrimeiroPagamentoCentavos: 0,
        cacAssinanteCentavos: null,
        decisao: {
          codigo: "sem_dados",
          rotulo: "Sem dados",
          confianca: "baixa",
          motivo: "Sem investimento atribuído."
        }
      }
    ];
    apiRequest.mockResolvedValueOnce(organic);

    render(
      <MemoryRouter>
        <AdminProfessionalFunnelPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Orgânico / sem campanha")).not.toBeNull();
    expect(screen.getByText("Orgânico")).not.toBeNull();
    expect(screen.queryByText("none")).toBeNull();
  });

  it("recarrega a coorte ao trocar período", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AdminProfessionalFunnelPage />
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Rentabilidade de profissionais" });
    await user.click(screen.getByRole("button", { name: "7 dias" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/admin/marketing/funil-profissionais?periodo=7",
        expect.any(Object)
      );
    });
  });

  it("preserva a coorte carregada se a atualização falhar", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AdminProfessionalFunnelPage />
      </MemoryRouter>
    );

    await screen.findByText("profissionais_goiania");
    apiRequest.mockRejectedValueOnce(new Error("Funil indisponível"));

    await user.click(screen.getByRole("button", { name: "7 dias" }));

    expect(await screen.findByRole("alert")).not.toBeNull();
    expect(screen.getAllByText("profissionais_goiania").length).toBeGreaterThanOrEqual(1);
  });
});
