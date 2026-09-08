jest.mock(
  "../src/repositories/googleMeasurementRepository",
  () => ({})
);

const service = require(
  "../src/services/googleMeasurementService"
);

const ENV_KEYS = [
  "GOOGLE_MEASUREMENT_ENABLED",
  "GA4_MEASUREMENT_ID",
  "GA4_API_SECRET"
];

beforeEach(() => {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }

  process.env.GOOGLE_MEASUREMENT_ENABLED =
    "true";
  process.env.GA4_MEASUREMENT_ID =
    "G-ABCDEF1234";
  process.env.GA4_API_SECRET =
    "segredo-teste";

  global.fetch = jest.fn()
    .mockResolvedValue({
      ok: true
    });
});

afterAll(() => {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }

  delete global.fetch;
});

test(
  "purchase respeita timestamp_micros quando um timestamp explícito é fornecido",
  async () => {
    const ocorridoEm =
      "2026-09-08T18:00:00.000Z";

    await service
      .enviarEventoMeasurementProtocol({
        clientId:
          "123456.987654",
        userId: 7,
        eventName: "purchase",
        ocorridoEm,
        params: {
          transaction_id:
            "af-subscription-11",
          currency: "BRL",
          value: 49.9
        }
      });

    const payload = JSON.parse(
      global.fetch.mock.calls[0][1].body
    );

    expect(payload.timestamp_micros)
      .toBe(
        Date.parse(ocorridoEm) * 1000
      );
  }
);
