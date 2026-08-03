const {
  correspondeAoTipo,
} = require(
  "../src/utils/validarImagem"
);

describe(
  "Validação do conteúdo de imagens",
  () => {
    test.each([
      [
        "image/jpeg",
        Buffer.from([
          0xff,
          0xd8,
          0xff,
          0xe0,
        ]),
      ],
      [
        "image/png",
        Buffer.from([
          0x89,
          0x50,
          0x4e,
          0x47,
          0x0d,
          0x0a,
          0x1a,
          0x0a,
        ]),
      ],
      [
        "image/webp",
        Buffer.from(
          "RIFF0000WEBP",
          "ascii"
        ),
      ],
    ])(
      "reconhece %s pela assinatura real",
      (mimetype, buffer) => {
        expect(
          correspondeAoTipo(
            buffer,
            mimetype
          )
        ).toBe(true);
      }
    );

    test(
      "rejeita assinatura diferente do tipo declarado",
      () => {
        const jpeg =
          Buffer.from([
            0xff,
            0xd8,
            0xff,
          ]);

        expect(
          correspondeAoTipo(
            jpeg,
            "image/png"
          )
        ).toBe(false);
      }
    );

    test(
      "rejeita texto, buffer vazio e valor que não é buffer",
      () => {
        expect(
          correspondeAoTipo(
            Buffer.from("texto"),
            "image/jpeg"
          )
        ).toBe(false);

        expect(
          correspondeAoTipo(
            Buffer.alloc(0),
            "image/png"
          )
        ).toBe(false);

        expect(
          correspondeAoTipo(
            "texto",
            "image/webp"
          )
        ).toBe(false);
      }
    );
  }
);
