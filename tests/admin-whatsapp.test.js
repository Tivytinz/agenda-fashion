const express = require(
  "express"
);
const request = require(
  "supertest"
);

jest.mock(
  "../src/middlewares/auth",
  () => (
    req,
    res,
    next
  ) => {
    req.user = { id: 7 };
    return next();
  }
);

jest.mock(
  "../src/middlewares/authAdmin",
  () => (
    req,
    res,
    next
  ) => {
    if (
      req.headers[
        "x-test-admin"
      ] === "no"
    ) {
      return res
        .status(403)
        .json({
          erro:
            "Acesso restrito aos administradores da plataforma.",
        });
    }

    req.admin = {
      usuarioId: 7,
      papel: "admin",
    };
    return next();
  }
);

jest.mock(
  "../src/repositories/adminWhatsAppRepository",
  () => ({
    buscarMetricasPorTemplate:
      jest.fn(),
  })
);

jest.mock(
  "../src/providers/whatsappProvider",
  () => ({
    listarTemplates:
      jest.fn(),
  })
);

const repository = require(
  "../src/repositories/adminWhatsAppRepository"
);
const whatsappProvider = require(
  "../src/providers/whatsappProvider"
);
const {
  listarTemplatesConfigurados,
} = require(
  "../src/config/whatsappTemplates"
);
const adminRoutes = require(
  "../src/routes/adminRoutes"
);

function criarApp() {
  const app = express();
  app.use(express.json());
  app.use(adminRoutes);
  app.use(
    (
      erro,
      req,
      res,
      next
    ) => res
      .status(
        erro?.statusCode || 500
      )
      .json({
        erro: erro.message,
      })
  );
  return app;
}

describe(
  "painel administrativo do WhatsApp",
  () => {
    const ambienteOriginal = {
      ...process.env,
    };

    beforeEach(() => {
      jest.clearAllMocks();

      process.env
        .WHATSAPP_NOTIFICATIONS_ENABLED =
        "true";
      process.env
        .WHATSAPP_PROFESSIONAL_REMINDER_ENABLED =
        "true";
      process.env
        .WHATSAPP_FIRST_SERVICE_REMINDER_ENABLED =
        "true";
      process.env
        .WHATSAPP_SHARE_REMINDER_ENABLED =
        "true";
      process.env
        .WHATSAPP_ACCESS_TOKEN =
        "segredo";
      process.env
        .WHATSAPP_PHONE_NUMBER_ID =
        "phone-1";
      process.env
        .WHATSAPP_BUSINESS_ACCOUNT_ID =
        "waba-1";
      process.env
        .WHATSAPP_API_VERSION =
        "v23.0";
      process.env
        .WHATSAPP_TEMPLATE_LANGUAGE =
        "pt_BR";

      repository
        .buscarMetricasPorTemplate
        .mockResolvedValue([{
          tipo:
            "CONFIRMACAO_AGENDAMENTO_CLIENTE",
          total: 10,
          pendentes: 1,
          aceitas: 8,
          falhas_fila: 1,
          canceladas: 0,
          entregues: 6,
          lidas: 3,
          falhas_entrega: 1,
        }]);

      whatsappProvider
        .listarTemplates
        .mockResolvedValue(
          listarTemplatesConfigurados()
            .map((template, index) => ({
              id: String(index + 1),
              name: template.nome,
              language: template.idioma,
              category:
                template.categoriaEsperada,
              status: "APPROVED",
              quality_score: {
                score: "GREEN",
              },
            }))
        );
    });

    afterAll(() => {
      process.env = {
        ...ambienteOriginal,
      };
    });

    test(
      "protege o painel com permissão administrativa",
      async () => {
        const resposta =
          await request(criarApp())
            .get(
              "/admin/whatsapp/templates"
            )
            .set(
              "x-test-admin",
              "no"
            );

        expect(resposta.status)
          .toBe(403);
        expect(repository
          .buscarMetricasPorTemplate)
          .not.toHaveBeenCalled();
      }
    );

    test(
      "combina os oito status da Meta com entrega e leitura locais",
      async () => {
        const resposta =
          await request(criarApp())
            .get(
              "/admin/whatsapp/templates?periodo=30"
            );

        expect(resposta.status)
          .toBe(200);
        expect(resposta.body.resumo)
          .toMatchObject({
            templatesEsperados: 8,
            templatesAprovadosMeta: 8,
            templatesComAtencao: 0,
            automacoesHabilitadas: 8,
            total: 10,
            aceitas: 8,
            entregues: 6,
            lidas: 3,
            taxaEntrega: 75,
            taxaLeitura: 50,
          });
        expect(resposta.body)
          .not.toHaveProperty(
            "WHATSAPP_ACCESS_TOKEN"
          );

        const confirmacao =
          resposta.body.templates.find(
            (template) =>
              template.tipo ===
              "CONFIRMACAO_AGENDAMENTO_CLIENTE"
          );

        expect(confirmacao)
          .toMatchObject({
            statusMeta: "APPROVED",
            categoriaConforme: true,
            qualidadeMeta: "GREEN",
            saude: "SAUDAVEL",
            metricas: {
              taxaEntrega: 75,
              taxaLeitura: 50,
            },
          });
      }
    );

    test(
      "mantém métricas visíveis quando falta a conta WABA",
      async () => {
        delete process.env
          .WHATSAPP_BUSINESS_ACCOUNT_ID;

        const resposta =
          await request(criarApp())
            .get(
              "/admin/whatsapp/templates?periodo=invalido"
            );

        expect(resposta.status)
          .toBe(200);
        expect(resposta.body.periodo.valor)
          .toBe("30");
        expect(resposta.body
          .verificacaoMeta)
          .toMatchObject({
            disponivel: false,
            codigo:
              "CONFIGURACAO_INCOMPLETA",
            variaveisAusentes: [
              "WHATSAPP_BUSINESS_ACCOUNT_ID",
            ],
          });
        expect(resposta.body.resumo
          .templatesAprovadosMeta)
          .toBeNull();
        expect(whatsappProvider
          .listarTemplates)
          .not.toHaveBeenCalled();
      }
    );
  }
);
