jest.mock(
  "../src/repositories/metaAdsRepository",
  () => ({})
);

const service = require(
  "../src/services/metaAdsService"
);

const ENV_KEYS = [
  "META_ADS_ENABLED",
  "META_PIXEL_ID",
  "META_CAPI_ACCESS_TOKEN",
  "PUBLIC_APP_URL"
];

beforeEach(() => {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }

  process.env.META_ADS_ENABLED = "true";
  process.env.META_PIXEL_ID = "123456789";
  process.env.META_CAPI_ACCESS_TOKEN =
    "token-teste";
  process.env.PUBLIC_APP_URL =
    "https://app.agendafashion.com.br";

  global.fetch = jest.fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        events_received: 1
      })
    });
});

afterAll(() => {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }

  delete global.fetch;
});

test(
  "Subscribe usa event_time da confirmação financeira",
  async () => {
    const ocorridoEm =
      "2026-09-08T18:00:00.000Z";

    await service.enviarEvento({
      eventName: "Subscribe",
      eventId: "subscribe:12345678",
      usuarioId: 7,
      contexto: {
        consentimento: true,
        sourceUrl:
          "https://app.agendafashion.com.br/painel/assinatura"
      },
      ocorridoEm
    });

    const payload = JSON.parse(
      global.fetch.mock.calls[0][1].body
    );

    expect(payload.data[0].event_time)
      .toBe(
        Math.floor(
          Date.parse(ocorridoEm) /
          1000
        )
      );
  }
);
