const crypto = require("crypto");

const {
  assinarCapability,
  assinaturaCorresponde,
} = require(
  "../src/config/bookingCapability"
);
const {
  gerarAcessoVisitante,
  validarAcessoVisitante,
} = require(
  "../src/utils/agendamentoVisitante"
);
const {
  gerarAcessoClienteDesativado,
  validarAcessoClienteDesativado,
} = require(
  "../src/utils/acessoClienteDesativado"
);

describe(
  "segredos das capabilities de booking",
  () => {
    const envOriginal = {
      JWT_SECRET:
        process.env.JWT_SECRET,
      BOOKING_CAPABILITY_SECRET:
        process.env
          .BOOKING_CAPABILITY_SECRET,
      BOOKING_CAPABILITY_PREVIOUS_SECRET:
        process.env
          .BOOKING_CAPABILITY_PREVIOUS_SECRET,
    };

    beforeEach(() => {
      process.env.JWT_SECRET =
        "jwt-legado-com-pelo-menos-trinta-e-dois-caracteres";
      process.env.BOOKING_CAPABILITY_SECRET =
        "booking-atual-com-pelo-menos-trinta-e-dois-caracteres";
      delete process.env
        .BOOKING_CAPABILITY_PREVIOUS_SECRET;
    });

    afterAll(() => {
      for (
        const [
          nome,
          valor,
        ] of Object.entries(
          envOriginal
        )
      ) {
        if (
          valor === undefined
        ) {
          delete process.env[
            nome
          ];
        } else {
          process.env[
            nome
          ] = valor;
        }
      }
    });

    test(
      "novas capabilities usam segredo dedicado e não JWT_SECRET",
      () => {
        const acesso =
          gerarAcessoVisitante(
            101
          );

        const legado =
          crypto
            .createHmac(
              "sha256",
              process.env
                .JWT_SECRET
            )
            .update(
              "agenda-fashion:guest-appointment-cancel:v1:101"
            )
            .digest(
              "base64url"
            );

        expect(
          acesso
        ).not.toBe(
          legado
        );
        expect(
          validarAcessoVisitante(
            101,
            acesso
          )
        ).toBe(true);
      }
    );

    test(
      "capability histórica exige previous secret explícito durante migração",
      () => {
        const legado =
          crypto
            .createHmac(
              "sha256",
              process.env
                .JWT_SECRET
            )
            .update(
              "agenda-fashion:guest-appointment-cancel:v1:202"
            )
            .digest(
              "base64url"
            );

        expect(
          validarAcessoVisitante(
            202,
            legado
          )
        ).toBe(false);

        process.env
          .BOOKING_CAPABILITY_PREVIOUS_SECRET =
          process.env.JWT_SECRET;

        expect(
          validarAcessoVisitante(
            202,
            legado
          )
        ).toBe(true);
      }
    );

    test(
      "rotação aceita segredo anterior sem assinar novas capabilities com ele",
      () => {
        process.env
          .BOOKING_CAPABILITY_PREVIOUS_SECRET =
          "booking-anterior-com-pelo-menos-trinta-e-dois-caracteres";

        const anterior =
          crypto
            .createHmac(
              "sha256",
              process.env
                .BOOKING_CAPABILITY_PREVIOUS_SECRET
            )
            .update(
              "agenda-fashion:guest-appointment-cancel:v1:303"
            )
            .digest(
              "base64url"
            );

        expect(
          validarAcessoVisitante(
            303,
            anterior
          )
        ).toBe(true);

        expect(
          gerarAcessoVisitante(
            303
          )
        ).not.toBe(
          anterior
        );
      }
    );

    test(
      "cliente desativado usa o mesmo cofre de capability com domínio separado",
      () => {
        const desativadoEm =
          "2026-11-12T12:00:00.000Z";

        const acesso =
          gerarAcessoClienteDesativado({
            agendamentoId:
              404,
            usuarioId:
              55,
            desativadoEm,
          });

        expect(
          validarAcessoClienteDesativado({
            agendamentoId:
              404,
            usuarioId:
              55,
            desativadoEm,
            acesso,
          })
        ).toBe(true);

        expect(
          validarAcessoVisitante(
            404,
            acesso
          )
        ).toBe(false);
      }
    );

    test(
      "helper rejeita assinatura adulterada",
      () => {
        expect(
          assinaturaCorresponde({
            contexto:
              "teste",
            payload:
              "1",
            assinatura:
              "x".repeat(43),
          })
        ).toBe(false);

        expect(
          assinarCapability({
            contexto:
              "teste",
            payload:
              "1",
          })
        ).toMatch(
          /^[A-Za-z0-9_-]{43}$/
        );
      }
    );
  }
);
