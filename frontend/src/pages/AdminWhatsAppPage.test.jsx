// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { AdminWhatsAppPage } from "./AdminWhatsAppPage";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

const { apiRequest } = await import("../api/client");

const RESULT = {
  periodo: {
    valor: "30",
    rotulo: "30 dias"
  },
  configuracao: {
    notificacoesHabilitadas: true,
    tokenConfigurado: true,
    telefoneConfigurado: true,
    contaWhatsappConfigurada: true,
    versaoApiConfigurada: true,
    idioma: "pt_BR"
  },
  verificacaoMeta: {
    disponivel: true,
    consultadoEm: "2026-08-21T19:00:00.000Z",
    codigo: "CONSULTA_CONCLUIDA",
    mensagem: "Status consultado diretamente na Meta.",
    variaveisAusentes: []
  },
  resumo: {
    templatesEsperados: 8,
    templatesAprovadosMeta: 8,
    templatesComAtencao: 0,
    automacoesHabilitadas: 6,
    total: 10,
    pendentes: 1,
    aceitas: 8,
    entregues: 6,
    lidas: 3,
    falhasFila: 1,
    falhasEntrega: 0,
    canceladas: 0,
    taxaEntrega: 75,
    taxaLeitura: 50
  },
  templates: [{
    tipo: "CONFIRMACAO_AGENDAMENTO_CLIENTE",
    rotulo: "Confirmação para a cliente",
    destinatario: "Cliente",
    categoriaEsperada: "UTILITY",
    nome: "confirmacao_agendamento_cliente",
    idioma: "pt_BR",
    automacaoHabilitada: true,
    statusMeta: "APPROVED",
    categoriaMeta: "UTILITY",
    categoriaConforme: true,
    qualidadeMeta: "GREEN",
    saude: "SAUDAVEL",
    metricas: {
      total: 10,
      pendentes: 1,
      aceitas: 8,
      entregues: 6,
      lidas: 3,
      falhasFila: 1,
      falhasEntrega: 0,
      canceladas: 0,
      taxaEntrega: 75,
      taxaLeitura: 50
    }
  }]
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  apiRequest.mockResolvedValue(RESULT);
});

describe("painel administrativo do WhatsApp", () => {
  it("mostra aprovação, automação e funil de entrega sem confundir aceite com entrega", async () => {
    render(<AdminWhatsAppPage />);

    expect(
      await screen.findByRole("heading", { name: "WhatsApp e templates" })
    ).not.toBeNull();
    expect(screen.getByText("8 de 8")).not.toBeNull();
    expect(screen.getByText("Aprovados na Meta")).not.toBeNull();
    expect(screen.getByText("6 de 8")).not.toBeNull();
    expect(screen.getAllByText("75%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("50%").length).toBeGreaterThan(0);
    expect(screen.getByText("Confirmação para a cliente")).not.toBeNull();
    expect(screen.getByText("confirmacao_agendamento_cliente")).not.toBeNull();
    expect(screen.getByText("Ativo")).not.toBeNull();
    expect(screen.getByText("Boa")).not.toBeNull();
    expect(screen.getAllByText("8").length).toBeGreaterThan(0);
    expect(screen.getByText("de 10 geradas")).not.toBeNull();
  });

  it("atualiza as métricas quando o período muda", async () => {
    const user = userEvent.setup();
    render(<AdminWhatsAppPage />);
    await screen.findByText("Confirmação para a cliente");
    apiRequest.mockClear();

    await user.click(screen.getByRole("button", { name: "7 dias" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/admin/whatsapp/templates?periodo=7",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });

  it("explica quando a Meta não pôde ser consultada sem esconder os dados locais", async () => {
    apiRequest.mockResolvedValueOnce({
      ...RESULT,
      configuracao: {
        ...RESULT.configuracao,
        notificacoesHabilitadas: false,
        contaWhatsappConfigurada: false
      },
      verificacaoMeta: {
        disponivel: false,
        consultadoEm: null,
        codigo: "CONFIGURACAO_INCOMPLETA",
        mensagem: "Configure a conta do WhatsApp para verificar os templates diretamente na Meta.",
        variaveisAusentes: ["WHATSAPP_BUSINESS_ACCOUNT_ID"]
      },
      resumo: {
        ...RESULT.resumo,
        templatesAprovadosMeta: null
      },
      templates: RESULT.templates.map((template) => ({
        ...template,
        statusMeta: "NAO_VERIFICADO",
        qualidadeMeta: null
      }))
    });

    render(<AdminWhatsAppPage />);

    expect(
      await screen.findByText("Status da Meta ainda não confirmado")
    ).not.toBeNull();
    expect(screen.getByText(/WHATSAPP_BUSINESS_ACCOUNT_ID/)).not.toBeNull();
    expect(screen.getByText(/envio automático está desligado/i)).not.toBeNull();
    expect(screen.getAllByText("Não verificado").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("button", { name: "Verificar novamente" })).not.toBeNull();
    expect(screen.getByText(/8 templates aguardam consulta/i)).not.toBeNull();
    expect(screen.getByText("de 10 geradas")).not.toBeNull();
  });
});
