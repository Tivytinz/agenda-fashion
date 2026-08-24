const {
  campanhaAusenteSql,
  criarAtribuicaoUsuarioSql,
  criarVinculoCampanhaOficialSql,
} = require(
  "../src/repositories/marketingAttributionSql"
);

describe(
  "SQL compartilhado de atribuição",
  () => {
    test(
      "mantém no funil os mesmos identificadores pagos aceitos pelo frontend",
      () => {
        const atribuicao =
          criarAtribuicaoUsuarioSql(
            "mua"
          );

        expect(atribuicao.paidClick)
          .toContain("mua.gbraid");
        expect(atribuicao.paidClick)
          .toContain("mua.wbraid");
        expect(atribuicao.paidClick)
          .toContain("mua.msclkid");
        expect(atribuicao.paidClick)
          .toContain("mua.ttclid");
        expect(atribuicao.paidClick)
          .toContain("mua.epik");
        expect(atribuicao.campanha)
          .toContain("'(sem campanha)'");
      }
    );

    test(
      "considera arquivadas no vínculo histórico sem aceitar campanha ausente",
      () => {
        const vinculo =
          criarVinculoCampanhaOficialSql({
            origem: "e.origem",
            midia: "e.midia",
            campanha: "e.campanha",
          });

        expect(vinculo).not.toMatch(
          /candidata\.ativo\s*=\s*TRUE/i
        );
        expect(vinculo).toContain(
          "LOWER(candidata.utm_campaign)"
        );
        expect(
          campanhaAusenteSql(
            "e.campanha"
          )
        ).toContain("(sem campanha)");
      }
    );
  }
);
