jest.mock(
  "../src/repositories/analyticsV2Repository",
  () => ({
    executarTransacao: jest.fn(
      async (callback) => callback({})
    ),
    upsertVisitante: jest.fn(),
    upsertSessao: jest.fn(),
    vincularIdentidade: jest.fn(),
    resolverNegocioDoAtor: jest.fn(),
    buscarCampanhaOficial: jest.fn(),
    salvarEvidenciasSessao: jest.fn(),
    salvarOrigemSessao: jest.fn(),
    registrarVisualizacao: jest.fn(),
    registrarEngajamento: jest.fn(),
    registrarEvento: jest.fn(),
    buscarVisualizacaoPorUuid: jest.fn(),
    resolverAgendamentoEvento: jest.fn(),
    recalcularSessao: jest.fn(),
  })
);

const analyticsRepository = require(
  "../src/repositories/analyticsV2Repository"
);
const {
  coletar,
  normalizarAquisicao,
  normalizarItem,
  classificarCanal,
  uuidValido,
} = require(
  "../src/services/analyticsV2Service"
);

const AGORA =
  "2026-09-08T15:00:00.000Z";

const VIEW_UUID =
  "6a9fa7d3-9c56-4b11-8e18-5f328f2b2af1";

const EVENT_UUID =
  "29e5c4ef-857e-43cf-a584-bcbd2cb0df0a";

describe(
  "analyticsV2Service",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers();
      jest.setSystemTime(
        new Date(AGORA)
      );

      analyticsRepository.upsertVisitante
        .mockResolvedValue({ id: 1 });
      analyticsRepository.upsertSessao
        .mockResolvedValue({
          id: 2,
          session_uuid:
            "5bb9d6c2-9d35-4aa8-80b3-929563811a55",
        });
      analyticsRepository.buscarCampanhaOficial
        .mockResolvedValue(null);
      analyticsRepository.resolverNegocioDoAtor
        .mockResolvedValue(null);
      analyticsRepository.buscarVisualizacaoPorUuid
        .mockResolvedValue(null);
      analyticsRepository.registrarEvento
        .mockResolvedValue({ id: 3 });
      analyticsRepository.recalcularSessao
        .mockResolvedValue({
          eventos: 1,
        });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test(
      "normaliza evidências de aquisição sem aceitar URL completa como landing page",
      () => {
        const resultado =
          normalizarAquisicao({
            utmSource:
              "  Google  ",
            utmMedium:
              " CPC ",
            utmCampaign:
              " Campanha Profissionais ",
            utmContent:
              "criativo\nrosa",
            gclid:
              "gclid-123",
            landingPage:
              "/para-profissionais?utm_source=google#hero",
            referrerHost:
              "WWW.GOOGLE.COM",
          });

        expect(resultado).toEqual({
          utmSource:
            "google",
          utmMedium:
            "cpc",
          utmCampaign:
            "campanha profissionais",
          utmContent:
            "criativorosa",
          utmTerm:
            null,
          gclid:
            "gclid-123",
          gbraid:
            null,
          wbraid:
            null,
          fbclid:
            null,
          msclkid:
            null,
          ttclid:
            null,
          landingPage:
            "/para-profissionais",
          referrerHost:
            "www.google.com",
        });
      }
    );

    test.each([
      [
        "busca paga por click id",
        {
          gclid: "google-click",
          utmSource: "google",
          utmMedium: "cpc",
        },
        "paid_search",
        "evidencia_paga",
      ],
      [
        "social pago por click id",
        {
          fbclid: "meta-click",
          utmSource: "instagram",
          utmMedium: "paid_social",
        },
        "paid_social",
        "evidencia_paga",
      ],
      [
        "busca orgânica por referrer",
        {
          referrerHost: "www.google.com",
        },
        "organic_search",
        "referencia_rastreada",
      ],
      [
        "assistente de IA por referrer",
        {
          referrerHost: "chatgpt.com",
        },
        "ai_assistant",
        "referencia_rastreada",
      ],
      [
        "direto sem evidência",
        {},
        "direct",
        "sem_evidencia",
      ],
    ])(
      "classifica %s",
      (
        _descricao,
        evidencias,
        canal,
        classificacao
      ) => {
        expect(
          classificarCanal(
            evidencias,
            null
          )
        ).toMatchObject({
          canal,
          classificacao,
        });
      }
    );

    test(
      "promove para oficial somente quando o backend resolveu uma campanha",
      () => {
        const evidencias = {
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign: "profissionais-goiania",
        };

        expect(
          classificarCanal(
            evidencias,
            null
          )
        ).toMatchObject({
          canal: "paid_search",
          classificacao: "evidencia_paga",
          metodoResolucao: "click_id_ou_utm",
        });

        expect(
          classificarCanal(
            evidencias,
            { id: 42 }
          )
        ).toMatchObject({
          canal: "paid_search",
          classificacao: "oficial",
          metodoResolucao: "campanha_oficial",
        });
      }
    );

    test(
      "aceita somente eventos frontend da allowlist e propriedades previstas no contrato",
      () => {
        const resultado =
          normalizarItem({
            type: "event",
            eventUuid: EVENT_UUID,
            viewUuid: VIEW_UUID,
            name: "PROFILE_SHARED",
            schemaVersion: 1,
            occurredAt: AGORA,
            targetBusinessId: 11,
            properties: {
              method: "whatsapp",
              email: "nao-deve-ser-persistido@example.com",
              arbitrary: true,
            },
          });

        expect(resultado).toMatchObject({
          type: "event",
          eventUuid: EVENT_UUID,
          viewUuid: VIEW_UUID,
          name: "profile_shared",
          targetBusinessId: 11,
          properties: {
            method: "whatsapp",
          },
        });

        expect(resultado.properties).not.toHaveProperty(
          "email"
        );
        expect(resultado.properties).not.toHaveProperty(
          "arbitrary"
        );
      }
    );

    test(
      "aceita visualização de perfil e conclusão de booking como diagnóstico",
      () => {
        const profile = normalizarItem({
          type: "event",
          eventUuid: EVENT_UUID,
          viewUuid: VIEW_UUID,
          name: "profile_viewed",
          schemaVersion: 1,
          occurredAt: AGORA,
          targetBusinessId: 11,
          properties: {
            entry_point: "compartilhamento",
          },
        });

        expect(profile).toMatchObject({
          name: "profile_viewed",
          targetBusinessId: 11,
          properties: {
            entry_point: "compartilhamento",
          },
        });

        const booking = normalizarItem({
          type: "event",
          eventUuid: "f1d5b6bf-bad7-4bd0-86ec-55a733d3f4af",
          viewUuid: VIEW_UUID,
          name: "booking_completed",
          schemaVersion: 1,
          occurredAt: AGORA,
          targetBusinessId: 11,
          targetServiceId: 22,
          bookingId: 321,
          properties: {
            status: "sucesso",
          },
        });

        expect(booking).toMatchObject({
          name: "booking_completed",
          targetBusinessId: 11,
          targetServiceId: 22,
          agendamentoId: 321,
          properties: {
            status: "sucesso",
          },
        });
      }
    );

    test(
      "aceita intenção de repetição sem persistir propriedades fora do contrato",
      () => {
        const repeat = normalizarItem({
          type: "event",
          eventUuid:
            "3e6f7270-606f-44a8-b8d2-273a79f0a501",
          viewUuid: VIEW_UUID,
          name: "booking_started",
          schemaVersion: 1,
          occurredAt: AGORA,
          targetBusinessId: 11,
          targetServiceId: 22,
          properties: {
            entry_point: "customer_agenda",
            intent: "repeat_booking",
            source_booking_status: "realizado",
            whatsapp: "62999999999",
          },
        });

        expect(repeat).toMatchObject({
          name: "booking_started",
          targetBusinessId: 11,
          targetServiceId: 22,
          properties: {
            entry_point: "customer_agenda",
            intent: "repeat_booking",
            source_booking_status: "realizado",
          },
        });
        expect(repeat.properties).not.toHaveProperty(
          "whatsapp"
        );

        const invalid = normalizarItem({
          type: "event",
          eventUuid:
            "5e34f68a-cff4-42a1-a8ee-93b8cab1fb2a",
          name: "booking_started",
          schemaVersion: 1,
          occurredAt: AGORA,
          properties: {
            entry_point: "customer_agenda",
            intent: "inventado",
            source_booking_status: "qualquer_texto",
          },
        });

        expect(invalid.properties).toEqual({
          entry_point: "customer_agenda",
        });
      }
    );

    test(
      "valida o booking no backend antes de persistir o vínculo do evento",
      async () => {
        analyticsRepository
          .resolverAgendamentoEvento
          .mockResolvedValue({
            id: 321,
          });

        await coletar({
          usuarioId: null,
          body: {
            visitorUuid:
              "7bd13f95-2df5-4c1d-86b2-d30204ba91d1",
            sessionUuid:
              "dd22eaf4-c58c-4a63-b68b-cd74dc194d3d",
            items: [
              {
                type: "event",
                eventUuid:
                  "f1d5b6bf-bad7-4bd0-86ec-55a733d3f4af",
                name: "booking_completed",
                schemaVersion: 1,
                occurredAt: AGORA,
                targetBusinessId: 11,
                targetServiceId: 22,
                bookingId: 321,
                properties: {
                  status: "sucesso",
                },
              },
            ],
          },
        });

        expect(
          analyticsRepository
            .resolverAgendamentoEvento
        ).toHaveBeenCalledWith({
          agendamentoId: 321,
          targetBusinessId: 11,
          targetServiceId: 22,
        }, {});
        expect(
          analyticsRepository.registrarEvento
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            nome: "booking_completed",
            agendamentoId: 321,
            targetBusinessId: 11,
            targetServiceId: 22,
          }),
          {}
        );
      }
    );

    test(
      "rejeita evento frontend desconhecido",
      () => {
        expect(() =>
          normalizarItem({
            type: "event",
            eventUuid: EVENT_UUID,
            name: "revenue_confirmed",
            occurredAt: AGORA,
          })
        ).toThrow(
          "Evento frontend não permitido."
        );
      }
    );

    test(
      "rejeita query string e fragmento no template de rota",
      () => {
        expect(() =>
          normalizarItem({
            type: "page_view",
            viewUuid: VIEW_UUID,
            sequence: 1,
            pageKey: "business_profile",
            routeTemplate: "/negocio/:slug?utm_source=google",
            occurredAt: AGORA,
          })
        ).toThrow(
          "Template de rota inválido."
        );
      }
    );

    test(
      "valida UUIDs usados como identidade first-party",
      () => {
        expect(
          uuidValido(VIEW_UUID)
        ).toBe(true);
        expect(
          uuidValido("visitor-123")
        ).toBe(false);
      }
    );
  }
);
