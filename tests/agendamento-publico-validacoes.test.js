const {
  ANTECEDENCIA_CANCELAMENTO_PADRAO,
  normalizarAntecedenciaCancelamento,
} = require(
  "../src/services/agendamentoPublicoValidacoes"
);

describe(
  "política pública de cancelamento",
  () => {
    test(
      "usa 2 horas como fallback canônico",
      () => {
        expect(
          ANTECEDENCIA_CANCELAMENTO_PADRAO
        ).toBe(2);

        expect(
          normalizarAntecedenciaCancelamento(
            undefined
          )
        ).toBe(2);

        expect(
          normalizarAntecedenciaCancelamento(
            -1
          )
        ).toBe(2);
      }
    );
  }
);
