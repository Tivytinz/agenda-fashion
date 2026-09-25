const {
  cacheStaticAsset,
  cacheVersionedAsset,
  disableDocumentCache,
} = require(
  "../src/utils/httpCache"
);

function respostaFake() {
  const headers =
    new Map();

  return {
    setHeader:
      jest.fn(
        (name, value) => {
          headers.set(
            String(name)
              .toLowerCase(),
            value
          );
        }
      ),
    header(name) {
      return headers.get(
        String(name)
          .toLowerCase()
      );
    },
  };
}

describe(
  "política HTTP de cache",
  () => {
    test(
      "mantém assets versionados com cache immutable",
      () => {
        const response =
          respostaFake();

        cacheStaticAsset(
          response,
          "assets/index-AbC123.js"
        );

        expect(
          response.header(
            "cache-control"
          )
        ).toBe(
          "public, max-age=31536000, immutable"
        );
      }
    );

    test.each([
      "assets/home/salon-hero-wide.webp",
      "assets/home/salon-hero-mobile.webp",
    ])(
      "revalida hero público com nome estável: %s",
      (asset) => {
        const response =
          respostaFake();

        cacheStaticAsset(
          response,
          asset
        );

        expect(
          response.header(
            "cache-control"
          )
        ).toBe(
          "public, max-age=0, must-revalidate"
        );

        expect(
          response.header(
            "cache-control"
          )
        ).not.toContain(
          "immutable"
        );
      }
    );

    test(
      "preserva o contrato de documento sem cache",
      () => {
        const response =
          respostaFake();

        disableDocumentCache(
          response
        );

        expect(
          response.header(
            "cache-control"
          )
        ).toBe(
          "no-store, no-cache, must-revalidate"
        );
      }
    );

    test(
      "helper explícito de asset versionado continua imutável",
      () => {
        const response =
          respostaFake();

        cacheVersionedAsset(
          response
        );

        expect(
          response.header(
            "cache-control"
          )
        ).toContain(
          "immutable"
        );
      }
    );
  }
);
