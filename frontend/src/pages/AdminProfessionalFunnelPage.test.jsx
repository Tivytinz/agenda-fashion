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
      primeirosAgendamentos: 6,
      checkoutsIniciados: 5,
      assinaturasAtivadas: 4,
      investimentoCentavos: 40000,
      receitaPrimeiroPagamentoCentavos: 59600,
      roas: 1.49,
      taxaNegocio: 60,
      taxaPublicacao: 35,
      taxaPrimeiroAgendamento: 30,
      taxaCheckout: 25,
      taxaAssinatura: 20,
      custoCadastroCentavos: 2000,
      custoCheckoutCentavos: 8000,
      cacAssinanteCentavos: 10000
    },
    diagnosticoAtribuicao: {
      cadastrosOficiais: 20,
      cadastrosSemCampanha: 0,
      cadastrosIdentidadeNaoOficial: 0,
      cadastrosSemEvidencia: 0,
      cadastrosOrganicos: 0
    },
    qualidadeMensuracao: {
      cadastrosTotais: 20,
      cadastrosPagosDetectados: 20,
      cadastrosPagosPendentes: 0,
      cadastrosSemEvidencia: 0,
      coberturaAtribuicaoPagaPercentual: 100,
      coberturaOrigemPercentual: 100,
      coberturaMinimaPercentual: 100,
      prontaParaDecisao: true,
      bloqueios: []
    },
    decisao: {
      metaRoas: 1,
      faixaEscalaRoas: 1.2,
      minimoCadastros: 10,
      minimoAssinaturas: 2,
      coberturaMinimaPercentual: 100,
      diasMaturacaoAtivacao: 14,
      diasMaturacaoMonetizacao: 21,
      contagem: {
        escalar: 1,
        manter: 0,
        observar: 0,
        revisar: 0,
        pausar: 0,
        mensuracaoIncompleta: 0,
        semDados: 0
      }
    },
    campanhas: [
      {
        origem: "meta",
        midia: "cpc",
        campanha: "profissionais_goiania",
        classificacaoAtribuicao: "oficial",
        cadastros: 20,
        negociosCriados: 12,
        servicosCriados: 10,
        agendasConfiguradas: 8,
        negociosPublicados: 7,
        primeirosAgendamentos: 6,
        checkoutsIniciados: 5,
        assinaturasAtivadas: 4,
        investimentoCentavos: 40000,
        receitaPrimeiroPagamentoCentavos: 59600,
        roas: 1.49,
        taxaAssinatura: 20,
        taxaPrimeiroAgendamento: 30,
        cadastrosMadurosAtivacao: 20,
        cadastrosMadurosMonetizacao: 20,
        negociosPublicadosMadurosAtivacao: 7,
        primeirosAgendamentosMadurosAtivacao: 6,
        assinaturasAtivadasMadurasMonetizacao: 4,
        custoCadastroCentavos: 2000,
        custoCheckoutCentavos: 8000,
        cacAssinanteCentavos: 10000,
        decisao: {
          codigo: "escalar",
          rotulo: "Escalar",
          confianca: "operacional",
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
  it("renderiza KPIs, funil executivo, marcos independentes e detalhes de decisão", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AdminProfessionalFunnelPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", { name: "Aquisição e retorno de profissionais" })
    ).not.toBeNull();

    expect(screen.getByRole("heading", { name: "Marcos alcançados no período" })).not.toBeNull();
    expect(screen.getByText("Prioridade atual")).not.toBeNull();
    expect(screen.getByText("Maior perda")).not.toBeNull();
    expect(screen.getByText("Marco independente")).not.toBeNull();
    expect(screen.getByText("Detalhamento do funil")).not.toBeNull();
    expect(screen.queryByText("Atingimento por marco")).toBeNull();
    expect(screen.queryByText("ROAS por campanha")).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Marco" })).toBeNull();
    expect(screen.getByRole("columnheader", { name: "ROAS" })).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: "CAC" })).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "Progressão da coorte" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Serviço" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Perfil publicado" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Agenda" })).not.toBeNull();
    expect(screen.getByText("Primeiro agendamento da jornada")).not.toBeNull();
    expect(screen.getByText("gasto atribuído a campanhas oficiais no período")).not.toBeNull();
    expect(screen.getByText("Diagnóstico de aquisição profissional")).not.toBeNull();
    expect(screen.getByText("Aquisição rentável")).not.toBeNull();
    expect(screen.getByText("Cobertura dos cadastros pagos")).not.toBeNull();

    await user.click(screen.getByText("Detalhamento do funil"));

    expect(screen.getByRole("columnheader", { name: "Marco" })).not.toBeNull();
    expect(screen.getByText("Serviço criado")).not.toBeNull();
    expect(screen.getByText("Agenda configurada")).not.toBeNull();
    expect(screen.getByText("Negócio publicado")).not.toBeNull();

    expect(screen.getAllByText("20").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("profissionais_goiania").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Meta Ads").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/R\$\s*100,00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/R\$\s*596,00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("1,49x").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Escalar").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Sinal operacional")).not.toBeNull();
    expect(screen.getByText(/10 cadastros · 2 assinaturas/i)).not.toBeNull();
    expect(
      screen.getByText(/renovações posteriores não entram no ROAS/i)
    ).not.toBeNull();
    expect(
      screen.getByText(/identidades UTM históricas equivalentes são consolidadas/i)
    ).not.toBeNull();

    expect(screen.queryByText("Custo por checkout")).toBeNull();
    expect(screen.queryByText(/R\$\s*80,00/)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Ver detalhes" }));

    expect(screen.getByText("Custo por checkout")).not.toBeNull();
    expect(screen.getByText("Ativação na janela")).not.toBeNull();
    expect(screen.getByText("Monetização na janela")).not.toBeNull();
    expect(
      screen.getByText(/7 publicados · 6 com primeiro agendamento em até 14 dias/i)
    ).not.toBeNull();
    expect(
      screen.getByText(/4 assinaturas em até 21 dias/i)
    ).not.toBeNull();
    expect(screen.getAllByText(/R\$\s*80,00/)).toHaveLength(1);
    expect(
      screen.getByText(/ROAS 1\.49x está acima da faixa de escala/i)
    ).not.toBeNull();
  });

  it("não mostra 100% no cadastro quando a coorte está vazia", async () => {
    const user = userEvent.setup();
    const empty = resultado();
    empty.resumo = {
      cadastros: 0,
      negociosCriados: 0,
      servicosCriados: 0,
      agendasConfiguradas: 0,
      negociosPublicados: 0,
      checkoutsIniciados: 0,
      assinaturasAtivadas: 0,
      investimentoCentavos: 20000,
      receitaPrimeiroPagamentoCentavos: 0,
      roas: 0,
      taxaNegocio: 0,
      taxaPublicacao: 0,
      taxaCheckout: 0,
      taxaAssinatura: 0,
      custoCadastroCentavos: null,
      custoCheckoutCentavos: null,
      cacAssinanteCentavos: null
    };
    empty.diagnosticoAtribuicao = {
      cadastrosOficiais: 0,
      cadastrosSemCampanha: 0,
      cadastrosIdentidadeNaoOficial: 0,
      cadastrosOrganicos: 0
    };
    empty.decisao.contagem = {
      escalar: 0,
      manter: 0,
      observar: 1,
      revisar: 0,
      pausar: 0,
      semDados: 0
    };
    empty.campanhas = [
      {
        ...empty.campanhas[0],
        cadastros: 0,
        negociosCriados: 0,
        servicosCriados: 0,
        agendasConfiguradas: 0,
        negociosPublicados: 0,
        checkoutsIniciados: 0,
        assinaturasAtivadas: 0,
        investimentoCentavos: 20000,
        receitaPrimeiroPagamentoCentavos: 0,
        roas: 0,
        custoCadastroCentavos: null,
        custoCheckoutCentavos: null,
        cacAssinanteCentavos: null,
        decisao: {
          codigo: "observar",
          rotulo: "Observar",
          confianca: "baixa",
          motivo: "Amostra pequena."
        }
      }
    ];
    apiRequest.mockResolvedValueOnce(empty);

    render(
      <MemoryRouter>
        <AdminProfessionalFunnelPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Aguardando base")).not.toBeNull();
    await user.click(screen.getByText("Detalhamento do funil"));

    expect(
      screen.getByRole("row", { name: "Cadastro 0 0% 0%" })
    ).not.toBeNull();
    expect(screen.queryByRole("row", { name: "Cadastro 0 0% 100%" })).toBeNull();
    expect(screen.getByText("Aquisição sem cadastro atribuído")).not.toBeNull();
    expect(screen.getByText("Em análise").parentElement?.textContent).toContain("1");
  });

  it("usa a coorte oficial calculada pelo backend nos KPIs de rentabilidade", async () => {
    const aligned = resultado();
    aligned.resumo.cadastros = 13;
    aligned.resumo.custoCadastroCentavos = 1538;
    aligned.resumoOficial = {
      ...aligned.resumo,
      cadastros: 7,
      negociosCriados: 6,
      servicosCriados: 5,
      agendasConfiguradas: 2,
      negociosPublicados: 4,
      primeirosAgendamentos: 0,
      checkoutsIniciados: 0,
      assinaturasAtivadas: 0,
      custoCadastroCentavos: 2857,
      taxaNegocio: 85.71,
      taxaPublicacao: 57.14,
      taxaCheckout: 0,
      taxaAssinatura: 0,
      taxaPrimeiroAgendamento: 0,
      receitaPrimeiroPagamentoCentavos: 0,
      roas: 0
    };
    aligned.campanhas = [
      ...aligned.campanhas,
      {
        ...aligned.campanhas[0],
        campanha: "(sem campanha)",
        cadastros: 6,
        investimentoCentavos: 0
      }
    ];
    aligned.campanhasOficiais = [
      {
        ...aligned.campanhas[0],
        cadastros: 7,
        custoCadastroCentavos: 2857,
        decisao: {
          codigo: "mensuracao_incompleta",
          rotulo: "Aguardar mensuração",
          confianca: "bloqueada",
          motivo: "Corrija a atribuição antes de alterar investimento."
        }
      }
    ];
    aligned.diagnosticoAtribuicao = {
      cadastrosOficiais: 7,
      cadastrosSemCampanha: 6,
      cadastrosIdentidadeNaoOficial: 0,
      cadastrosSemEvidencia: 0,
      cadastrosOrganicos: 0
    };
    aligned.qualidadeMensuracao = {
      cadastrosTotais: 13,
      cadastrosPagosDetectados: 13,
      cadastrosPagosPendentes: 6,
      cadastrosSemEvidencia: 0,
      coberturaAtribuicaoPagaPercentual: 53.85,
      coberturaOrigemPercentual: 100,
      coberturaMinimaPercentual: 100,
      prontaParaDecisao: false,
      bloqueios: [
        {
          codigo: "atribuicao_paga_incompleta",
          mensagem: "Cobertura incompleta."
        }
      ]
    };
    aligned.decisao.contagem = {
      escalar: 0,
      manter: 0,
      observar: 0,
      revisar: 0,
      pausar: 0,
      mensuracaoIncompleta: 1,
      semDados: 0
    };
    apiRequest.mockResolvedValueOnce(aligned);

    render(
      <MemoryRouter>
        <AdminProfessionalFunnelPage />
      </MemoryRouter>
    );

    expect(
      await screen.findAllByText("7")
    ).not.toHaveLength(0);
    expect(screen.getByText("Mensuração incompleta")).not.toBeNull();
    expect(screen.getByText("Aguardar mensuração")).not.toBeNull();
    expect(screen.getByText("Decisão bloqueada")).not.toBeNull();
    expect(screen.getByText("Investimento por cadastro total")).not.toBeNull();
    expect(screen.getByText(/R\$\s*30,77/)).not.toBeNull();
    expect(
      screen.getAllByText("Aguardando cobertura").length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/R\$\s*28,57/)).toBeNull();
    expect(
      screen.queryByText("Tráfego sem UTM de campanha")
    ).toBeNull();
  });

  it("separa cadastro sem evidência de orgânico e bloqueia a decisão", async () => {
    const unknownOrigin = resultado();
    unknownOrigin.diagnosticoAtribuicao = {
      cadastrosOficiais: 20,
      cadastrosSemCampanha: 0,
      cadastrosIdentidadeNaoOficial: 0,
      cadastrosSemEvidencia: 1,
      cadastrosOrganicos: 0
    };
    unknownOrigin.qualidadeMensuracao = {
      cadastrosTotais: 21,
      cadastrosPagosDetectados: 20,
      cadastrosPagosPendentes: 0,
      cadastrosSemEvidencia: 1,
      coberturaAtribuicaoPagaPercentual: 100,
      coberturaOrigemPercentual: 95.24,
      coberturaMinimaPercentual: 100,
      prontaParaDecisao: false,
      bloqueios: [
        {
          codigo: "origem_sem_evidencia",
          mensagem: "Há um cadastro sem evidência."
        }
      ]
    };
    unknownOrigin.decisao.contagem = {
      escalar: 0,
      manter: 0,
      observar: 0,
      revisar: 0,
      pausar: 0,
      mensuracaoIncompleta: 1,
      semDados: 0
    };
    unknownOrigin.campanhas[0].decisao = {
      codigo: "mensuracao_incompleta",
      rotulo: "Aguardar mensuração",
      confianca: "bloqueada",
      motivo: "Corrija a origem antes de alterar investimento."
    };
    apiRequest.mockResolvedValueOnce(unknownOrigin);

    render(
      <MemoryRouter>
        <AdminProfessionalFunnelPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Mensuração incompleta")).not.toBeNull();
    expect(screen.getByText("Sem evidência").parentElement?.textContent).toContain("1");
    expect(screen.getByText("95,2%")).not.toBeNull();
    expect(screen.queryByText("Orgânico / sem campanha")).toBeNull();
  });

  it("mostra campanha canônica e preserva as identidades UTM nos detalhes", async () => {
    const user = userEvent.setup();
    const consolidated = resultado();
    consolidated.campanhas = [
      {
        ...consolidated.campanhas[0],
        origem: "google",
        midia: "cpc",
        campanha: "google_ads_profissionais",
        cadastros: 12,
        investimentoCentavos: 20000,
        receitaPrimeiroPagamentoCentavos: 0,
        roas: 0,
        custoCadastroCentavos: 1667,
        custoCheckoutCentavos: null,
        cacAssinanteCentavos: null,
        consolidada: true,
        identidadesUtm: [
          { origem: "google", midia: "cpc", campanha: "aquisicao_profissionais" },
          { origem: "google", midia: "cpc", campanha: "search_aquisicao_profissionais" },
          { origem: "google", midia: "cpc", campanha: "google_ads_profissionais" }
        ],
        decisao: {
          codigo: "revisar",
          rotulo: "Revisar monetização",
          confianca: "operacional",
          motivo: "No modelo freemium, revise a conversão para o plano pago."
        }
      }
    ];
    apiRequest.mockResolvedValueOnce(consolidated);

    render(
      <MemoryRouter>
        <AdminProfessionalFunnelPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByText("Google Ads · Aquisição de profissionais")
    ).not.toBeNull();
    expect(screen.getByText("3 identidades vinculadas")).not.toBeNull();
    expect(screen.getByText(/R\$\s*200,00/)).not.toBeNull();
    expect(screen.queryByText("aquisicao_profissionais")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Ver detalhes" }));

    expect(screen.getByText("Identidades UTM incluídas")).not.toBeNull();
    expect(
      screen.getByText(/google \/ cpc \/ aquisicao_profissionais/)
    ).not.toBeNull();
    expect(
      screen.getByText(/google \/ cpc \/ search_aquisicao_profissionais/)
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
        classificacaoAtribuicao: "rastreamento_incompleto",
        investimentoCentavos: 0,
        receitaPrimeiroPagamentoCentavos: 0,
        roas: null,
        cacAssinanteCentavos: null,
        decisao: {
          codigo: "sem_dados",
          rotulo: "Sem investimento atribuído",
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
    expect(screen.getByText("Não atribuído")).not.toBeNull();
    expect(screen.getAllByText("Não calculável").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Sem investimento atribuído")).not.toBeNull();
    expect(screen.queryByText("Confiança baixa")).toBeNull();
  });

  it("remove o marcador técnico none do tráfego orgânico", async () => {
    const organic = resultado();
    organic.campanhas = [
      {
        ...organic.campanhas[0],
        origem: "organico",
        midia: "none",
        campanha: "organico",
        classificacaoAtribuicao: "organico",
        roas: null,
        investimentoCentavos: 0,
        receitaPrimeiroPagamentoCentavos: 0,
        cacAssinanteCentavos: null,
        decisao: {
          codigo: "sem_dados",
          rotulo: "Sem investimento atribuído",
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
    expect(screen.getByText("Não se aplica")).not.toBeNull();
    expect(screen.queryByText("none")).toBeNull();
  });

  it("recarrega a coorte ao trocar período", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AdminProfessionalFunnelPage />
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Aquisição e retorno de profissionais" });
    await user.click(screen.getByRole("button", { name: "7 dias" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/admin/marketing/funil-profissionais?periodo=7",
        expect.any(Object)
      );
    });
  });

  it("não reaproveita a coorte de outro período se a atualização falhar", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AdminProfessionalFunnelPage />
      </MemoryRouter>
    );

    await screen.findAllByText("profissionais_goiania");
    apiRequest.mockRejectedValueOnce(new Error("Funil indisponível"));

    await user.click(screen.getByRole("button", { name: "7 dias" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Funil indisponível");
    expect(screen.queryByText("profissionais_goiania")).toBeNull();
  });
});
