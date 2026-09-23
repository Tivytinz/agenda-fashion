// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { AdminAcquisitionV2Page, AdminRevenueV2Page } from "./AdminAnalyticsV2Pages";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));

const RESULT = {
  periodo: "7",
  sessoesPorOrigem: [{ canal: "paid_search", source: "google", medium: "cpc", campanha_nome: "Profissionais GO", sessoes: 100, usuarios: 70, tempo_engajado_ms: 60000 }],
  funilPorCampanha: [{ campanha: "Beleza GO", origem: "google", midia: "cpc", cadastros: 10, negociosPublicados: 6, primeirosAgendamentos: 3, assinaturasAtivadas: 1, investimentoCentavos: 5000, cacAssinanteCentavos: null, roas: null }],
  qualidadeMensuracao: { prontaParaDecisao: false, bloqueios: [{ codigo: "sem_evidencia", mensagem: "Existem cadastros sem evidência de origem." }] },
  retornoAquisicao: {
    inicioCobertura: "2026-09-23T18:00:00.000Z",
    primeiroDiaCompleto: "2026-09-24",
    independenteDoFiltroPeriodo: true,
    unidade: "negocio",
    diasMaturacaoMonetizacao: 21,
    diagnostico: {
      snapshotsTotal: 2,
      snapshotsOficiais: 2,
      snapshotsOrganicos: 0,
      snapshotsAtribuicaoIncompleta: 0,
      snapshotsAquisicaoPreCutover: 0,
      snapshotsPendentes: 0,
      pagantesSemCustoD30: 0
    },
    campanhas: [
      {
        campanhaOficialId: 10,
        campanha: "Google profissionais",
        canal: "google",
        origem: "google",
        midia: "cpc",
        primeiraRecuperacaoReceitaBrutaDias: 60,
        primeiraRecuperacaoLiquidaGatewayDias: 60,
        valorExpostoReversoesCentavos: 0,
        pagantesSemCustoD30: 0,
        pagantesSemCustoD60: 0,
        pagantesSemCustoD90: 0,
        janelas: [
          {
            dias: 30,
            diasMaduros: 2,
            investimentoCentavos: 20000,
            negociosPagos: 2,
            cacMidiaCentavos: 10000,
            receitaBrutaCentavos: 15000,
            ltvBrutoCentavos: 7500,
            retornoBruto: 0.75,
            ltvBrutoSobreCacMidia: 0.75,
            retornoLiquidoGateway: 0.7,
            ltvLiquidoGatewaySobreCacMidia: 0.7,
            economiaLiquida: {
              comparavel: true,
              codigo: "base_comparavel"
            },
            leitura: {
              codigo: "base_comparavel",
              rotulo: "Base comparável",
              comparavel: true
            }
          },
          {
            dias: 60,
            diasMaduros: 2,
            investimentoCentavos: 20000,
            negociosPagos: 2,
            cacMidiaCentavos: 10000,
            receitaBrutaCentavos: 24000,
            ltvBrutoCentavos: 12000,
            retornoBruto: 1.2,
            ltvBrutoSobreCacMidia: 1.2,
            retornoLiquidoGateway: 1.1,
            ltvLiquidoGatewaySobreCacMidia: 1.1,
            economiaLiquida: {
              comparavel: true,
              codigo: "base_comparavel"
            },
            leitura: {
              codigo: "base_comparavel",
              rotulo: "Base comparável",
              comparavel: true
            }
          },
          {
            dias: 90,
            diasMaduros: 0,
            investimentoCentavos: 0,
            negociosPagos: 0,
            cacMidiaCentavos: null,
            receitaBrutaCentavos: 0,
            ltvBrutoCentavos: null,
            retornoBruto: null,
            ltvBrutoSobreCacMidia: null,
            retornoLiquidoGateway: null,
            ltvLiquidoGatewaySobreCacMidia: null,
            economiaLiquida: {
              comparavel: false,
              codigo: "base_bruta_nao_comparavel"
            },
            leitura: {
              codigo: "aguardando_maturidade",
              rotulo: "Aguardando maturidade",
              comparavel: false
            }
          }
        ]
      }
    ]
  }
};

function LocationProbe() {
  return <output data-testid="location">{useLocation().search}</output>;
}

function renderPage() {
  render(<MemoryRouter initialEntries={["/admin/aquisicao?periodo=7"]}><AdminAcquisitionV2Page /><LocationProbe /></MemoryRouter>);
}

function renderRevenuePage() {
  render(<MemoryRouter initialEntries={["/admin/receita?periodo=30"]}><AdminRevenueV2Page /></MemoryRouter>);
}

beforeEach(() => { apiRequest.mockReset(); apiRequest.mockResolvedValue(RESULT); });
afterEach(cleanup);

describe("aquisição administrativa v2", () => {
  it("separa sessões, publicação, primeiro agendamento e pagamento sem gate de agenda", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Aquisição" });
    expect(screen.getByText("Profissionais GO")).not.toBeNull();
    const row = screen.getByText("Beleza GO").closest("tr");
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "Beleza GOgoogle / cpc", "10", "6", "3", "1", "—", "—"
    ]);
    expect(screen.queryByRole("columnheader", { name: /Agenda configurada|Pós-agenda/ })).toBeNull();
    expect(screen.getByText("Existem cadastros sem evidência de origem.")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Não use este recorte para escalar orçamento ainda" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Retorno da aquisição paga" })).not.toBeNull();
    expect(screen.getByText("CAC mídia D30")).not.toBeNull();
    expect(screen.getByText("Google profissionais")).not.toBeNull();
    expect(screen.getByText("0.75x")).not.toBeNull();
    expect(screen.getByText("1.20x")).not.toBeNull();
    expect(screen.getByText("Líquido gateway 0.70x")).not.toBeNull();
    expect(screen.getByText("Líquido gateway 1.10x")).not.toBeNull();
    expect(screen.getAllByText("Contribuição Aguardando contribuição").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Retorno de contribuição ainda indisponível.")).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: "Recuperação contribuição" })).not.toBeNull();
    expect(screen.getByText("Aguardando maturidade")).not.toBeNull();
    expect(screen.getAllByText("até D60").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/CAC de mídia não é CAC total/i)).not.toBeNull();
    expect(screen.getByText(/não declara lucro, CAC total ou payback econômico definitivo/i)).not.toBeNull();
  });

  it("mantém CAC e ROAS calculados pelo backend", async () => {
    apiRequest.mockResolvedValue({ ...RESULT, funilPorCampanha: [{ ...RESULT.funilPorCampanha[0], cacAssinanteCentavos: 3456, roas: 1.23 }] });
    renderPage();
    const row = (await screen.findByText("Beleza GO")).closest("tr");
    expect(within(row).getByText(/R\$\s*34,56/)).not.toBeNull();
    expect(within(row).getByText("1.23x")).not.toBeNull();
  });

  it("identifica ausência de amostra sem inventar conversão", async () => {
    apiRequest.mockResolvedValue({ periodo: "7", sessoesPorOrigem: [], funilPorCampanha: [] });
    renderPage();
    expect(await screen.findByText("Nenhuma coorte atribuída neste período")).not.toBeNull();
    expect(screen.getByText("Ainda não há sessões first-party neste recorte")).not.toBeNull();
    expect(screen.queryByText("100%")).toBeNull();
  });

  it("recarrega o período e persiste a seleção na URL", async () => {
    renderPage();
    await screen.findByText("Beleza GO");
    apiRequest.mockResolvedValue({ ...RESULT, periodo: "30", funilPorCampanha: [] });
    fireEvent.click(screen.getByRole("button", { name: "30 dias" }));
    await screen.findByText("Nenhuma coorte atribuída neste período");
    expect(apiRequest).toHaveBeenLastCalledWith("/admin/analytics-v2/acquisition?periodo=30", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(screen.getByTestId("location").textContent).toBe("?periodo=30");
  });

  it("identifica o período dos últimos dados válidos quando a atualização falha", async () => {
    renderPage();
    await screen.findByText("Beleza GO");
    apiRequest.mockRejectedValue(new Error("Falha ao consultar aquisição."));
    fireEvent.click(screen.getByRole("button", { name: "30 dias" }));
    expect((await screen.findByRole("alert")).textContent).toContain("últimos dados válidos");
    expect(screen.getByText("Beleza GO")).not.toBeNull();
    expect(screen.getByLabelText("Recorte temporal").textContent).toContain("7 dias");
  });
});

describe("receita administrativa v2", () => {
  it("separa receita inicial, renovação e mudança de plano", async () => {
    apiRequest.mockResolvedValue({
      periodo: "30",
      resumo: {
        receitaBruta: 249.6,
        receitaValidaAtual: 249.6,
        receitaPrimeiraConversao: 49.9,
        receitaRenovacao: 99.8,
        receitaMudancaPlano: 99.9,
        pagamentosEmReversao: 0,
        valorExpostoReversoes: 0,
        assinaturasPagasAtivas: 1,
        novosNegociosPagantes: 1,
        pagamentosRenovacao: 2,
        negociosComRenovacao: 1,
        pagamentosMudancaPlano: 1,
        pagamentosConfirmados: 4,
        negociosPagantes: 1,
        renovacoesPrevistas: 3,
        renovacoesConfirmadas: 2,
        taxaRenovacao: 66.67,
        renovacoesComAtraso: 2,
        renovacoesRecuperadas: 1,
        taxaRecuperacaoRenovacao: 50,
        cancelamentosRenovacaoAgendados: 0,
        assinaturasEncerradasAposCancelamento: 0,
        conversoesIniciaisCanonicas: 1,
        renovacoesConfirmadasCanonicas: 2,
        reativacoesPagas: 1,
        mudancasPlanoCanonicas: 1,
        pagamentosAtrasadosCanonicos: 2,
        pagamentosRecuperadosCanonicos: 1,
        reversoesFinanceirasCanonicas: 1,
        cancelamentosRenovacaoCanonicos: 1,
        saidasBasePagaCanonicas: 1,
        cancelamentosVencidosPendentesReconciliacao: 0,
        basePagaInicioChurn: 10,
        saidasTerminaisBaseInicial: 2,
        churnBrutoNegocios: 20,
        negociosReativadosChurn: 1,
        basePagaFimChurn: 9,
        saidasCancelamentoVoluntario: 1,
        saidasInadimplenciaNaoRecuperada: 1,
        saidasEncerramentoProvedor: 0,
        saidasOutrosMotivos: 0,
        mrrInicial: 1000,
        newMrr: 200,
        reactivationMrr: 100,
        expansionMrr: 100,
        contractionMrr: 50,
        churnedMrr: 150,
        mrrFinalCoorteInicial: 950,
        mrrFinalTotal: 1200,
        mrrEmRisco: 149.8,
        negociosMrrEmRisco: 2,
        grr: 85,
        nrr: 95,
        divergenciaBridgeMrr: 0,
        bridgeMrrReconciliado: true,
        assinaturasPeriodicidadeNaoSuportada: 0
      },
      planos: [],
      churn: {
        inicioCobertura: "2026-09-23T05:00:00.000Z",
        inicioEfetivo: "2026-09-23T05:00:00.000Z",
        periodoAjustadoAoCutover: true,
        historicoAnteriorInferido: false
      },
      mrr: {
        inicioCobertura: "2026-09-23T06:00:00.000Z",
        inicioEfetivo: "2026-09-23T06:00:00.000Z",
        periodoAjustadoAoCutover: true,
        historicoAnteriorInferido: false,
        periodicidadeSuportada: "MONTHLY",
        bridgeReconciliado: true,
        confiavel: true
      },
      ltv: {
        inicioCobertura: "2026-09-23T07:00:00.000Z",
        historicoAnteriorInferido: false,
        unidade: "negocio",
        ltvLiquidoDisponivel: false,
        ltvLiquidoGatewayDisponivel: true,
        inicioCoberturaEconomiaLiquida: "2026-09-23T19:00:00.000Z",
        ltvLiquidoGatewayD30: 78.33,
        ltvLiquidoGatewayD60: 115,
        ltvLiquidoGatewayD90: null,
        madurosLiquidosD30: 3,
        madurosLiquidosD60: 2,
        madurosLiquidosD90: 0,
        incompletosLiquidosD30: 0,
        incompletosLiquidosD60: 0,
        incompletosLiquidosD90: 0,
        independenteDoFiltroPeriodo: true,
        negociosCoorte: 3,
        madurosD30: 3,
        madurosD60: 2,
        madurosD90: 0,
        ltvBrutoD30: 83.23,
        ltvBrutoD60: 124.85,
        ltvBrutoD90: null,
        valorExpostoReversoes: 49.9,
        pagamentosEmReversao: 1,
        coortes: [
          {
            coorteMes: "2026-06",
            negocios: 3,
            madurosD30: 3,
            madurosD60: 2,
            madurosD90: 0,
            ltvBrutoD30: 83.23,
            ltvBrutoD60: 124.85,
            ltvBrutoD90: null,
            madurosCobertosLiquidoD30: 3,
            madurosCobertosLiquidoD60: 2,
            madurosCobertosLiquidoD90: 0,
            negociosIncompletosLiquidoD30: 0,
            negociosIncompletosLiquidoD60: 0,
            negociosIncompletosLiquidoD90: 0,
            receitaLiquidaGatewayD30: 235,
            receitaLiquidaGatewayD60: 230,
            receitaLiquidaGatewayD90: 0
          }
        ]
      },
      metodologia: {
        churn: "Gross logo churn v1 usa a base paga inicial.",
        mrr: "MRR v1 usa snapshots monetários.",
        nrr: "NRR v1 usa a coorte inicial.",
        ltv: "LTV bruto observado v1 usa negócios maduros.",
        economiaLiquida: "A Wave 28 reconcilia netValue e refunds.",
        contribuicao: "A Wave 29 exige cobertura factual de custos variáveis."
      }
    });

    renderRevenuePage();

    expect(await screen.findByText("Receita inicial")).not.toBeNull();
    expect(screen.getByText("Receita de renovação")).not.toBeNull();
    expect(screen.getByText("Mudança de plano")).not.toBeNull();
    expect(screen.getByText("Renovações vencidas no período")).not.toBeNull();
    expect(screen.getByText("Transições pagas registradas desde a Wave 22")).not.toBeNull();
    expect(screen.getByText("Reativações pagas")).not.toBeNull();
    expect(screen.getByText("Reversões financeiras")).not.toBeNull();
    expect(screen.getByText("Saídas da base paga")).not.toBeNull();
    expect(screen.getByText("Pendentes de reconciliação temporal")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Receita recorrente canônica" })).not.toBeNull();
    expect(screen.getByText("MRR da base inicial")).not.toBeNull();
    expect(screen.getByText("Expansion MRR")).not.toBeNull();
    expect(screen.getByText("Contraction MRR")).not.toBeNull();
    expect(screen.getByText("Churned MRR")).not.toBeNull();
    expect(screen.getByText("MRR em risco")).not.toBeNull();
    expect(screen.getByText("GRR")).not.toBeNull();
    expect(screen.getByText("NRR")).not.toBeNull();
    expect(screen.getByText("95%")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "LTV bruto observado" })).not.toBeNull();
    expect(screen.getByText("LTV bruto D30")).not.toBeNull();
    expect(screen.getByText("LTV bruto D60")).not.toBeNull();
    expect(screen.getByText("LTV bruto D90")).not.toBeNull();
    expect(screen.getByText("Aguardando maturidade")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Economia do recebimento" })).not.toBeNull();
    expect(screen.getByText("Receita líquida de gateway")).not.toBeNull();
    expect(screen.getByText("Taxas gateway observadas")).not.toBeNull();
    expect(screen.getByText("Custos variáveis observados")).not.toBeNull();
    expect(screen.getByText("Margem de contribuição")).not.toBeNull();
    expect(screen.getByText("Margem de contribuição %")).not.toBeNull();
    expect(screen.getByText("Fontes de custo cobertas")).not.toBeNull();
    expect(screen.getByText("Margem de contribuição ainda indisponível.")).not.toBeNull();
    expect(screen.getByText("LTV líquido gateway D30")).not.toBeNull();
    expect(screen.getByText("LTV econômico / margem")).not.toBeNull();
    expect(screen.getAllByText("Indisponível").length).toBeGreaterThan(0);
    expect(screen.getByText("2026-06")).not.toBeNull();
    expect(screen.getByText("85%")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Churn bruto de negócios" })).not.toBeNull();
    expect(screen.getByText("Gross logo churn")).not.toBeNull();
    expect(screen.getByText("Inadimplência não recuperada")).not.toBeNull();
    expect(screen.getByText("20%")).not.toBeNull();
    expect(screen.getByText("66,7%")).not.toBeNull();
    expect(screen.getByText("50%")).not.toBeNull();
    expect(screen.getByText("Cancelar a próxima renovação, atrasar uma cobrança e perder o acesso pago são fatos diferentes.")).not.toBeNull();
    expect(screen.queryByText(/^Churn$/i)).toBeNull();
  });
});
