jest.mock(
  "../src/repositories/analyticsV2Repository",
  () => ({})
);

const {
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
      jest.useFakeTimers();
      jest.setSystemTime(
        new Date(AGORA)
      );
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
            afSource:
              " Agenda_Fashion ",
            afMedium:
              " SHARE ",
            afContent:
              "negocio",
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
          afSource:
            "agenda_fashion",
          afMedium:
            "share",
          afContent:
            "negocio",
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

    test("classifica link próprio do AF como referência rastreada", () => {
      expect(
        classificarCanal(
          {
            afSource: "agenda_fashion",
            afMedium: "share",
            afContent: "negocio",
          },
          null
        )
      ).toMatchObject({
        canal: "other",
        source: "agenda_fashion",
        medium: "share",
        classificacao: "referencia_rastreada",
        metodoResolucao: "af_link",
      });
    });

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

    test("aceita os marcos de visualização e conclusão do booking", () => {
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
          arbitrary: "descartar",
        },
      });

      const booking = normalizarItem({
        type: "event",
        eventUuid: "33333333-3333-4333-8333-333333333333",
        viewUuid: VIEW_UUID,
        name: "booking_completed",
        schemaVersion: 1,
        occurredAt: AGORA,
        targetBusinessId: 11,
        properties: {
          appointment_id: 99,
          status: "sucesso",
          arbitrary: "descartar",
        },
      });

      expect(profile.properties).toEqual({
        entry_point: "compartilhamento",
      });
      expect(booking.properties).toEqual({
        appointment_id: 99,
        status: "sucesso",
      });
    });

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
